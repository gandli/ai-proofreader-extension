// ============================================================
// Shared types for AI Proofduck sidepanel
// ============================================================

/** The five processing modes */
export type ModeKey = 'summarize' | 'correct' | 'proofread' | 'translate' | 'expand';

/** Persisted user settings */
export type EngineType = 'local-gpu' | 'local-wasm' | 'online' | 'chrome-ai';
export type ToneType = 'professional' | 'casual' | 'academic' | 'concise';
export type DetailLevelType = 'standard' | 'detailed' | 'creative';

export interface Settings {
  engine: EngineType;
  extensionLanguage: string;
  tone: ToneType;
  detailLevel: DetailLevelType;
  localModel: string;
  apiBaseUrl: string;
  apiKey: string;
  apiModel: string;
  autoSpeak: boolean;
}

/** Default settings factory */
export const DEFAULT_SETTINGS: Settings = {
  engine: 'chrome-ai',
  extensionLanguage: '中文',
  tone: 'professional',
  detailLevel: 'standard',
  localModel: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  apiModel: 'gpt-3.5-turbo',
  autoSpeak: false,
};

/** Empty mode results record helper */
export function emptyModeResults(): Record<ModeKey, string> {
  return { summarize: '', correct: '', proofread: '', translate: '', expand: '' };
}

export function emptyGeneratingModes(): Record<ModeKey, boolean> {
  return { summarize: false, correct: false, proofread: false, translate: false, expand: false };
}

// ---- Worker message protocol (discriminated union) ----

export interface WorkerLoadMessage {
  type: 'load';
  settings: Settings;
}

export interface WorkerGenerateMessage {
  type: 'generate';
  text: string;
  mode: ModeKey;
  settings: Settings;
  requestId?: string;
}

export type WorkerInboundMessage = WorkerLoadMessage | WorkerGenerateMessage;

export interface WorkerProgressMessage {
  type: 'progress';
  progress: { progress: number; text: string };
}

export interface WorkerReadyMessage {
  type: 'ready';
}

export interface WorkerUpdateMessage {
  type: 'update';
  text: string;
  mode: ModeKey;
  requestId?: string;
}

export interface WorkerCompleteMessage {
  type: 'complete';
  text: string;
  mode: ModeKey;
  requestId?: string;
}

export interface WorkerErrorMessage {
  type: 'error';
  error: string;
  mode?: ModeKey;
  requestId?: string;
}

export type WorkerOutboundMessage =
  | WorkerProgressMessage
  | WorkerReadyMessage
  | WorkerUpdateMessage
  | WorkerCompleteMessage
  | WorkerErrorMessage;

// ---- Mode definition for array-driven rendering ----

export interface ModeDefinition {
  key: ModeKey;
  labelKey: string;          // key into translations, e.g. 'mode_summarize'
  resultLabelKey: string;    // e.g. 'result_summarize'
}

export const MODES: ModeDefinition[] = [
  { key: 'summarize', labelKey: 'mode_summarize', resultLabelKey: 'result_summarize' },
  { key: 'correct', labelKey: 'mode_correct', resultLabelKey: 'result_correct' },
  { key: 'proofread', labelKey: 'mode_proofread', resultLabelKey: 'result_proofread' },
  { key: 'translate', labelKey: 'mode_translate', resultLabelKey: 'result_translate' },
  { key: 'expand', labelKey: 'mode_expand', resultLabelKey: 'result_expand' },
];
