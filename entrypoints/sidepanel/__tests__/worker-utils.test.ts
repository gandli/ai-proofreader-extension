import { describe, it, expect } from 'vitest';
import { getSystemPrompt } from '../worker-utils';
import type { Settings } from '../types';

describe('getSystemPrompt', () => {
    const defaultSettings: Partial<Settings> = {
        extensionLanguage: '中文',
        tone: 'professional',
        detailLevel: 'standard'
    };

    it('should generate correct prompt for summarize mode', () => {
        const prompt = getSystemPrompt('summarize', defaultSettings);
        expect(prompt).toContain('你是一个专业的首席速读官');
        expect(prompt).toContain('直接且仅输出 中文 结果文本');
    });

    it('should respect target language', () => {
        const settings: Partial<Settings> = { ...defaultSettings, extensionLanguage: 'English' };
        const prompt = getSystemPrompt('proofread', settings);
        expect(prompt).toContain('直接且仅输出 English 结果文本');
    });

    it('should respect tone', () => {
        const settings: Partial<Settings> = { ...defaultSettings, tone: 'casual' };
        const prompt = getSystemPrompt('proofread', settings);
        expect(prompt).toContain('轻松且口语化');
    });

    it('should respect detail level', () => {
        const settings: Partial<Settings> = { ...defaultSettings, detailLevel: 'creative' };
        const prompt = getSystemPrompt('expand', settings);
        expect(prompt).toContain('充满创意与文学性');
    });

    it('should fallback to proofread if mode is unknown', () => {
        const prompt = getSystemPrompt('unknown_mode', defaultSettings);
        expect(prompt).toContain('你是一个大厂资深文案编辑');
    });
});
