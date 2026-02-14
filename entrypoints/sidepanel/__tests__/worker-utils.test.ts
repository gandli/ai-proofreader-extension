import { describe, it, expect } from 'vitest';
import { getSystemPrompt } from '../worker-utils';
import { Settings, ModeKey } from '../types';

describe('getSystemPrompt', () => {
    const defaultSettings: Settings = {
        extensionLanguage: '中文',
        tone: 'professional',
        detailLevel: 'standard',
        engine: 'local-gpu',
        localModel: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        apiModel: 'gpt-3.5-turbo',
        autoSpeak: false
    };

    it('should generate correct prompt for summarize mode', () => {
        const prompt = getSystemPrompt('summarize', defaultSettings);
        // Assuming summarize prompt contains something specific, but memory/test content showed specific strings.
        // Wait, I am overwriting the file. I need to make sure I preserve the expectations correctly.
        // The original test had specific expectations.
        expect(prompt).toContain('你是一个专业的首席速读官'); // From prompts.ts content seen earlier
        expect(prompt).toContain('直接且仅输出 中文 结果文本');
    });

    it('should respect target language', () => {
        const settings = { ...defaultSettings, extensionLanguage: 'English' };
        const prompt = getSystemPrompt('proofread', settings);
        expect(prompt).toContain('直接且仅输出 English 结果文本');
    });

    it('should respect tone', () => {
        const settings = { ...defaultSettings, tone: 'casual' };
        const prompt = getSystemPrompt('proofread', settings);
        expect(prompt).toContain('轻松且口语化'); // "casual" maps to "轻松且口语化"
    });

    it('should respect detail level', () => {
        const settings = { ...defaultSettings, detailLevel: 'creative' };
        const prompt = getSystemPrompt('expand', settings);
        expect(prompt).toContain('充满创意与文学性'); // "creative" maps to "充满创意与文学性"
    });

    it('should fallback to proofread if mode is unknown', () => {
        const prompt = getSystemPrompt('unknown_mode' as ModeKey, defaultSettings);
        expect(prompt).toContain('你是一个大厂资深文案编辑'); // "proofread" prompt starts with this
    });
});
