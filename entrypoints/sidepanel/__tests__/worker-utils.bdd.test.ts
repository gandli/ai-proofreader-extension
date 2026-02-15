import { describe, it, expect } from 'vitest';
import { getSystemPrompt } from '../worker-utils';
import { TONE_MAP, DETAIL_MAP, BASE_CONSTRAINT, SUFFIX_CONSTRAINT, PROMPTS } from '../prompts';
import type { Settings } from '../types';

describe('getSystemPrompt', () => {
  const defaults: Partial<Settings> = {
    extensionLanguage: '中文',
    tone: 'professional',
    detailLevel: 'standard',
  };

  describe('Given a valid mode', () => {
    const modes = ['summarize', 'correct', 'proofread', 'translate', 'expand'];

    modes.forEach(mode => {
      it(`should generate a prompt for "${mode}" mode`, () => {
        const prompt = getSystemPrompt(mode, defaults);
        expect(prompt).toBeTruthy();
        expect(prompt.length).toBeGreaterThan(50);
      });

      it(`should include base constraint for "${mode}" mode`, () => {
        const prompt = getSystemPrompt(mode, defaults);
        expect(prompt).toContain(BASE_CONSTRAINT);
      });

      it(`should include suffix constraint for "${mode}" mode`, () => {
        const prompt = getSystemPrompt(mode, defaults);
        expect(prompt).toContain(SUFFIX_CONSTRAINT);
      });

      it(`should include target language for "${mode}" mode`, () => {
        const prompt = getSystemPrompt(mode, defaults);
        expect(prompt).toContain('直接且仅输出 中文 结果文本');
      });
    });
  });

  describe('Given different target languages', () => {
    it('should use English when extensionLanguage is English', () => {
      const prompt = getSystemPrompt('summarize', { ...defaults, extensionLanguage: 'English' });
      expect(prompt).toContain('直接且仅输出 English 结果文本');
    });

    it('should use 日本語 when extensionLanguage is 日本語', () => {
      const prompt = getSystemPrompt('summarize', { ...defaults, extensionLanguage: '日本語' });
      expect(prompt).toContain('直接且仅输出 日本語 结果文本');
    });

    it('should fallback to 中文 when extensionLanguage is undefined', () => {
      const prompt = getSystemPrompt('summarize', { tone: 'professional', detailLevel: 'standard' });
      expect(prompt).toContain('直接且仅输出 中文 结果文本');
    });
  });

  describe('Given different tones', () => {
    Object.entries(TONE_MAP).forEach(([tone, label]) => {
      it(`should apply "${tone}" tone as "${label}"`, () => {
        const prompt = getSystemPrompt('proofread', { ...defaults, tone: tone as Settings['tone'] });
        expect(prompt).toContain(label);
      });
    });

    it('should fallback to professional tone when tone is undefined', () => {
      const prompt = getSystemPrompt('proofread', { extensionLanguage: '中文', detailLevel: 'standard' });
      expect(prompt).toContain(TONE_MAP.professional);
    });
  });

  describe('Given different detail levels', () => {
    Object.entries(DETAIL_MAP).forEach(([level, label]) => {
      it(`should apply "${level}" detail level as "${label}"`, () => {
        const prompt = getSystemPrompt('expand', { ...defaults, detailLevel: level as Settings['detailLevel'] });
        expect(prompt).toContain(label);
      });
    });

    it('should fallback to standard detail level when detailLevel is undefined', () => {
      const prompt = getSystemPrompt('expand', { extensionLanguage: '中文', tone: 'professional' });
      expect(prompt).toContain(DETAIL_MAP.standard);
    });
  });

  describe('Given an unknown mode', () => {
    it('should fallback to proofread prompt', () => {
      const prompt = getSystemPrompt('nonexistent_mode', defaults);
      expect(prompt).toContain(PROMPTS.proofread.replace('{tone}', TONE_MAP.professional));
    });
  });

  describe('Given mode-specific prompt content', () => {
    it('should contain summarize role description for summarize mode', () => {
      const prompt = getSystemPrompt('summarize', defaults);
      expect(prompt).toContain('首席速读官');
    });

    it('should contain correct role description for correct mode', () => {
      const prompt = getSystemPrompt('correct', defaults);
      expect(prompt).toContain('校对员');
    });

    it('should contain proofread role description for proofread mode', () => {
      const prompt = getSystemPrompt('proofread', defaults);
      expect(prompt).toContain('文案编辑');
    });

    it('should contain translate role description for translate mode', () => {
      const prompt = getSystemPrompt('translate', defaults);
      expect(prompt).toContain('翻译专家');
    });

    it('should contain expand role description for expand mode', () => {
      const prompt = getSystemPrompt('expand', defaults);
      expect(prompt).toContain('创意写作');
    });
  });
});
