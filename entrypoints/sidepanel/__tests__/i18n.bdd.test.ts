import { describe, it, expect } from 'vitest';
import { translations } from '../i18n';

describe('i18n translations (BDD)', () => {
  const supportedLanguages = ['中文', 'English', '日本語', '한국어', 'Français', 'Deutsch', 'Español'];

  describe('Given 7 supported languages', () => {
    it('should export exactly 7 languages', () => {
      expect(Object.keys(translations)).toHaveLength(7);
    });

    supportedLanguages.forEach(lang => {
      it(`should include language: ${lang}`, () => {
        expect(translations).toHaveProperty(lang);
      });
    });
  });

  describe('Given translation key consistency', () => {
    const referenceKeys = Object.keys(translations['中文']).sort();

    supportedLanguages.forEach(lang => {
      it(`should have the same keys as 中文 for language: ${lang}`, () => {
        const keys = Object.keys(translations[lang]).sort();
        expect(keys).toEqual(referenceKeys);
      });
    });
  });

  describe('Given no empty translation values', () => {
    supportedLanguages.forEach(lang => {
      it(`should have no empty string values for language: ${lang}`, () => {
        const entries = Object.entries(translations[lang]);
        const empty = entries.filter(([, v]) => v === '');
        expect(empty).toHaveLength(0);
      });
    });
  });

  describe('Given mode-related keys', () => {
    const modeKeys = ['mode_summarize', 'mode_correct', 'mode_proofread', 'mode_translate', 'mode_expand'];
    const resultKeys = ['result_summarize', 'result_correct', 'result_proofread', 'result_translate', 'result_expand'];

    supportedLanguages.forEach(lang => {
      it(`should have all mode keys for ${lang}`, () => {
        for (const key of modeKeys) {
          expect(translations[lang]).toHaveProperty(key);
          expect(translations[lang][key]).toBeTruthy();
        }
      });

      it(`should have all result keys for ${lang}`, () => {
        for (const key of resultKeys) {
          expect(translations[lang]).toHaveProperty(key);
          expect(translations[lang][key]).toBeTruthy();
        }
      });
    });
  });

  describe('Given status keys', () => {
    const statusKeys = ['status_idle', 'status_loading', 'status_ready_local', 'status_ready_online', 'status_generating', 'status_error'];

    supportedLanguages.forEach(lang => {
      it(`should have all status keys for ${lang}`, () => {
        for (const key of statusKeys) {
          expect(translations[lang]).toHaveProperty(key);
        }
      });
    });
  });

  describe('Given i18n keys added for review fixes', () => {
    // These keys exist on refactor/code-review-fixes branch (PR #50)
    // Tests serve as regression checks when merging
    const reviewKeys = [
      'click_to_reset',
      'connection_error',
      'no_cached_files',
      'api_base_url',
      'api_key',
      'model_id',
      'invalid_url',
      'url_must_be_http',
    ];

    // Only run if keys exist (branch-dependent)
    const hasReviewKeys = translations['中文']?.click_to_reset !== undefined;

    supportedLanguages.forEach(lang => {
      it.skipIf(!hasReviewKeys)(`should have all review-fix i18n keys for ${lang}`, () => {
        for (const key of reviewKeys) {
          expect(translations[lang]).toHaveProperty(key);
          expect(translations[lang][key]).toBeTruthy();
        }
      });
    });

    it.skipIf(!hasReviewKeys)('should have Spanish click_to_reset translated (not English)', () => {
      expect(translations['Español'].click_to_reset).not.toBe('Click to Reset');
    });

    it.skipIf(!hasReviewKeys)('should have Spanish action_btn_load with correct spelling (Activar not Activer)', () => {
      expect(translations['Español'].action_btn_load).toContain('Activar');
      expect(translations['Español'].action_btn_load).not.toContain('Activer');
    });
  });
});
