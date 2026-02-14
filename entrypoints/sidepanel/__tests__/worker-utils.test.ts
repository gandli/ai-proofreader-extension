import { describe, it, expect } from 'vitest';
import { getSystemPrompt } from '../worker-utils';

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
});

import { validateApiBaseUrl } from '../worker-utils';

describe('validateApiBaseUrl', () => {
    it('should pass for valid HTTPS URLs', () => {
        expect(() => validateApiBaseUrl('https://api.example.com')).not.toThrow();
        expect(() => validateApiBaseUrl('https://api.openai.com/v1')).not.toThrow();
    });

    it('should pass for localhost HTTP URLs', () => {
        expect(() => validateApiBaseUrl('http://localhost:11434')).not.toThrow();
        expect(() => validateApiBaseUrl('http://127.0.0.1:8000')).not.toThrow();
        expect(() => validateApiBaseUrl('http://[::1]:8080')).not.toThrow();
    });

    it('should throw for non-local HTTP URLs', () => {
        expect(() => validateApiBaseUrl('http://api.example.com')).toThrow(/HTTPS/);
        expect(() => validateApiBaseUrl('http://192.168.1.1')).toThrow(/HTTPS/);
    });

    it('should throw for invalid URL formats', () => {
        expect(() => validateApiBaseUrl('not-a-url')).toThrow(/Invalid/);
        expect(() => validateApiBaseUrl('')).toThrow(/required/);
    });

    it('should throw for other protocols', () => {
        expect(() => validateApiBaseUrl('ftp://example.com')).toThrow(/HTTP or HTTPS/);
    });
});
