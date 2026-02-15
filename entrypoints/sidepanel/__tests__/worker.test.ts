// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted for variables used in vi.mock
const { mockChatCompletion, mockReload } = vi.hoisted(() => {
    return {
        mockChatCompletion: vi.fn(),
        mockReload: vi.fn(),
    }
});

// Mock global self
const postMessageMock = vi.fn();
// In happy-dom environment, global.self should be the window object
// We assign postMessage to it.
Object.defineProperty(global, 'self', {
    writable: true,
    value: global
});
(global as any).postMessage = postMessageMock;

// Mock MLCEngine
vi.mock('@mlc-ai/web-llm', () => {
    return {
        // Use a regular function so it can be called with 'new'
        MLCEngine: vi.fn(function() {
            return {
                setInitProgressCallback: vi.fn(),
                reload: mockReload,
                chat: {
                    completions: {
                        create: mockChatCompletion
                    }
                }
            };
        })
    };
});

// Mock worker-utils
vi.mock('../worker-utils', () => ({
    getSystemPrompt: () => 'mock system prompt'
}));

// Import the worker file
import '../worker';

describe('Worker Local Generation', () => {
    beforeEach(() => {
        postMessageMock.mockClear();
        mockChatCompletion.mockReset();
        mockReload.mockResolvedValue(undefined);
    });

    it('should throttle messages (optimized)', async () => {
        // Setup mock to yield 20 chunks
        const chunks = Array.from({ length: 20 }, (_, i) => ({
            choices: [{ delta: { content: String(i % 10) } }]
        }));

        // Mock Date.now() to control time flow
        let currentTime = 1000;
        vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

        async function* chunkGenerator() {
            for (const chunk of chunks) {
                currentTime += 10;
                await new Promise(r => setTimeout(r, 1));
                yield chunk;
            }
        }

        mockChatCompletion.mockReturnValue(chunkGenerator());

        // Trigger generation
        const messageEvent = {
            data: {
                type: 'generate',
                text: 'input text',
                mode: 'proofread',
                settings: {
                    engine: 'local',
                    localModel: 'test-model'
                }
            }
        } as MessageEvent;

        if (self.onmessage) {
            await self.onmessage(messageEvent);
        }

        // Wait for completion
        await vi.waitFor(() => {
            const lastCall = postMessageMock.mock.lastCall;
            if (lastCall && lastCall[0].type === 'complete') {
                return true;
            }
            throw new Error('Processing not complete');
        }, { timeout: 1000, interval: 10 });

        const callCount = postMessageMock.mock.calls.length;

        // Expected behavior: significant reduction in IPC calls
        // Baseline would be 21 (20 chunks + 1 complete)
        // Optimized should be around 5 (4 throttled + 1 complete)
        expect(callCount).toBeLessThan(10);
        expect(callCount).toBeGreaterThan(0);

        // Verify final message has full text
        const expectedFullText = chunks.map(c => c.choices[0].delta.content).join('');
        expect(postMessageMock).toHaveBeenLastCalledWith(expect.objectContaining({
            type: 'complete',
            text: expectedFullText
        }));

        const lastCallArgs = postMessageMock.mock.calls[postMessageMock.mock.calls.length - 1][0];
        expect(lastCallArgs.text).toBe(expectedFullText);
    });
});
