import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  MODES,
  emptyModeResults,
  emptyGeneratingModes,
  type ModeKey,
  type Settings,
  type EngineType,
  type ToneType,
  type DetailLevelType,
  type StatusType,
  type WorkerInboundMessage,
  type WorkerOutboundMessage,
} from '../types';

describe('Types & Constants', () => {
  describe('Given DEFAULT_SETTINGS', () => {
    it('should have all required Settings fields', () => {
      const required: (keyof Settings)[] = [
        'engine', 'extensionLanguage', 'tone', 'detailLevel',
        'localModel', 'apiBaseUrl', 'apiKey', 'apiModel', 'autoSpeak',
      ];
      for (const key of required) {
        expect(DEFAULT_SETTINGS).toHaveProperty(key);
      }
    });

    it('should default engine to local-gpu', () => {
      expect(DEFAULT_SETTINGS.engine).toBe('local-gpu');
    });

    it('should default tone to professional', () => {
      expect(DEFAULT_SETTINGS.tone).toBe('professional');
    });

    it('should default detailLevel to standard', () => {
      expect(DEFAULT_SETTINGS.detailLevel).toBe('standard');
    });

    it('should default extensionLanguage to 中文', () => {
      expect(DEFAULT_SETTINGS.extensionLanguage).toBe('中文');
    });

    it('should default apiKey to empty string', () => {
      expect(DEFAULT_SETTINGS.apiKey).toBe('');
    });
  });

  describe('Given MODES array', () => {
    it('should define exactly 5 modes', () => {
      expect(MODES).toHaveLength(5);
    });

    it('should contain all mode keys in order', () => {
      const keys = MODES.map(m => m.key);
      expect(keys).toEqual(['summarize', 'correct', 'proofread', 'translate', 'expand']);
    });

    it('should have labelKey and resultLabelKey for each mode', () => {
      for (const mode of MODES) {
        expect(mode.labelKey).toMatch(/^mode_/);
        expect(mode.resultLabelKey).toMatch(/^result_/);
      }
    });
  });

  describe('Given emptyModeResults()', () => {
    it('should return empty strings for all 5 modes', () => {
      const results = emptyModeResults();
      expect(Object.keys(results)).toHaveLength(5);
      for (const val of Object.values(results)) {
        expect(val).toBe('');
      }
    });

    it('should return a new object each time (no shared reference)', () => {
      const a = emptyModeResults();
      const b = emptyModeResults();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('Given emptyGeneratingModes()', () => {
    it('should return false for all 5 modes', () => {
      const modes = emptyGeneratingModes();
      expect(Object.keys(modes)).toHaveLength(5);
      for (const val of Object.values(modes)) {
        expect(val).toBe(false);
      }
    });
  });

  describe('Given type constraints', () => {
    it('should accept valid EngineType values', () => {
      const valid: EngineType[] = ['local-gpu', 'local-wasm', 'online'];
      expect(valid).toHaveLength(3);
    });

    it('should accept valid ToneType values', () => {
      const valid: ToneType[] = ['professional', 'casual', 'academic', 'concise'];
      expect(valid).toHaveLength(4);
    });

    it('should accept valid DetailLevelType values', () => {
      const valid: DetailLevelType[] = ['standard', 'detailed', 'creative'];
      expect(valid).toHaveLength(3);
    });

    it('should accept valid StatusType values', () => {
      const valid: StatusType[] = ['idle', 'loading', 'ready', 'error'];
      expect(valid).toHaveLength(4);
    });
  });

  describe('Given WorkerInboundMessage discriminated union', () => {
    it('should accept a load message', () => {
      const msg: WorkerInboundMessage = { type: 'load', settings: DEFAULT_SETTINGS };
      expect(msg.type).toBe('load');
    });

    it('should accept a generate message', () => {
      const msg: WorkerInboundMessage = {
        type: 'generate',
        text: 'hello',
        mode: 'summarize',
        settings: DEFAULT_SETTINGS,
        requestId: 'test-1',
      };
      expect(msg.type).toBe('generate');
    });
  });

  describe('Given WorkerOutboundMessage discriminated union', () => {
    it('should accept all outbound message types', () => {
      const messages: WorkerOutboundMessage[] = [
        { type: 'progress', progress: { progress: 50, text: 'loading' } },
        { type: 'ready' },
        { type: 'update', text: 'partial', mode: 'summarize' },
        { type: 'complete', text: 'done', mode: 'summarize' },
        { type: 'error', error: 'failed', mode: 'summarize' },
      ];
      expect(messages).toHaveLength(5);
    });
  });
});
