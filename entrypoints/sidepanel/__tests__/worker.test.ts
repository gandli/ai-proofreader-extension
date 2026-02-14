// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processLocalQueue, localRequestQueue, resetState } from '../worker';
import { WebLLMWorker } from '../web-llm-worker';

// Mock WebLLMWorker
vi.mock('../web-llm-worker', () => ({
    WebLLMWorker: {
        getEngine: vi.fn(),
    },
}));

// Mock worker-utils
vi.mock('../worker-utils', () => ({
    getSystemPrompt: vi.fn((mode) => `System prompt for ${mode}`),
}));

describe('processLocalQueue', () => {
    let postMessageSpy: any;

    beforeEach(() => {
        // Mock self.postMessage
        // In happy-dom, self is the window/global object.
        // We need to ensure postMessage exists before spying or just assign a mock if it doesn't.
        if (!self.postMessage) {
            (self as any).postMessage = vi.fn();
        }
        postMessageSpy = vi.spyOn(self, 'postMessage').mockImplementation(() => {});

        // Reset state
        resetState();
        // Clear mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return early if queue is empty', async () => {
        await processLocalQueue();
        expect(WebLLMWorker.getEngine).not.toHaveBeenCalled();
        expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it('should process item in queue successfully', async () => {
        const mockEngine = {
            chat: {
                completions: {
                    create: vi.fn().mockResolvedValue([
                        { choices: [{ delta: { content: 'Hello' } }] },
                        { choices: [{ delta: { content: ' World' } }] },
                    ]),
                },
            },
        };
        (WebLLMWorker.getEngine as any).mockResolvedValue(mockEngine);

        localRequestQueue.push({ text: 'test input', mode: 'proofread', settings: { localModel: 'model-1' } });

        await processLocalQueue();

        expect(WebLLMWorker.getEngine).toHaveBeenCalledWith({ localModel: 'model-1' });
        expect(mockEngine.chat.completions.create).toHaveBeenCalled();

        // Check postMessage calls
        // 1. Update "Hello"
        expect(postMessageSpy).toHaveBeenCalledWith({ type: 'update', text: 'Hello', mode: 'proofread' });
        // 2. Update "Hello World"
        // expect(postMessageSpy).toHaveBeenCalledWith({ type: 'update', text: 'Hello World', mode: 'proofread' });
        // 3. Complete
        expect(postMessageSpy).toHaveBeenCalledWith({ type: 'complete', text: 'Hello World', mode: 'proofread' });
    });

    it('should handle errors gracefully', async () => {
        const error = new Error('Engine failure');
        (WebLLMWorker.getEngine as any).mockRejectedValue(error);

        localRequestQueue.push({ text: 'test input', mode: 'proofread', settings: {} });

        await processLocalQueue();

        expect(postMessageSpy).toHaveBeenCalledWith({
            type: 'error',
            error: 'Engine failure',
            mode: 'proofread'
        });
    });

    it('should process multiple items sequentially', async () => {
        const mockEngine = {
            chat: {
                completions: {
                    create: vi.fn()
                        .mockResolvedValueOnce([{ choices: [{ delta: { content: 'Result 1' } }] }])
                        .mockResolvedValueOnce([{ choices: [{ delta: { content: 'Result 2' } }] }]),
                },
            },
        };
        (WebLLMWorker.getEngine as any).mockResolvedValue(mockEngine);

        localRequestQueue.push({ text: 'input 1', mode: 'mode1', settings: {} });
        localRequestQueue.push({ text: 'input 2', mode: 'mode2', settings: {} });

        await processLocalQueue();

        expect(mockEngine.chat.completions.create).toHaveBeenCalledTimes(2);

        expect(postMessageSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'complete', text: 'Result 1', mode: 'mode1' }));
        expect(postMessageSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'complete', text: 'Result 2', mode: 'mode2' }));
    });
});
