import { TONE_MAP, DETAIL_MAP, BASE_CONSTRAINT, SUFFIX_CONSTRAINT, PROMPTS } from './prompts';
import { Settings } from './types';

export function getSystemPrompt(mode: string, settings: Partial<Settings>) {
    const targetLang = settings?.extensionLanguage || "中文";

    const selectedTone = TONE_MAP[settings?.tone ?? 'professional'] || TONE_MAP.professional;
    const selectedDetail = DETAIL_MAP[settings?.detailLevel ?? 'standard'] || DETAIL_MAP.standard;

    const resultCommand = `直接且仅输出 ${targetLang} 结果文本：`;

    let promptTemplate = PROMPTS[mode] || PROMPTS.proofread;

    promptTemplate = promptTemplate.replace("{tone}", selectedTone);
    promptTemplate = promptTemplate.replace("{detail}", selectedDetail);

    return `${promptTemplate}${BASE_CONSTRAINT}${resultCommand}${SUFFIX_CONSTRAINT}`;
}
