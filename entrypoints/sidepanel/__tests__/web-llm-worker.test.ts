// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebLLMWorker } from '../web-llm-worker';
import * as webllm from '@mlc-ai/web-llm';

// Mock WebLLM
vi.mock('@mlc-ai/web-llm', () => {
    return {
        MLCEngine: vi.fn(function() {
            return {
                reload: vi.fn().mockResolvedValue(undefined),
                setInitProgressCallback: vi.fn(),
                setAppConfig: vi.fn(),
                chat: { completions: { create: vi.fn() } }
            };
        }),
        prebuiltAppConfig: { model_list: [] }
    };
});

describe('WebLLMWorker', () => {
    beforeEach(() => {
        // Reset static properties
        WebLLMWorker.engine = null;
        WebLLMWorker.currentModel = "";
        WebLLMWorker.currentEngineType = "";
        vi.clearAllMocks();
    });

    it('should initialize engine and set appConfig with hint for local-wasm', async () => {
        const settings = { engine: 'local-wasm', localModel: 'test-model' };

        await WebLLMWorker.getEngine(settings);

        expect(webllm.MLCEngine).toHaveBeenCalled();
        const engineInstance = (webllm.MLCEngine as any).mock.results[0].value;

        expect(engineInstance.setAppConfig).toHaveBeenCalledWith(
            expect.objectContaining({
                engineType: 'wasm',
                model_list: []
            })
        );
        expect(engineInstance.reload).toHaveBeenCalledWith('test-model');
    });

    it('should initialize engine and set default appConfig for local-gpu', async () => {
        const settings = { engine: 'local-gpu', localModel: 'test-model-gpu' };

        await WebLLMWorker.getEngine(settings);

        expect(webllm.MLCEngine).toHaveBeenCalled();
        const engineInstance = (webllm.MLCEngine as any).mock.results[0].value;

        // It should call setAppConfig with default config (no engineType: 'wasm')
        expect(engineInstance.setAppConfig).toHaveBeenCalledWith(
            expect.objectContaining({
                model_list: []
            })
        );

        // Verify engineType: 'wasm' is NOT present
        const callArgs = engineInstance.setAppConfig.mock.calls[0][0];
        expect(callArgs.engineType).toBeUndefined();

        expect(engineInstance.reload).toHaveBeenCalledWith('test-model-gpu');
    });
});
