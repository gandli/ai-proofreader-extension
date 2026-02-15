/**
 * Chrome Built-in AI Engine Adapter
 *
 * Maps the 5 modes (summarize, correct, proofread, translate, expand) to
 * native Chrome AI APIs: Summarizer, Proofreader, Rewriter, Translator+LanguageDetector, Writer.
 */
/// <reference path="../../../types/chrome-ai.d.ts" />

import type { ModeKey, Settings } from '../types';

/** i18n keys used by Chrome AI engine */
export interface ChromeAITranslations {
  no_errors_found?: string;
  correction_details?: string;
  proofread_context?: string;
  expand_prompt?: string;
}

// ---- Availability helpers ----

export type ChromeAICapability = 'available' | 'experimental' | 'unavailable';

export interface ChromeAIStatus {
  summarize: ChromeAICapability;
  correct: ChromeAICapability;    // Proofreader
  proofread: ChromeAICapability;  // Rewriter
  translate: ChromeAICapability;  // Translator + LanguageDetector
  expand: ChromeAICapability;     // Writer
}

/** Map of mode → Chrome AI API name for display */
export const MODE_API_MAP: Record<ModeKey, string> = {
  summarize: 'Summarizer',
  correct: 'Proofreader',
  proofread: 'Rewriter',
  translate: 'Translator',
  expand: 'Writer',
};


async function checkAvailability(mode: ModeKey): Promise<ChromeAICapability> {
  try {
    switch (mode) {
      case 'summarize':
        if (!('Summarizer' in self)) return 'unavailable';
        return (await Summarizer.availability()) !== 'no'
          ? 'available' : 'unavailable';

      case 'correct':
        if (!('Proofreader' in self)) return 'unavailable';
        return (await Proofreader.availability()) !== 'no'
          ? 'experimental' : 'unavailable';

      case 'proofread':
        if (!('Rewriter' in self)) return 'unavailable';
        return (await Rewriter.availability()) !== 'no'
          ? 'experimental' : 'unavailable';

      case 'translate': {
        if (!('Translator' in self)) return 'unavailable';
        // Basic check with en→zh
        const avail = await Translator.availability({ sourceLanguage: 'en', targetLanguage: 'zh' });
        return avail !== 'no' ? 'available' : 'unavailable';
      }

      case 'expand':
        if (!('Writer' in self)) return 'unavailable';
        return (await Writer.availability()) !== 'no'
          ? 'experimental' : 'unavailable';

      default:
        return 'unavailable';
    }
  } catch {
    return 'unavailable';
  }
}

/** Detect availability for all 5 modes */
export async function detectChromeAI(): Promise<ChromeAIStatus> {
  const [summarize, correct, proofread, translate, expand] = await Promise.all([
    checkAvailability('summarize'),
    checkAvailability('correct'),
    checkAvailability('proofread'),
    checkAvailability('translate'),
    checkAvailability('expand'),
  ]);
  return { summarize, correct, proofread, translate, expand };
}

/** Check if Chrome AI is available for a specific mode */
export function isChromeAIAvailable(status: ChromeAIStatus, mode: ModeKey): boolean {
  return status[mode] !== 'unavailable';
}

// ---- Language mapping ----

const LANG_MAP: Record<string, string> = {
  '中文': 'zh', 'English': 'en', '日本語': 'ja',
  '한국어': 'ko', 'Français': 'fr', 'Deutsch': 'de', 'Español': 'es',
};

function getLangCode(lang: string): string {
  return LANG_MAP[lang] || 'en';
}

// ---- Tone mapping for Rewriter ----

function mapTone(tone: string): 'as-is' | 'more-formal' | 'more-casual' {
  switch (tone) {
    case 'professional':
    case 'academic':
      return 'more-formal';
    case 'casual':
      return 'more-casual';
    default:
      return 'as-is';
  }
}

// ---- Detail → length mapping for Writer ----

function mapDetailToLength(detail: string): 'short' | 'medium' | 'long' {
  switch (detail) {
    case 'detailed':
    case 'creative':
      return 'long';
    default:
      return 'medium';
  }
}

// ---- Processing functions ----

export interface ChromeAICallbacks {
  onUpdate: (text: string) => void;
  onComplete: (text: string) => void;
  onError: (error: string) => void;
}

/** Helper to consume a ReadableStream<string> with streaming callbacks */
async function consumeStream(
  stream: ReadableStream<string>,
  callbacks: ChromeAICallbacks,
) {
  const reader = stream.getReader();
  let result = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // Chrome AI streaming APIs (Summarizer, Rewriter, Writer) return the
      // cumulative text on each read, so we overwrite rather than append.
      result = value;
      callbacks.onUpdate(result);
    }
    callbacks.onComplete(result);
  } catch (err) {
    callbacks.onError(err instanceof Error ? err.message : String(err));
  } finally {
    reader.releaseLock();
  }
}

/** Process text using Chrome AI Summarizer */
async function processSummarize(text: string, _settings: Settings, callbacks: ChromeAICallbacks) {
  const summarizer = await Summarizer.create({
    type: 'key-points',
    format: 'markdown',
    length: 'medium',
  });
  try {
    const stream = summarizer.summarizeStreaming(text);
    await consumeStream(stream, callbacks);
  } finally {
    summarizer.destroy();
  }
}

/** Process text using Chrome AI Proofreader (correct mode) */
async function processCorrect(text: string, _settings: Settings, callbacks: ChromeAICallbacks, t?: ChromeAITranslations) {
  const proofreader = await Proofreader.create({
    expectedInputLanguages: ['zh', 'en'],
  });
  try {
    const result = await proofreader.proofread(text);
    if (result.corrections.length === 0) {
      const noErrorMsg = t?.no_errors_found ?? '✅ 未发现错误，文本无需修正。';
      callbacks.onUpdate(noErrorMsg);
      callbacks.onComplete(noErrorMsg);
      return;
    }

    // Apply corrections to produce corrected text
    let corrected = text;
    // Apply from end to start to preserve indices
    const sorted = [...result.corrections].sort((a, b) => b.startIndex - a.startIndex);
    for (const c of sorted) {
      corrected = corrected.slice(0, c.startIndex) + c.suggestion + corrected.slice(c.endIndex);
    }

    // Format output with details
    let output = corrected + `\n\n---\n${t?.correction_details ?? '📝 修正详情：'}\n`;
    for (const c of result.corrections) {
      const original = text.slice(c.startIndex, c.endIndex);
      output += `• "${original}" → "${c.suggestion}"`;
      if (c.description) output += ` (${c.description})`;
      output += '\n';
    }

    callbacks.onUpdate(output);
    callbacks.onComplete(output);
  } finally {
    proofreader.destroy();
  }
}

/** Process text using Chrome AI Rewriter (proofread/polish mode) */
async function processProofread(text: string, settings: Settings, callbacks: ChromeAICallbacks, t?: ChromeAITranslations) {
  const rewriter = await Rewriter.create({
    tone: mapTone(settings.tone),
    format: 'plain-text',
    length: 'as-is',
  });
  try {
    const stream = rewriter.rewriteStreaming(text, {
      context: `${t?.proofread_context ?? '润色这段文本，使其更加流畅专业。目标语言：'}${settings.extensionLanguage}`,
    });
    await consumeStream(stream, callbacks);
  } finally {
    rewriter.destroy();
  }
}

/** Process text using Chrome AI Translator */
async function processTranslate(text: string, settings: Settings, callbacks: ChromeAICallbacks) {
  const targetLang = getLangCode(settings.extensionLanguage);

  // Detect source language
  let sourceLang = 'en';
  if ('LanguageDetector' in self) {
    let detector: Awaited<ReturnType<typeof LanguageDetector.create>> | null = null;
    try {
      detector = await LanguageDetector.create();
      const results = await detector.detect(text);
      if (results.length > 0 && results[0].confidence > 0.3) {
        sourceLang = results[0].detectedLanguage;
      }
    } catch {
      // fallback to 'en'
    } finally {
      detector?.destroy();
    }
  }

  // If source and target are the same, try to translate to the "other" language
  if (sourceLang === targetLang) {
    // If target is Chinese, translate to English; otherwise translate to Chinese
    const fallbackTarget = targetLang === 'zh' ? 'en' : 'zh';
    const translator = await Translator.create({
      sourceLanguage: sourceLang,
      targetLanguage: fallbackTarget,
    });
    try {
      const result = await translator.translate(text);
      callbacks.onUpdate(result);
      callbacks.onComplete(result);
    } finally {
      translator.destroy();
    }
    return;
  }

  const translator = await Translator.create({
    sourceLanguage: sourceLang,
    targetLanguage: targetLang,
  });
  try {
    const result = await translator.translate(text);
    callbacks.onUpdate(result);
    callbacks.onComplete(result);
  } finally {
    translator.destroy();
  }
}

/** Process text using Chrome AI Writer (expand mode) */
async function processExpand(text: string, settings: Settings, callbacks: ChromeAICallbacks, t?: ChromeAITranslations) {
  const writer = await Writer.create({
    tone: 'neutral',
    format: 'plain-text',
    length: mapDetailToLength(settings.detailLevel),
  });
  try {
    const prompt = `${t?.expand_prompt ?? '基于以下文本进行扩写，增加细节和深度，目标语言'}${settings.extensionLanguage}：\n\n${text}`;
    const stream = writer.writeStreaming(prompt);
    await consumeStream(stream, callbacks);
  } finally {
    writer.destroy();
  }
}

/** Main entry point: process text with Chrome AI for a given mode */
export async function processWithChromeAI(
  text: string,
  mode: ModeKey,
  settings: Settings,
  callbacks: ChromeAICallbacks,
  t?: ChromeAITranslations,
): Promise<void> {
  switch (mode) {
    case 'summarize':
      return processSummarize(text, settings, callbacks);
    case 'correct':
      return processCorrect(text, settings, callbacks, t);
    case 'proofread':
      return processProofread(text, settings, callbacks, t);
    case 'translate':
      return processTranslate(text, settings, callbacks);
    case 'expand':
      return processExpand(text, settings, callbacks, t);
  }
}
