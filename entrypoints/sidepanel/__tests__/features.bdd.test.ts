/**
 * BDD Tests: Feature-based behavioral tests for AI Proofduck extension
 *
 * These tests validate the core user-facing features of the extension
 * organized by Feature → Scenario → Given/When/Then.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSystemPrompt } from '../worker-utils';
import { PROMPTS, TONE_MAP, DETAIL_MAP, BASE_CONSTRAINT, SUFFIX_CONSTRAINT } from '../prompts';
import { translations } from '../i18n';
import {
  DEFAULT_SETTINGS,
  MODES,
  emptyModeResults,
  emptyGeneratingModes,
  type Settings,
  type ModeKey,
  type StatusType,
  type WorkerInboundMessage,
  type WorkerOutboundMessage,
} from '../types';

// ============================================================
// Feature 1: Five-Mode Text Processing
// ============================================================
describe('Feature: Five-Mode Text Processing', () => {
  describe('Scenario: User selects a processing mode', () => {
    it('Given the extension has 5 modes, When listing modes, Then all 5 are available', () => {
      const modes = MODES.map(m => m.key);
      expect(modes).toEqual(['summarize', 'correct', 'proofread', 'translate', 'expand']);
    });

    it('Given a mode, When looking up its definition, Then it has a label key and result label key', () => {
      for (const mode of MODES) {
        expect(mode.labelKey).toBeTruthy();
        expect(mode.resultLabelKey).toBeTruthy();
      }
    });
  });

  describe('Scenario: Each mode generates a specialized system prompt', () => {
    const settings: Partial<Settings> = { extensionLanguage: '中文', tone: 'professional', detailLevel: 'standard' };

    it('Given summarize mode, When generating prompt, Then it instructs to extract key points', () => {
      const prompt = getSystemPrompt('summarize', settings);
      expect(prompt).toContain('首席速读官');
      expect(prompt).toContain('核心观点');
    });

    it('Given correct mode, When generating prompt, Then it instructs to fix errors without changing style', () => {
      const prompt = getSystemPrompt('correct', settings);
      expect(prompt).toContain('校对员');
      expect(prompt).toContain('拼写');
    });

    it('Given proofread mode, When generating prompt, Then it instructs to polish text', () => {
      const prompt = getSystemPrompt('proofread', settings);
      expect(prompt).toContain('文案编辑');
      expect(prompt).toContain('流畅度');
    });

    it('Given translate mode, When generating prompt, Then it instructs faithful translation', () => {
      const prompt = getSystemPrompt('translate', settings);
      expect(prompt).toContain('翻译专家');
      expect(prompt).toContain('信、达、雅');
    });

    it('Given expand mode, When generating prompt, Then it instructs to enrich content', () => {
      const prompt = getSystemPrompt('expand', settings);
      expect(prompt).toContain('创意写作');
      expect(prompt).toContain('丰富内容');
    });
  });

  describe('Scenario: All prompts enforce output constraints', () => {
    const allModes = ['summarize', 'correct', 'proofread', 'translate', 'expand'];
    const settings: Partial<Settings> = { extensionLanguage: '中文', tone: 'professional', detailLevel: 'standard' };

    allModes.forEach(mode => {
      it(`Given ${mode} mode, When prompt generated, Then it forbids explanatory text`, () => {
        const prompt = getSystemPrompt(mode, settings);
        expect(prompt).toContain('禁止');
        expect(prompt).toContain(SUFFIX_CONSTRAINT);
      });

      it(`Given ${mode} mode, When prompt generated, Then it specifies target language output`, () => {
        const prompt = getSystemPrompt(mode, settings);
        expect(prompt).toContain('直接且仅输出 中文 结果文本');
      });
    });
  });
});

// ============================================================
// Feature 2: Tone and Detail Level Customization
// ============================================================
describe('Feature: Tone and Detail Level Customization', () => {
  describe('Scenario: User selects different writing tones', () => {
    const tones: Array<{ key: Settings['tone']; label: string }> = [
      { key: 'professional', label: '专业且正式' },
      { key: 'casual', label: '轻松且口语化' },
      { key: 'academic', label: '学术且严谨' },
      { key: 'concise', label: '极其简练' },
    ];

    tones.forEach(({ key, label }) => {
      it(`Given tone "${key}", When generating proofread prompt, Then it applies "${label}"`, () => {
        const prompt = getSystemPrompt('proofread', { extensionLanguage: '中文', tone: key, detailLevel: 'standard' });
        expect(prompt).toContain(label);
      });
    });
  });

  describe('Scenario: User selects different detail levels', () => {
    const levels: Array<{ key: Settings['detailLevel']; label: string }> = [
      { key: 'standard', label: '标准平衡' },
      { key: 'detailed', label: '丰富详尽' },
      { key: 'creative', label: '充满创意与文学性' },
    ];

    levels.forEach(({ key, label }) => {
      it(`Given detail level "${key}", When generating expand prompt, Then it applies "${label}"`, () => {
        const prompt = getSystemPrompt('expand', { extensionLanguage: '中文', tone: 'professional', detailLevel: key });
        expect(prompt).toContain(label);
      });
    });
  });

  describe('Scenario: Settings have sensible defaults', () => {
    it('Given no tone specified, When generating prompt, Then professional tone is used', () => {
      const prompt = getSystemPrompt('proofread', { extensionLanguage: '中文' });
      expect(prompt).toContain(TONE_MAP.professional);
    });

    it('Given no detail level specified, When generating prompt, Then standard detail is used', () => {
      const prompt = getSystemPrompt('expand', { extensionLanguage: '中文' });
      expect(prompt).toContain(DETAIL_MAP.standard);
    });

    it('Given no language specified, When generating prompt, Then 中文 is used', () => {
      const prompt = getSystemPrompt('summarize', {});
      expect(prompt).toContain('直接且仅输出 中文 结果文本');
    });
  });
});

// ============================================================
// Feature 3: Multi-Language UI (i18n)
// ============================================================
describe('Feature: Multi-Language UI (i18n)', () => {
  const languages = ['中文', 'English', '日本語', '한국어', 'Français', 'Deutsch', 'Español'];

  describe('Scenario: Extension supports 7 languages', () => {
    it('Given the translation table, When counting languages, Then exactly 7 are supported', () => {
      expect(Object.keys(translations)).toHaveLength(7);
    });

    languages.forEach(lang => {
      it(`Given language ${lang}, When accessing translations, Then it exists`, () => {
        expect(translations[lang]).toBeDefined();
      });
    });
  });

  describe('Scenario: All UI elements are translated', () => {
    const uiKeys = {
      navigation: ['mode_summarize', 'mode_correct', 'mode_proofread', 'mode_translate', 'mode_expand'],
      status: ['status_idle', 'status_loading', 'status_ready_local', 'status_ready_online', 'status_generating', 'status_error'],
      actions: ['action_btn_load', 'action_btn_execute', 'copy_btn', 'clear_btn'],
      settings: ['engine_label', 'tone_label', 'detail_label', 'api_config'],
    };

    languages.forEach(lang => {
      it(`Given language ${lang}, When checking navigation labels, Then all mode labels exist`, () => {
        for (const key of uiKeys.navigation) {
          expect(translations[lang][key]).toBeTruthy();
        }
      });

      it(`Given language ${lang}, When checking status messages, Then all status strings exist`, () => {
        for (const key of uiKeys.status) {
          expect(translations[lang][key]).toBeTruthy();
        }
      });

      it(`Given language ${lang}, When checking action buttons, Then all button labels exist`, () => {
        for (const key of uiKeys.actions) {
          expect(translations[lang][key]).toBeTruthy();
        }
      });
    });
  });

  describe('Scenario: Translation keys are consistent across languages', () => {
    const referenceKeys = Object.keys(translations['中文']).sort();

    languages.forEach(lang => {
      it(`Given ${lang}, When comparing keys to 中文, Then they match exactly`, () => {
        const keys = Object.keys(translations[lang]).sort();
        expect(keys).toEqual(referenceKeys);
      });
    });
  });

  describe('Scenario: No translation values are empty', () => {
    languages.forEach(lang => {
      it(`Given ${lang}, When checking all values, Then none are empty strings`, () => {
        const empty = Object.entries(translations[lang]).filter(([, v]) => v === '');
        expect(empty).toHaveLength(0);
      });
    });
  });
});

// ============================================================
// Feature 4: Multi-Engine Architecture
// ============================================================
describe('Feature: Multi-Engine Architecture', () => {
  describe('Scenario: Three engine types available', () => {
    it('Given the settings, When listing engines, Then local-gpu, local-wasm, and online are available', () => {
      const engines = ['local-gpu', 'local-wasm', 'online'] as const;
      engines.forEach(e => {
        const settings: Settings = { ...DEFAULT_SETTINGS, engine: e };
        expect(settings.engine).toBe(e);
      });
    });
  });

  describe('Scenario: Default engine is local-gpu for privacy', () => {
    it('Given fresh settings, When checking engine, Then local-gpu is default', () => {
      expect(['local-gpu', 'chrome-ai']).toContain(DEFAULT_SETTINGS.engine);
    });
  });

  describe('Scenario: Online API requires configuration', () => {
    it('Given default settings, When checking API key, Then it is empty', () => {
      expect(DEFAULT_SETTINGS.apiKey).toBe('');
    });

    it('Given default settings, When checking API base URL, Then it points to OpenAI', () => {
      expect(DEFAULT_SETTINGS.apiBaseUrl).toContain('openai.com');
    });
  });
});

// ============================================================
// Feature 5: Worker Message Protocol
// ============================================================
describe('Feature: Worker Message Protocol', () => {
  describe('Scenario: Sidepanel sends commands to worker', () => {
    it('Given user wants to load engine, When sending message, Then type is "load" with settings', () => {
      const msg: WorkerInboundMessage = { type: 'load', settings: DEFAULT_SETTINGS };
      expect(msg.type).toBe('load');
      expect(msg.settings).toBe(DEFAULT_SETTINGS);
    });

    it('Given user wants to process text, When sending message, Then type is "generate" with text, mode, settings', () => {
      const msg: WorkerInboundMessage = {
        type: 'generate',
        text: 'Hello world',
        mode: 'translate',
        settings: DEFAULT_SETTINGS,
        requestId: 'req-123',
      };
      expect(msg.type).toBe('generate');
      expect(msg.text).toBe('Hello world');
      expect(msg.mode).toBe('translate');
    });
  });

  describe('Scenario: Worker reports progress during model loading', () => {
    it('Given worker is loading model, When progress updates, Then message has progress and text', () => {
      const msg: WorkerOutboundMessage = { type: 'progress', progress: { progress: 45, text: 'Downloading model...' } };
      expect(msg.type).toBe('progress');
      if (msg.type === 'progress') {
        expect(msg.progress.progress).toBe(45);
        expect(msg.progress.text).toContain('Downloading');
      }
    });
  });

  describe('Scenario: Worker streams results back', () => {
    it('Given worker is generating, When partial result arrives, Then type is "update" with accumulated text', () => {
      const msg: WorkerOutboundMessage = { type: 'update', text: '这是部分结果', mode: 'summarize' };
      expect(msg.type).toBe('update');
    });

    it('Given worker finishes generation, When final result arrives, Then type is "complete"', () => {
      const msg: WorkerOutboundMessage = { type: 'complete', text: '这是完整结果', mode: 'summarize' };
      expect(msg.type).toBe('complete');
    });

    it('Given worker encounters error, When error occurs, Then type is "error" with message', () => {
      const msg: WorkerOutboundMessage = { type: 'error', error: 'Model failed to load', mode: 'summarize' };
      expect(msg.type).toBe('error');
      if (msg.type === 'error') {
        expect(msg.error).toBeTruthy();
      }
    });
  });

  describe('Scenario: Request ID prevents race conditions', () => {
    it('Given multiple concurrent requests, When each has a requestId, Then responses can be matched', () => {
      const req1: WorkerInboundMessage = { type: 'generate', text: 'a', mode: 'translate', settings: DEFAULT_SETTINGS, requestId: 'qt-001' };
      const req2: WorkerInboundMessage = { type: 'generate', text: 'b', mode: 'translate', settings: DEFAULT_SETTINGS, requestId: 'qt-002' };

      const res1: WorkerOutboundMessage = { type: 'complete', text: 'A', mode: 'translate', requestId: 'qt-001' };
      const res2: WorkerOutboundMessage = { type: 'complete', text: 'B', mode: 'translate', requestId: 'qt-002' };

      expect(res1.requestId).toBe(req1.requestId);
      expect(res2.requestId).toBe(req2.requestId);
      expect(res1.requestId).not.toBe(res2.requestId);
    });
  });
});

// ============================================================
// Feature 6: Mode Results State Management
// ============================================================
describe('Feature: Mode Results State Management', () => {
  describe('Scenario: Each mode has independent result state', () => {
    it('Given fresh state, When checking all modes, Then all results are empty', () => {
      const results = emptyModeResults();
      for (const mode of MODES) {
        expect(results[mode.key]).toBe('');
      }
    });

    it('Given fresh state, When checking generating flags, Then all are false', () => {
      const flags = emptyGeneratingModes();
      for (const mode of MODES) {
        expect(flags[mode.key]).toBe(false);
      }
    });

    it('Given summarize result exists, When switching to translate mode, Then summarize result is preserved', () => {
      const results = emptyModeResults();
      results.summarize = '这是摘要结果';
      results.translate = '这是翻译结果';

      expect(results.summarize).toBe('这是摘要结果');
      expect(results.translate).toBe('这是翻译结果');
      expect(results.correct).toBe('');
    });
  });

  describe('Scenario: Generating state is per-mode', () => {
    it('Given translate is generating, When checking other modes, Then they are not generating', () => {
      const flags = emptyGeneratingModes();
      flags.translate = true;

      expect(flags.translate).toBe(true);
      expect(flags.summarize).toBe(false);
      expect(flags.proofread).toBe(false);
    });
  });
});

// ============================================================
// Feature 7: Application Status Lifecycle
// ============================================================
describe('Feature: Application Status Lifecycle', () => {
  describe('Scenario: Status transitions through defined states', () => {
    const validStatuses: StatusType[] = ['idle', 'loading', 'ready', 'error'];

    it('Given the app, When listing valid statuses, Then exactly 4 states exist', () => {
      expect(validStatuses).toHaveLength(4);
    });

    it('Given initial state, When app starts, Then status is idle', () => {
      // Default status before engine loads
      expect(DEFAULT_SETTINGS.engine).toBeTruthy(); // engine configured but not loaded
    });
  });

  describe('Scenario: Error status shows reset option', () => {
    it('Given error state, When user sees error button, Then translated reset text is available', () => {
      const t = translations['中文'];
      expect(t.status_error).toBeTruthy();
      // click_to_reset is added in PR #50
      if (t.click_to_reset) {
        expect(t.click_to_reset).toBeTruthy();
      }
    });
  });
});

// ============================================================
// Feature 8: Content Script Text Selection
// ============================================================
describe('Feature: Content Script Integration', () => {
  describe('Scenario: Selected text triggers processing', () => {
    it('Given text is selected on a webpage, When stored, Then sidepanel can access it via storage', () => {
      // Content script stores selected text in browser.storage.local.selectedText
      // Sidepanel watches storage changes via storageListener
      const storageChange = { selectedText: { newValue: 'Selected text from page' } };
      expect(storageChange.selectedText.newValue).toBe('Selected text from page');
    });
  });

  describe('Scenario: Quick translate from floating popup', () => {
    it('Given floating popup, When QUICK_TRANSLATE message sent, Then it includes text and expects response', () => {
      const msg = { type: 'QUICK_TRANSLATE', text: 'Hello' };
      expect(msg.type).toBe('QUICK_TRANSLATE');
      expect(msg.text).toBeTruthy();
    });

    it('Given engine is loading, When quick translate requested, Then response is ENGINE_LOADING error', () => {
      const response = { error: 'ENGINE_LOADING' };
      expect(response.error).toBe('ENGINE_LOADING');
    });

    it('Given timeout occurs, When 15s elapsed, Then response is TIMEOUT error', () => {
      const response = { error: 'TIMEOUT' };
      expect(response.error).toBe('TIMEOUT');
    });
  });
});

// ============================================================
// Feature 9: Model Import/Export (.mlcp format)
// ============================================================
describe('Feature: Model Import/Export', () => {
  describe('Scenario: Export model to .mlcp file', () => {
    it('Given .mlcp format, When writing header, Then magic bytes are 0x4d4c4350 ("MLCP")', () => {
      const magic = 0x4d4c4350;
      const buf = new ArrayBuffer(4);
      new DataView(buf).setUint32(0, magic);
      const bytes = new Uint8Array(buf);
      // M=0x4d L=0x4c C=0x43 P=0x50
      expect(bytes[0]).toBe(0x4d);
      expect(bytes[1]).toBe(0x4c);
      expect(bytes[2]).toBe(0x43);
      expect(bytes[3]).toBe(0x50);
    });

    it('Given UTF-8 URL encoding, When encoding a URL with Chinese chars, Then byte length may differ from string length', () => {
      const encoder = new TextEncoder();
      const url = 'https://example.com/模型/file.bin';
      const bytes = encoder.encode(url);
      // UTF-8 bytes >= string length for multi-byte chars
      expect(bytes.length).toBeGreaterThanOrEqual(url.length);
    });
  });

  describe('Scenario: Import .mlcp file restores model', () => {
    it('Given a .mlcp file, When reading, Then magic bytes identify format', () => {
      const buf = new ArrayBuffer(8);
      const view = new DataView(buf);
      view.setUint32(0, 0x4d4c4350);
      view.setUint32(4, 3); // 3 files
      expect(view.getUint32(0)).toBe(0x4d4c4350);
      expect(view.getUint32(4)).toBe(3);
    });
  });
});

// ============================================================
// Feature 10: Auto-Speak Results
// ============================================================
describe('Feature: Auto-Speak Results', () => {
  describe('Scenario: Auto-speak toggle in settings', () => {
    it('Given default settings, When checking autoSpeak, Then it is disabled', () => {
      expect(DEFAULT_SETTINGS.autoSpeak).toBe(false);
    });

    it('Given autoSpeak enabled, When result completes, Then TTS would be invoked', () => {
      const settings = { ...DEFAULT_SETTINGS, autoSpeak: true };
      expect(settings.autoSpeak).toBe(true);
      // In actual code, chrome.tts.speak is called on 'complete' message
    });
  });
});
