import { MLCEngine, InitProgress } from "@mlc-ai/web-llm";

class WebLLMWorker {
    static engine: MLCEngine | null = null;
    static currentModel = "";
    static currentEngineType = "";

    static async getEngine(settings: any, onProgress?: (progress: InitProgress) => void) {
        const model = settings?.localModel || "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
        const engineType = settings?.engine || "local-gpu";

        // Re-initialize if model or engine type changed
        if (this.engine && (this.currentModel !== model || this.currentEngineType !== engineType)) {
            console.log("[Worker] Settings changed, re-loading engine...");
            // WebLLM handles reloading internally with .reload(modelId)
        }

        if (!this.engine) {
            this.engine = new MLCEngine();
        }

        if (this.currentModel !== model || this.currentEngineType !== engineType) {
            this.currentModel = model;
            this.currentEngineType = engineType;

            if (onProgress) {
                this.engine.setInitProgressCallback(onProgress);
            }

            console.log(`[Worker] Loading WebLLM model: ${model} on ${engineType}`);
            // Note: engineType local-wasm can be hinted via appConfig if needed, 
            // but MLCEngine usually auto-detects. Forcing wasm requires special config.
            await this.engine.reload(model);
        }

        return this.engine;
    }
}

function getSystemPrompt(mode: string, settings: any) {
    const targetLang = settings?.extensionLanguage || "中文";
    const toneMap: Record<string, string> = {
        professional: "专业且正式",
        casual: "轻松且口语化",
        academic: "学术且严谨",
        concise: "极其简练"
    };
    const detailMap: Record<string, string> = {
        standard: "标准平衡",
        detailed: "丰富详尽",
        creative: "充满创意与文学性"
    };

    const selectedTone = toneMap[settings?.tone] || toneMap.professional;
    const selectedDetail = detailMap[settings?.detailLevel] || detailMap.standard;

    const baseConstraint = "。绝对禁止输出任何引言、解释、前后缀、对照或 Markdown 代码块。禁言废话，禁言元描述。";
    const resultCommand = `直接且仅输出 ${targetLang} 结果文本：`;

    const prompts: Record<string, string> = {
        summarize: `你是一个摘要提取工具。提取核心要点，保持客观简洁${baseConstraint}${resultCommand}`,
        correct: `你是一个文本校对助手。仅修复拼写、语法和标点错误，严禁改变原文风格${baseConstraint}${resultCommand}`,
        proofread: `你是一个文字润色编辑。提升文采，语气：${selectedTone}${baseConstraint}${resultCommand}`,
        translate: `你是一个专业翻译官。准则：信、达、雅。语气：${selectedTone}${baseConstraint}${resultCommand}`,
        expand: `你是一个内容扩写专家。丰富内容描述，详细度：${selectedDetail}${baseConstraint}${resultCommand}`
    };

    return (prompts[mode] || prompts.proofread) + "\n\n【注意】：严禁废话，不准解释，只返回处理后的内容。";
}

// Queue management for local inference
const localRequestQueue: { text: string; mode: string; settings: any }[] = [];
let isLocalProcessing = false;

async function processLocalQueue() {
    if (isLocalProcessing || localRequestQueue.length === 0) return;
    isLocalProcessing = true;

    while (localRequestQueue.length > 0) {
        const { text, mode, settings } = localRequestQueue.shift()!;
        try {
            const currentMode = mode || "proofread";
            console.log(`[Worker] Processing queued local task: ${currentMode}`);

            const systemPrompt = getSystemPrompt(currentMode, settings);
            const userContent = `【待处理文本】：\n${text}`;

            const engine = await WebLLMWorker.getEngine(settings);
            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent },
            ];

            const chunks = await engine.chat.completions.create({
                messages,
                stream: true,
            });

            let fullText = "";
            for await (const chunk of chunks) {
                const content = chunk.choices[0]?.delta?.content || "";
                fullText += content;
                self.postMessage({ type: "update", text: fullText, mode: currentMode });
            }
            console.log(`[Worker] Local Gen Complete. Mode: ${currentMode}`);
            self.postMessage({ type: "complete", text: fullText, mode: currentMode });
        } catch (error: any) {
            console.error("[Worker] Local Generate Error:", error);
            self.postMessage({ type: "error", error: error.message, mode: mode });
        }
    }

    isLocalProcessing = false;
}

async function handleGenerateOnline(text: string, mode: string, settings: any) {
    const currentMode = mode || "proofread";
    try {
        const systemPrompt = getSystemPrompt(currentMode, settings);
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
            const errorData = await response.json().catch(() => ({}));
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
                    if (!trimmed) continue;
                    if (trimmed.startsWith('data: ')) {
                        const dataStr = trimmed.slice(6).trim();
                        if (dataStr === '[DONE]') continue;
                        try {
                            const json = JSON.parse(dataStr);
                            const content = json.choices[0]?.delta?.content || "";
                            fullText += content;
                            self.postMessage({ type: "update", text: fullText, mode: currentMode });
                        } catch (e) {
                            buffer = line + '\n' + buffer;
                        }
                    }
                }
            }
        }
        self.postMessage({ type: "complete", text: fullText, mode: currentMode });
    } catch (error: any) {
        console.error("[Worker] Online Error:", error);
        self.postMessage({ type: "error", error: error.message, mode: currentMode });
    }
}

self.onmessage = async (event: MessageEvent) => {
    const { type, text, settings, mode } = event.data;

    if (type === "load") {
        try {
            await WebLLMWorker.getEngine(settings, (progress) => {
                self.postMessage({
                    type: "progress",
                    progress: { status: "progress", progress: progress.progress * 100, text: progress.text }
                });
            });
            self.postMessage({ type: "ready" });
        } catch (error: any) {
            self.postMessage({ type: "error", error: error.message });
        }
    } else if (type === "generate") {
        if (settings.engine === 'online') {
            handleGenerateOnline(text, mode, settings);
        } else {
            localRequestQueue.push({ text, mode, settings });
            processLocalQueue();
        }
    }
};
