// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../worker-utils', () => ({
    getSystemPrompt: vi.fn(() => 'system prompt'),
}));

// Mock WebLLMWorker to avoid load errors
vi.mock('../web-llm-worker', () => ({
    WebLLMWorker: {
        getEngine: vi.fn(),
    }
}));

describe('handleGenerateOnline Performance', () => {
    let workerModule: any;

    beforeEach(async () => {
        vi.resetModules();
        vi.useFakeTimers();

        // Mock global fetch
        global.fetch = vi.fn();

        // Force mock self.postMessage
        (self as any).postMessage = vi.fn();

        // Import worker to trigger side effects (onmessage assignment)
        workerModule = await import('../worker');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should throttle IPC messages during online generation', async () => {
        const chunks = [];
        // Generate 100 small chunks that would normally trigger 100 updates
        for (let i = 0; i < 100; i++) {
            chunks.push(`data: {"choices":[{"delta":{"content":"${i} "}}]}\n\n`);
        }
        chunks.push('data: [DONE]\n\n');

        // Create a ReadableStream that yields chunks synchronously when read
        const stream = new ReadableStream({
            start(controller) {
                for (const chunk of chunks) {
                    controller.enqueue(new TextEncoder().encode(chunk));
                }
                controller.close();
            }
        });

        const mockResponse = {
            ok: true,
            body: stream,
            json: async () => ({})
        };
        (global.fetch as any).mockResolvedValue(mockResponse);

        // Ensure onmessage is defined
        const onMessage = self.onmessage;
        if (!onMessage) throw new Error("onMessage not defined");

        // Trigger generation
        const promise = onMessage({
            data: {
                type: 'generate',
                text: 'test',
                mode: 'proofread',
                settings: {
                    engine: 'online',
                    apiBaseUrl: 'https://api.example.com',
                    apiKey: 'sk-test',
                    apiModel: 'gpt-4'
                }
            }
        } as MessageEvent);

        await promise;

        // Verify postMessage count
        const postMessage = (self as any).postMessage;
        // Filter for 'update' messages only
        const updateCalls = postMessage.mock.calls;


        // Expect failure if we reverted the fix (high call count)
        // With fix: < 10
        // Without fix: > 90
        expect(updateCalls.length).toBeLessThan(10);
    });
});
