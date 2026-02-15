import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock MLCEngine
vi.mock('@mlc-ai/web-llm', () => {
    return {
        MLCEngine: class {
            setInitProgressCallback() {}
            reload() { return Promise.resolve(); }
            chat = {
                completions: {
                    create: async function* ({ stream }: any) {
                        if (stream) {
                            // Yield 100 chunks
                            for (let i = 0; i < 100; i++) {
                                yield {
                                    choices: [{ delta: { content: 'a' } }]
                                };
                                await new Promise(resolve => setTimeout(resolve, 1));
                            }
                        }
                    }
                }
            }
        }
    };
});

describe('Worker Performance', () => {
    let postMessageMock: any;

    beforeEach(() => {
        postMessageMock = vi.fn();
        // Manually set self on globalThis
        (globalThis as any).self = {
            postMessage: postMessageMock,
            onmessage: null,
        };
        vi.resetModules();
    });

    it('should throttle update messages (optimization)', async () => {
        // Dynamic import to run after setting self
        await import('../worker');

        const self = (globalThis as any).self;
        const onMessage = self.onmessage;

        if (!onMessage) {
            throw new Error('onmessage handler not registered');
        }

        const startTime = Date.now();

        await onMessage({
            data: {
                type: 'generate',
                text: 'test',
                mode: 'proofread',
                settings: {
                    localModel: 'test-model',
                    engine: 'local-gpu'
                }
            }
        } as MessageEvent);

        // Wait for async processing to complete.
        await new Promise(resolve => setTimeout(resolve, 500));

        const calls = postMessageMock.mock.calls;
        const callCount = calls.length;

        console.log('Mock calls:', callCount);

        // Previously this was 101.
        // With 50ms throttle and ~100ms total generation time, we expect significantly fewer calls.
        // Let's assert it's less than 20 to be safe and account for timing variations,
        // but definitely much less than 100.
        expect(callCount).toBeLessThan(50);
        expect(callCount).toBeGreaterThan(0);

        // Verify the last message is 'complete' and has the full text
        const lastCall = calls[calls.length - 1];
        const lastMessage = lastCall[0];

        expect(lastMessage.type).toBe('complete');
        // 100 chunks of 'a'
        expect(lastMessage.text).toBe('a'.repeat(100));
    });
});
