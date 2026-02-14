import { TONE_MAP, DETAIL_MAP, BASE_CONSTRAINT, SUFFIX_CONSTRAINT, PROMPTS } from './prompts';

export function getSystemPrompt(mode: string, settings: any) {
    const targetLang = settings?.extensionLanguage || "中文";

    const selectedTone = TONE_MAP[settings?.tone] || TONE_MAP.professional;
    const selectedDetail = DETAIL_MAP[settings?.detailLevel] || DETAIL_MAP.standard;

    const resultCommand = `直接且仅输出 ${targetLang} 结果文本：`;

    let promptTemplate = PROMPTS[mode] || PROMPTS.proofread;

    // Replace placeholders if they exist
    promptTemplate = promptTemplate.replace("{tone}", selectedTone);
    promptTemplate = promptTemplate.replace("{detail}", selectedDetail);

    return `${promptTemplate}${BASE_CONSTRAINT}${resultCommand}${SUFFIX_CONSTRAINT}`;
}

export function validateApiBaseUrl(url: string): void {
    if (!url) {
        throw new Error("API Base URL is required");
    }

    let urlObj: URL;
    try {
        urlObj = new URL(url);
    } catch (e) {
        throw new Error("Invalid API Base URL format");
    }

    if (urlObj.protocol === 'https:') {
        return;
    }

    if (urlObj.protocol === 'http:') {
        const hostname = urlObj.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
            return;
        }
        throw new Error("API Base URL must use HTTPS, unless it is a local address (localhost, 127.0.0.1)");
    }

    throw new Error("API Base URL must use HTTP or HTTPS protocol");
}
