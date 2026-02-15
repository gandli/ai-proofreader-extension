// Chrome Built-in AI API Type Declarations
// Summarizer (Chrome 138+), Translator (Chrome 138+), LanguageDetector (Chrome 138+)
// Rewriter (Chrome 137+ Origin Trial), Writer (Chrome 137+ Origin Trial)
// Proofreader (Chrome 141+ Origin Trial)

type AIAvailability = 'readily' | 'after-download' | 'no';

// ---- Summarizer API ----

interface SummarizerCreateOptions {
  type?: 'key-points' | 'tl;dr' | 'teaser' | 'headline';
  format?: 'markdown' | 'plain-text';
  length?: 'short' | 'medium' | 'long';
  sharedContext?: string;
  monitor?: (monitor: AICreateMonitor) => void;
}

interface AICreateMonitor extends EventTarget {
  addEventListener(type: 'downloadprogress', listener: (ev: AIDownloadProgressEvent) => void): void;
}

interface AIDownloadProgressEvent extends Event {
  loaded: number;
  total: number;
}

interface SummarizerInstance {
  summarize(text: string, options?: { context?: string }): Promise<string>;
  summarizeStreaming(text: string, options?: { context?: string }): ReadableStream<string>;
  destroy(): void;
}

interface SummarizerConstructor {
  availability(options?: SummarizerCreateOptions): Promise<AIAvailability>;
  create(options?: SummarizerCreateOptions): Promise<SummarizerInstance>;
}

// ---- Translator API ----

interface TranslatorCreateOptions {
  sourceLanguage: string;
  targetLanguage: string;
  monitor?: (monitor: AICreateMonitor) => void;
}

interface TranslatorInstance {
  translate(text: string): Promise<string>;
  destroy(): void;
}

interface TranslatorConstructor {
  availability(options: TranslatorCreateOptions): Promise<AIAvailability>;
  create(options: TranslatorCreateOptions): Promise<TranslatorInstance>;
}

// ---- LanguageDetector API ----

interface LanguageDetectorCreateOptions {
  monitor?: (monitor: AICreateMonitor) => void;
}

interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
}

interface LanguageDetectorInstance {
  detect(text: string): Promise<LanguageDetectionResult[]>;
  destroy(): void;
}

interface LanguageDetectorConstructor {
  availability(options?: LanguageDetectorCreateOptions): Promise<AIAvailability>;
  create(options?: LanguageDetectorCreateOptions): Promise<LanguageDetectorInstance>;
}

// ---- Writer API ----

interface WriterCreateOptions {
  tone?: 'formal' | 'neutral' | 'casual';
  format?: 'markdown' | 'plain-text';
  length?: 'short' | 'medium' | 'long';
  sharedContext?: string;
  monitor?: (monitor: AICreateMonitor) => void;
}

interface WriterInstance {
  write(text: string, options?: { context?: string }): Promise<string>;
  writeStreaming(text: string, options?: { context?: string }): ReadableStream<string>;
  destroy(): void;
}

interface WriterConstructor {
  availability(options?: WriterCreateOptions): Promise<AIAvailability>;
  create(options?: WriterCreateOptions): Promise<WriterInstance>;
}

// ---- Rewriter API ----

interface RewriterCreateOptions {
  tone?: 'as-is' | 'more-formal' | 'more-casual';
  format?: 'as-is' | 'markdown' | 'plain-text';
  length?: 'as-is' | 'shorter' | 'longer';
  sharedContext?: string;
  monitor?: (monitor: AICreateMonitor) => void;
}

interface RewriterInstance {
  rewrite(text: string, options?: { context?: string }): Promise<string>;
  rewriteStreaming(text: string, options?: { context?: string }): ReadableStream<string>;
  destroy(): void;
}

interface RewriterConstructor {
  availability(options?: RewriterCreateOptions): Promise<AIAvailability>;
  create(options?: RewriterCreateOptions): Promise<RewriterInstance>;
}

// ---- Proofreader API ----

interface ProofreaderCreateOptions {
  expectedInputLanguages?: string[];
  monitor?: (monitor: AICreateMonitor) => void;
}

interface ProofreaderCorrection {
  startIndex: number;
  endIndex: number;
  suggestion: string;
  type: string;
  description?: string;
}

interface ProofreaderResult {
  corrections: ProofreaderCorrection[];
}

interface ProofreaderInstance {
  proofread(text: string): Promise<ProofreaderResult>;
  destroy(): void;
}

interface ProofreaderConstructor {
  availability(options?: ProofreaderCreateOptions): Promise<AIAvailability>;
  create(options?: ProofreaderCreateOptions): Promise<ProofreaderInstance>;
}

// ---- Global declarations ----

declare var Summarizer: SummarizerConstructor;
declare var Translator: TranslatorConstructor;
declare var LanguageDetector: LanguageDetectorConstructor;
declare var Writer: WriterConstructor;
declare var Rewriter: RewriterConstructor;
declare var Proofreader: ProofreaderConstructor;
