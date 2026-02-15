/**
 * BDD Tests: Chrome Built-in AI Engine Features (PR #51)
 */
import { describe, it, expect } from 'vitest';
import {
  isChromeAIAvailable,
  MODE_API_MAP,
  type ChromeAIStatus,
  type ChromeAITranslations,
} from '../engines/chrome-ai';
import {
  getRecommendations,
  hasAnyChromeAI,
  type EngineAvailability,
} from '../engines/engine-manager';
import { translations } from '../i18n';
import type { ModeKey } from '../types';

// ============================================================
// Feature: Chrome Built-in AI as First-Priority Engine
// ============================================================
describe('Feature: Chrome Built-in AI Integration', () => {
  describe('Scenario: All 5 modes map to native Chrome AI APIs', () => {
    const expectedMapping: Record<ModeKey, string> = {
      summarize: 'Summarizer',
      correct: 'Proofreader',
      proofread: 'Rewriter',
      translate: 'Translator',
      expand: 'Writer',
    };

    Object.entries(expectedMapping).forEach(([mode, api]) => {
      it(`Given ${mode} mode, When mapped to Chrome AI, Then it uses ${api} API`, () => {
        expect(MODE_API_MAP[mode as ModeKey]).toBe(api);
      });
    });
  });

  describe('Scenario: Chrome AI availability detection per mode', () => {
    it('Given Summarizer is available, When checking summarize, Then it reports available', () => {
      const status: ChromeAIStatus = {
        summarize: 'available', correct: 'unavailable', proofread: 'unavailable',
        translate: 'unavailable', expand: 'unavailable',
      };
      expect(isChromeAIAvailable(status, 'summarize')).toBe(true);
    });

    it('Given Proofreader is experimental, When checking correct, Then it reports available', () => {
      const status: ChromeAIStatus = {
        summarize: 'unavailable', correct: 'experimental', proofread: 'unavailable',
        translate: 'unavailable', expand: 'unavailable',
      };
      expect(isChromeAIAvailable(status, 'correct')).toBe(true);
    });

    it('Given Rewriter is unavailable, When checking proofread, Then it reports unavailable', () => {
      const status: ChromeAIStatus = {
        summarize: 'available', correct: 'available', proofread: 'unavailable',
        translate: 'available', expand: 'available',
      };
      expect(isChromeAIAvailable(status, 'proofread')).toBe(false);
    });
  });
});

// ============================================================
// Feature: Engine Priority System
// ============================================================
describe('Feature: Engine Priority (Chrome AI → WebGPU → WASM → Online)', () => {
  const allChromeAI: ChromeAIStatus = {
    summarize: 'available', correct: 'available', proofread: 'available',
    translate: 'available', expand: 'available',
  };
  const noChromeAI: ChromeAIStatus = {
    summarize: 'unavailable', correct: 'unavailable', proofread: 'unavailable',
    translate: 'unavailable', expand: 'unavailable',
  };

  describe('Scenario: All engines available', () => {
    it('Given Chrome AI + WebGPU + WASM all available, When auto-selecting, Then Chrome AI is chosen', () => {
      const avail: EngineAvailability = { chromeAI: allChromeAI, webGPU: true, wasm: true };
      const recs = getRecommendations(avail);
      recs.forEach(rec => expect(rec.bestEngine).toBe('chrome-ai'));
    });
  });

  describe('Scenario: Chrome AI unavailable, fallback to WebGPU', () => {
    it('Given no Chrome AI but WebGPU available, When auto-selecting, Then local-gpu is chosen', () => {
      const avail: EngineAvailability = { chromeAI: noChromeAI, webGPU: true, wasm: true };
      const recs = getRecommendations(avail);
      recs.forEach(rec => expect(rec.bestEngine).toBe('local-gpu'));
    });
  });

  describe('Scenario: Only WASM available', () => {
    it('Given no Chrome AI, no WebGPU, but WASM available, When auto-selecting, Then local-wasm is chosen', () => {
      const avail: EngineAvailability = { chromeAI: noChromeAI, webGPU: false, wasm: true };
      const recs = getRecommendations(avail);
      recs.forEach(rec => expect(rec.bestEngine).toBe('local-wasm'));
    });
  });

  describe('Scenario: No local engines, fallback to online', () => {
    it('Given nothing available locally, When auto-selecting, Then online API is chosen', () => {
      const avail: EngineAvailability = { chromeAI: noChromeAI, webGPU: false, wasm: false };
      const recs = getRecommendations(avail);
      recs.forEach(rec => expect(rec.bestEngine).toBe('online'));
    });
  });

  describe('Scenario: User manually selects engine', () => {
    it('Given user selects online, When Chrome AI is available, Then user choice is respected', () => {
      const avail: EngineAvailability = { chromeAI: allChromeAI, webGPU: true, wasm: true };
      const recs = getRecommendations(avail, 'online');
      recs.forEach(rec => expect(rec.bestEngine).toBe('online'));
    });

    it('Given user selects local-wasm, When Chrome AI is available, Then user choice is respected', () => {
      const avail: EngineAvailability = { chromeAI: allChromeAI, webGPU: true, wasm: true };
      const recs = getRecommendations(avail, 'local-wasm');
      recs.forEach(rec => expect(rec.bestEngine).toBe('local-wasm'));
    });

    it('Given user selects chrome-ai, When detecting, Then auto-detection runs (same as default)', () => {
      const avail: EngineAvailability = { chromeAI: allChromeAI, webGPU: true, wasm: true };
      const recs = getRecommendations(avail, 'chrome-ai');
      recs.forEach(rec => expect(rec.bestEngine).toBe('chrome-ai'));
    });
  });

  describe('Scenario: Mixed Chrome AI availability per mode', () => {
    it('Given Chrome AI available for some modes, When auto-selecting, Then each mode gets best engine independently', () => {
      const mixed: ChromeAIStatus = {
        summarize: 'available',
        correct: 'unavailable',
        proofread: 'experimental',
        translate: 'available',
        expand: 'unavailable',
      };
      const avail: EngineAvailability = { chromeAI: mixed, webGPU: true, wasm: true };
      const recs = getRecommendations(avail);

      const recMap = Object.fromEntries(recs.map(r => [r.mode, r.bestEngine]));
      expect(recMap.summarize).toBe('chrome-ai');
      expect(recMap.correct).toBe('local-gpu');    // fallback
      expect(recMap.proofread).toBe('chrome-ai');  // experimental counts
      expect(recMap.translate).toBe('chrome-ai');
      expect(recMap.expand).toBe('local-gpu');     // fallback
    });
  });
});

// ============================================================
// Feature: Chrome AI Any-Mode Detection
// ============================================================
describe('Feature: Chrome AI Availability Summary', () => {
  describe('Scenario: Checking if any Chrome AI capability exists', () => {
    it('Given at least one mode available, When checking, Then hasAnyChromeAI is true', () => {
      const status: ChromeAIStatus = {
        summarize: 'available', correct: 'unavailable', proofread: 'unavailable',
        translate: 'unavailable', expand: 'unavailable',
      };
      expect(hasAnyChromeAI(status)).toBe(true);
    });

    it('Given all modes unavailable, When checking, Then hasAnyChromeAI is false', () => {
      const status: ChromeAIStatus = {
        summarize: 'unavailable', correct: 'unavailable', proofread: 'unavailable',
        translate: 'unavailable', expand: 'unavailable',
      };
      expect(hasAnyChromeAI(status)).toBe(false);
    });
  });
});

// ============================================================
// Feature: Chrome AI i18n Support
// ============================================================
describe('Feature: Chrome AI Localized Prompts', () => {
  const languages = ['中文', 'English', '日本語', '한국어', 'Français', 'Deutsch', 'Español'];

  describe('Scenario: Chrome AI engine label translated', () => {
    languages.forEach(lang => {
      it(`Given ${lang} UI, When showing engine options, Then Chrome AI label exists`, () => {
        expect(translations[lang].engine_chrome_ai).toBeTruthy();
      });
    });
  });

  describe('Scenario: Chrome AI prompts can be localized', () => {
    it('Given ChromeAITranslations interface, When all fields provided, Then type checks pass', () => {
      const t: ChromeAITranslations = {
        no_errors_found: '✅ No errors found',
        correction_details: '📝 Details:',
        proofread_context: 'Polish this text.',
        expand_prompt: 'Expand this text.',
      };
      expect(t.no_errors_found).toContain('✅');
      expect(t.correction_details).toContain('📝');
    });

    it('Given ChromeAITranslations interface, When partially provided, Then optional fields are undefined', () => {
      const t: ChromeAITranslations = {};
      expect(t.no_errors_found).toBeUndefined();
      // Chrome AI uses ?? fallback to Chinese defaults
    });
  });

  describe('Scenario: Chrome AI prompt i18n keys in all languages', () => {
    const chromeAIKeys = ['no_errors_found', 'correction_details', 'proofread_context', 'expand_prompt', 'chrome_ai_unsupported_no_fallback'];

    languages.forEach(lang => {
      it(`Given ${lang}, When checking Chrome AI prompt keys, Then all exist and are non-empty`, () => {
        for (const key of chromeAIKeys) {
          expect(translations[lang][key]).toBeTruthy();
        }
      });
    });
  });
});
