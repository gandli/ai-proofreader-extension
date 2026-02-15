/**
 * Engine Manager - Detects available engines and manages priority.
 *
 * Priority: Chrome Built-in AI > WebGPU/WASM > Online API
 */
import type { ModeKey } from '../types';
import { detectChromeAI, isChromeAIAvailable, type ChromeAIStatus, type ChromeAICapability } from './chrome-ai';

export type EngineType = 'chrome-ai' | 'local-gpu' | 'local-wasm' | 'online';

export interface EngineAvailability {
  chromeAI: ChromeAIStatus;
  webGPU: boolean;
  wasm: boolean;
}

export interface ModeEngineRecommendation {
  mode: ModeKey;
  bestEngine: EngineType;
  chromeAIStatus: ChromeAICapability;
}

/** Detect all available engines */
export async function detectEngines(): Promise<EngineAvailability> {
  const chromeAI = await detectChromeAI();

  // WebGPU detection
  let webGPU = false;
  try {
    if ('gpu' in navigator) {
      const adapter = await (navigator as any).gpu?.requestAdapter();
      webGPU = !!adapter;
    }
  } catch (e) { console.error('WebGPU detection failed:', e); }

  // WASM is always available in modern browsers
  const wasm = typeof WebAssembly !== 'undefined';

  return { chromeAI, webGPU, wasm };
}

/** Get recommended engine for each mode */
export function getRecommendations(
  availability: EngineAvailability,
  userEngine?: string,
): ModeEngineRecommendation[] {
  const modes: ModeKey[] = ['summarize', 'correct', 'proofread', 'translate', 'expand'];

  return modes.map(mode => {
    const chromeAIStatus = availability.chromeAI[mode];

    // If user explicitly chose a non-Chrome-AI engine, respect it.
    // Chrome-AI and auto both go through auto-detection below.
    if (userEngine && userEngine !== 'chrome-ai' && userEngine !== 'auto') {
      return { mode, bestEngine: userEngine as EngineType, chromeAIStatus };
    }

    // Auto-select: Chrome AI first
    if (isChromeAIAvailable(availability.chromeAI, mode)) {
      return { mode, bestEngine: 'chrome-ai' as EngineType, chromeAIStatus };
    }

    // Fallback
    if (availability.webGPU) {
      return { mode, bestEngine: 'local-gpu' as EngineType, chromeAIStatus };
    }
    if (availability.wasm) {
      return { mode, bestEngine: 'local-wasm' as EngineType, chromeAIStatus };
    }
    return { mode, bestEngine: 'online' as EngineType, chromeAIStatus };
  });
}

/** Check if Chrome AI is available for ANY mode */
export function hasAnyChromeAI(status: ChromeAIStatus): boolean {
  return Object.values(status).some(v => v !== 'unavailable');
}
