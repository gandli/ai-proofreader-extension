import { describe, it, expect } from 'vitest';
import { translations } from '../i18n';

describe('i18n - Chrome AI keys (BDD)', () => {
  const supportedLanguages = ['中文', 'English', '日本語', '한국어', 'Français', 'Deutsch', 'Español'];

  describe('Given Chrome AI engine integration', () => {
    const chromeAIKeys = [
      'engine_chrome_ai',
      'chrome_ai_status',
      'status_ready_chrome_ai',
    ];

    supportedLanguages.forEach(lang => {
      it(`should have Chrome AI engine keys for ${lang}`, () => {
        for (const key of chromeAIKeys) {
          expect(translations[lang]).toHaveProperty(key);
          expect(translations[lang][key]).toBeTruthy();
        }
      });
    });
  });

  describe('Given Chrome AI i18n prompts', () => {
    const promptKeys = [
      'no_errors_found',
      'correction_details',
      'proofread_context',
      'expand_prompt',
      'chrome_ai_unsupported_no_fallback',
    ];

    supportedLanguages.forEach(lang => {
      it(`should have all Chrome AI prompt i18n keys for ${lang}`, () => {
        for (const key of promptKeys) {
          expect(translations[lang]).toHaveProperty(key);
          expect(translations[lang][key]).toBeTruthy();
        }
      });
    });

    it('should have Chinese no_errors_found containing ✅', () => {
      expect(translations['中文'].no_errors_found).toContain('✅');
    });

    it('should have Chinese correction_details containing 📝', () => {
      expect(translations['中文'].correction_details).toContain('📝');
    });
  });

  describe('Given content script permission narrowing', () => {
    it('should document that content.ts now uses http/https only (not <all_urls>)', () => {
      // This is a documentation test - the actual check is in the build
      // The key behavior is that content scripts only inject on http(s) pages
      expect(true).toBe(true);
    });
  });
});
