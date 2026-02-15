import { describe, it, expect } from 'vitest';
import {
  getRecommendations,
  hasAnyChromeAI,
  type EngineAvailability,
} from '../engines/engine-manager';
import {
  isChromeAIAvailable,
  MODE_API_MAP,
  type ChromeAIStatus,
  type ChromeAICapability,
} from '../engines/chrome-ai';
import type { ModeKey } from '../types';

// ---- chrome-ai.ts exports ----

describe('Chrome AI Engine Adapter', () => {
  describe('Given MODE_API_MAP', () => {
    it('should map all 5 modes to Chrome AI API names', () => {
      const expected: Record<ModeKey, string> = {
        summarize: 'Summarizer',
        correct: 'Proofreader',
        proofread: 'Rewriter',
        translate: 'Translator',
        expand: 'Writer',
      };
      expect(MODE_API_MAP).toEqual(expected);
    });
  });

  describe('Given isChromeAIAvailable()', () => {
    const allAvailable: ChromeAIStatus = {
      summarize: 'available',
      correct: 'available',
      proofread: 'available',
      translate: 'available',
      expand: 'available',
    };

    const allUnavailable: ChromeAIStatus = {
      summarize: 'unavailable',
      correct: 'unavailable',
      proofread: 'unavailable',
      translate: 'unavailable',
      expand: 'unavailable',
    };

    const mixed: ChromeAIStatus = {
      summarize: 'available',
      correct: 'experimental',
      proofread: 'unavailable',
      translate: 'available',
      expand: 'unavailable',
    };

    it('should return true when mode is available', () => {
      expect(isChromeAIAvailable(allAvailable, 'summarize')).toBe(true);
    });

    it('should return true when mode is experimental', () => {
      expect(isChromeAIAvailable(mixed, 'correct')).toBe(true);
    });

    it('should return false when mode is unavailable', () => {
      expect(isChromeAIAvailable(allUnavailable, 'summarize')).toBe(false);
    });

    it('should return false for unavailable mode in mixed status', () => {
      expect(isChromeAIAvailable(mixed, 'proofread')).toBe(false);
    });

    it('should check each mode independently', () => {
      expect(isChromeAIAvailable(mixed, 'summarize')).toBe(true);
      expect(isChromeAIAvailable(mixed, 'translate')).toBe(true);
      expect(isChromeAIAvailable(mixed, 'expand')).toBe(false);
    });
  });
});

// ---- engine-manager.ts ----

describe('Engine Manager', () => {
  describe('Given hasAnyChromeAI()', () => {
    it('should return true when at least one mode is available', () => {
      const status: ChromeAIStatus = {
        summarize: 'available',
        correct: 'unavailable',
        proofread: 'unavailable',
        translate: 'unavailable',
        expand: 'unavailable',
      };
      expect(hasAnyChromeAI(status)).toBe(true);
    });

    it('should return true when at least one mode is experimental', () => {
      const status: ChromeAIStatus = {
        summarize: 'unavailable',
        correct: 'experimental',
        proofread: 'unavailable',
        translate: 'unavailable',
        expand: 'unavailable',
      };
      expect(hasAnyChromeAI(status)).toBe(true);
    });

    it('should return false when all modes are unavailable', () => {
      const status: ChromeAIStatus = {
        summarize: 'unavailable',
        correct: 'unavailable',
        proofread: 'unavailable',
        translate: 'unavailable',
        expand: 'unavailable',
      };
      expect(hasAnyChromeAI(status)).toBe(false);
    });
  });

  describe('Given getRecommendations()', () => {
    const chromeAIAvailable: ChromeAIStatus = {
      summarize: 'available',
      correct: 'available',
      proofread: 'experimental',
      translate: 'available',
      expand: 'experimental',
    };

    const chromeAIUnavailable: ChromeAIStatus = {
      summarize: 'unavailable',
      correct: 'unavailable',
      proofread: 'unavailable',
      translate: 'unavailable',
      expand: 'unavailable',
    };

    it('should return recommendations for all 5 modes', () => {
      const availability: EngineAvailability = {
        chromeAI: chromeAIAvailable,
        webGPU: true,
        wasm: true,
      };
      const recs = getRecommendations(availability);
      expect(recs).toHaveLength(5);
      expect(recs.map(r => r.mode)).toEqual(['summarize', 'correct', 'proofread', 'translate', 'expand']);
    });

    describe('When Chrome AI is available and no user preference', () => {
      it('should recommend chrome-ai for available modes', () => {
        const availability: EngineAvailability = {
          chromeAI: chromeAIAvailable,
          webGPU: true,
          wasm: true,
        };
        const recs = getRecommendations(availability);
        // All modes have chrome AI available or experimental
        for (const rec of recs) {
          expect(rec.bestEngine).toBe('chrome-ai');
        }
      });
    });

    describe('When Chrome AI is unavailable', () => {
      it('should fallback to local-gpu when WebGPU is available', () => {
        const availability: EngineAvailability = {
          chromeAI: chromeAIUnavailable,
          webGPU: true,
          wasm: true,
        };
        const recs = getRecommendations(availability);
        for (const rec of recs) {
          expect(rec.bestEngine).toBe('local-gpu');
        }
      });

      it('should fallback to local-wasm when only WASM is available', () => {
        const availability: EngineAvailability = {
          chromeAI: chromeAIUnavailable,
          webGPU: false,
          wasm: true,
        };
        const recs = getRecommendations(availability);
        for (const rec of recs) {
          expect(rec.bestEngine).toBe('local-wasm');
        }
      });

      it('should fallback to online when nothing else is available', () => {
        const availability: EngineAvailability = {
          chromeAI: chromeAIUnavailable,
          webGPU: false,
          wasm: false,
        };
        const recs = getRecommendations(availability);
        for (const rec of recs) {
          expect(rec.bestEngine).toBe('online');
        }
      });
    });

    describe('When user explicitly selects an engine', () => {
      it('should respect user selection of local-gpu', () => {
        const availability: EngineAvailability = {
          chromeAI: chromeAIAvailable,
          webGPU: true,
          wasm: true,
        };
        const recs = getRecommendations(availability, 'local-gpu');
        for (const rec of recs) {
          expect(rec.bestEngine).toBe('local-gpu');
        }
      });

      it('should respect user selection of online', () => {
        const availability: EngineAvailability = {
          chromeAI: chromeAIAvailable,
          webGPU: true,
          wasm: true,
        };
        const recs = getRecommendations(availability, 'online');
        for (const rec of recs) {
          expect(rec.bestEngine).toBe('online');
        }
      });

      it('should auto-detect when user selects chrome-ai', () => {
        const availability: EngineAvailability = {
          chromeAI: chromeAIAvailable,
          webGPU: true,
          wasm: true,
        };
        const recs = getRecommendations(availability, 'chrome-ai');
        for (const rec of recs) {
          expect(rec.bestEngine).toBe('chrome-ai');
        }
      });
    });

    describe('When engine priority is followed', () => {
      it('should follow Chrome AI > WebGPU > WASM > Online priority', () => {
        // With all available, chrome-ai wins
        const full: EngineAvailability = { chromeAI: chromeAIAvailable, webGPU: true, wasm: true };
        expect(getRecommendations(full)[0].bestEngine).toBe('chrome-ai');

        // Without chrome-ai, webgpu wins
        const noChrome: EngineAvailability = { chromeAI: chromeAIUnavailable, webGPU: true, wasm: true };
        expect(getRecommendations(noChrome)[0].bestEngine).toBe('local-gpu');

        // Without chrome-ai and webgpu, wasm wins
        const noGPU: EngineAvailability = { chromeAI: chromeAIUnavailable, webGPU: false, wasm: true };
        expect(getRecommendations(noGPU)[0].bestEngine).toBe('local-wasm');

        // Nothing available: online
        const nothing: EngineAvailability = { chromeAI: chromeAIUnavailable, webGPU: false, wasm: false };
        expect(getRecommendations(nothing)[0].bestEngine).toBe('online');
      });
    });
  });
});
