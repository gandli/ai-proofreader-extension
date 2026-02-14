export type ModeKey = 'summarize' | 'correct' | 'proofread' | 'translate' | 'expand';

export interface Settings {
    engine: string;
    extensionLanguage: string;
    tone: string;
    detailLevel: string;
    localModel: string;
    apiBaseUrl: string;
    apiKey: string;
    apiModel: string;
    autoSpeak: boolean;
}

export interface WorkerMessage {
    type: 'progress' | 'ready' | 'update' | 'complete' | 'error';
    progress?: { progress: number; text: string };
    text?: string;
    error?: string;
    mode?: ModeKey;
}

export type WorkerRequest =
    | { type: 'load'; settings: Settings }
    | { type: 'generate'; text: string; mode: ModeKey; settings: Settings };
