import { MLCEngine, InitProgressReport, ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import { getSystemPrompt } from "./worker-utils";
import type { Settings, ModeKey, WorkerInboundMessage } from "./types";
import { detectChromeAI, isChromeAIAvailable, processWithChromeAI, type ChromeAIStatus } from "./engines/chrome-ai";

// ---- Chrome AI status cache ----
let chromeAIStatus: ChromeAIStatus | null = null;

async function getChromeAIStatus(): Promise<ChromeAIStatus> {
    if (!chromeAIStatus) {
        chromeAIStatus = await detectChromeAI();
    }
    return chromeAIStatus;
}

// ---- WebLLM Engine ----

class WebLLMWorker {
    static engine: MLCEngine | null = null;
    static currentModel = "";
    static currentEngineType = "";

    static async getEngine(settings: Settings, onProgress?: (progress: InitProgressReport) => void) {
        const model = settings.localModel || "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
        const engineType = settings.engine || "local-gpu";

        if (!this.engine) {
            this.engine = new MLCEngine();
        }

        if (this.currentModel !== model || this.currentEngineType !== engineType) {
            if (onProgress) {
                this.engine.setInitProgressCallback(onProgress);
            }

            console.log(`[Worker] Loading WebLLM model: ${model} on ${engineType}`);
            try {
                await this.engine.reload(model, { context_window_size: 8192 });
                this.currentModel = model;
                this.currentEngineType = engineType;
            } catch (error) {
                this.currentModel = "";
                this.currentEngineType = "";
                throw error;
            }
        }

        return this.engine;
    }
}

interface QueueItem { text: string; mode: ModeKey; settings: Settings; requestId?: string }
const localRequestQueue: QueueItem[] = [];
let isLocalProcessing = false;

async function processLocalQueue() {
    if (isLocalProcessing || localRequestQueue.length === 0) return;
    isLocalProcessing = true;

    while (localRequestQueue.length > 0) {
        const { text, mode, settings, requestId } = localRequestQueue.shift()!;
        try {
            const systemPrompt = getSystemPrompt(mode, settings);
            const userContent = `【待处理文本】：\n${text}`;
            const engine = await WebLLMWorker.getEngine(settings);
            const messages: ChatCompletionMessageParam[] = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent },
            ];
            const chunks = await engine.chat.completions.create({ messages, stream: true });
            let fullText = "";
            for await (const chunk of chunks) {
                const content = chunk.choices[0]?.delta?.content || "";
                fullText += content;
                self.postMessage({ type: "update", text: fullText, mode, requestId });
            }
            self.postMessage({ type: "complete", text: fullText, mode, requestId });
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            self.postMessage({ type: "error", error: errMsg, mode, requestId });
        }
    }

    isLocalProcessing = false;
}

async function handleGenerateOnline(text: string, mode: ModeKey, settings: Settings, requestId?: string) {
    try {
        const systemPrompt = getSystemPrompt(mode, settings);
        const userContent = `【待处理文本】：\n${text}`;

        if (!settings.apiKey) throw new Error("请在设置中配置 API Key");

        const response = await fetch(`${settings.apiBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
                model: settings.apiModel,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                ],
                stream: true
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
            throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        if (reader) {
            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;
                    const dataStr = trimmed.slice(6).trim();
                    if (dataStr === '[DONE]') continue;
                    try {
                        const json = JSON.parse(dataStr) as { choices: Array<{ delta?: { content?: string } }> };
                        fullText += json.choices[0]?.delta?.content || "";
                        self.postMessage({ type: "update", text: fullText, mode, requestId });
                    } catch {
                        // Skip malformed SSE data lines rather than re-buffering to avoid infinite loops
                        console.warn('[Worker] Skipping malformed SSE data:', dataStr);
                    }
                }
            }
        }
        self.postMessage({ type: "complete", text: fullText, mode, requestId });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        self.postMessage({ type: "error", error: errMsg, mode, requestId });
    }
}

/** Handle generation using Chrome Built-in AI */
async function handleGenerateChromeAI(text: string, mode: ModeKey, settings: Settings, requestId?: string) {
    try {
        await processWithChromeAI(text, mode, settings, {
            onUpdate: (result) => {
                self.postMessage({ type: "update", text: result, mode, requestId });
            },
            onComplete: (result) => {
                self.postMessage({ type: "complete", text: result, mode, requestId });
            },
            onError: (error) => {
                self.postMessage({ type: "error", error, mode, requestId });
            },
        });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        self.postMessage({ type: "error", error: errMsg, mode, requestId });
    }
}

self.onmessage = async (event: MessageEvent<WorkerInboundMessage>) => {
    const msg = event.data;

    if (msg.type === "load") {
        // For chrome-ai engine, detect availability and report ready immediately
        if (msg.settings.engine === 'chrome-ai') {
            try {
                chromeAIStatus = await detectChromeAI();
                self.postMessage({ type: "ready" });
            } catch (error: unknown) {
                const errMsg = error instanceof Error ? error.message : String(error);
                self.postMessage({ type: "error", error: errMsg });
            }
            return;
        }

        // For online engine, no loading needed
        if (msg.settings.engine === 'online') {
            self.postMessage({ type: "ready" });
            return;
        }

        // For local engines, load WebLLM
        try {
            await WebLLMWorker.getEngine(msg.settings, (progress) => {
                self.postMessage({
                    type: "progress",
                    progress: { status: "progress", progress: progress.progress * 100, text: progress.text }
                });
            });
            self.postMessage({ type: "ready" });
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            self.postMessage({ type: "error", error: errMsg });
        }
    } else if (msg.type === "generate") {
        if (msg.settings.engine === 'chrome-ai') {
            // Use Chrome AI, with fallback to online if mode not available
            const status = await getChromeAIStatus();
            if (isChromeAIAvailable(status, msg.mode)) {
                handleGenerateChromeAI(msg.text, msg.mode, msg.settings, msg.requestId);
            } else if (msg.settings.apiKey) {
                // Fallback to online API for unavailable modes
                handleGenerateOnline(msg.text, msg.mode, msg.settings, msg.requestId);
            } else {
                self.postMessage({
                    type: "error",
                    error: `Chrome AI does not support ${msg.mode} mode and no online API is configured as fallback`,
                    mode: msg.mode,
                    requestId: msg.requestId,
                });
            }
        } else if (msg.settings.engine === 'online') {
            handleGenerateOnline(msg.text, msg.mode, msg.settings, msg.requestId);
        } else {
            localRequestQueue.push({ text: msg.text, mode: msg.mode, settings: msg.settings, requestId: msg.requestId });
            processLocalQueue();
        }
    }
};
