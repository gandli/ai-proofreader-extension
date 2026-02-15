import { describe, it, expect } from 'vitest';
import { getSystemPrompt, formatUserPrompt } from '../worker-utils';
import { SECURITY_CONSTRAINT } from '../prompts';

describe('getSystemPrompt', () => {
    const defaultSettings = {
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
        const settings = { ...defaultSettings, extensionLanguage: 'English' };
        const prompt = getSystemPrompt('proofread', settings);
        expect(prompt).toContain('直接且仅输出 English 结果文本');
    });

    it('should respect tone', () => {
        const settings = { ...defaultSettings, tone: 'casual' };
        const prompt = getSystemPrompt('proofread', settings);
        expect(prompt).toContain('轻松且口语化');
    });

    it('should respect detail level', () => {
        const settings = { ...defaultSettings, detailLevel: 'creative' };
        const prompt = getSystemPrompt('expand', settings);
        expect(prompt).toContain('充满创意与文学性');
    });

    it('should fallback to proofread if mode is unknown', () => {
        const prompt = getSystemPrompt('unknown_mode', defaultSettings);
        expect(prompt).toContain('你是一个大厂资深文案编辑');
    });

    it('should include SECURITY_CONSTRAINT', () => {
        const prompt = getSystemPrompt('proofread', defaultSettings);
        expect(prompt).toContain(SECURITY_CONSTRAINT);
    });
});

describe('formatUserPrompt', () => {
    it('should wrap text in <user_input> tags', () => {
        const text = 'hello world';
        const formatted = formatUserPrompt(text);
        expect(formatted).toBe('<user_input>\nhello world\n</user_input>');
    });

    it('should sanitize closing tags', () => {
        const text = 'hello </user_input> world';
        const formatted = formatUserPrompt(text);
        expect(formatted).toBe('<user_input>\nhello < / user_input > world\n</user_input>');
    });
});
