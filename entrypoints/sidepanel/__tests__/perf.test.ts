import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock self and postMessage
const postMessageMock = vi.fn();
global.self = {
  postMessage: postMessageMock,
  onmessage: null,
} as any;

// Mock WebLLM to avoid loading actual engine
vi.mock("@mlc-ai/web-llm", () => ({
  MLCEngine: class {},
  InitProgressReport: {},
  ChatCompletionMessageParam: {},
}));

// Mock worker-utils
vi.mock("../worker-utils", () => ({
  getSystemPrompt: () => "mock system prompt",
}));

describe('Worker Performance', () => {
  beforeEach(async () => {
    vi.resetModules();
    postMessageMock.mockClear();
    // Re-import to trigger self.onmessage assignment
    await import('../worker');
  });

  it('should measure IPC frequency for online generation', async () => {
    const chunkCount = 1000;
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < chunkCount; i++) {
          const chunk = JSON.stringify({
            choices: [{ delta: { content: 'a' } }]
          });
          controller.enqueue(new TextEncoder().encode(`data: ${chunk}\n\n`));
        }
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
      json: () => Promise.resolve({}),
    });
    global.fetch = fetchMock;

    // Trigger generation
    const onMessage = global.self.onmessage as any;
    if (!onMessage) throw new Error("onmessage not defined");

    await onMessage({
      data: {
        type: 'generate',
        text: 'test input',
        mode: 'test',
        settings: {
          engine: 'online',
          apiKey: 'sk-test',
          apiBaseUrl: 'https://api.test',
          apiModel: 'gpt-3.5-turbo'
        }
      }
    });

    // Wait for completion
    await vi.waitFor(() => {
      const calls = postMessageMock.mock.calls;
      const lastCall = calls[calls.length - 1];
      if (!lastCall) throw new Error("No messages yet");
      if (lastCall[0].type === 'error') throw new Error(lastCall[0].error);
      if (lastCall[0].type === 'complete') return;
      throw new Error("Not completed yet");
    }, { timeout: 1000, interval: 10 });

    // Count update messages
    const updateCalls = postMessageMock.mock.calls.filter(call => call[0].type === 'update');
    console.log(`Total update messages: ${updateCalls.length}`);

    // With throttling (50ms), and fast execution, we expect significantly fewer messages than chunks
    expect(updateCalls.length).toBeLessThan(chunkCount / 2);

    // Verify content integrity
    const completeCall = postMessageMock.mock.calls.find(call => call[0].type === 'complete');
    if (!completeCall) throw new Error("No complete call found");
    // 1000 chunks of "a" -> "a".repeat(1000)
    expect(completeCall[0].text.length).toBe(chunkCount);
    expect(completeCall[0].text).toBe("a".repeat(chunkCount));
  });
});
