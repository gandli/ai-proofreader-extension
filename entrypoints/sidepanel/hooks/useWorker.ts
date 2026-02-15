import { useEffect, useRef, useCallback } from 'react';
import {
  ModeKey,
  Settings,
  WorkerOutboundMessage,
  emptyModeResults,
  emptyGeneratingModes,
} from '../types';

interface UseWorkerOptions {
  settingsRef: React.RefObject<Settings>;
  statusRef: React.RefObject<string>;
  setStatus: (s: 'idle' | 'loading' | 'ready' | 'error') => void;
  setProgress: (p: { progress: number; text: string }) => void;
  setError: (e: string) => void;
  setModeResults: React.Dispatch<React.SetStateAction<Record<ModeKey, string>>>;
  setGeneratingModes: React.Dispatch<React.SetStateAction<Record<ModeKey, boolean>>>;
  setSelectedText: (t: string) => void;
  setShowSettings: (s: boolean) => void;
}

export function useWorker(opts: UseWorkerOptions) {
  const {
    settingsRef, statusRef,
    setStatus, setProgress, setError,
    setModeResults, setGeneratingModes,
    setSelectedText, setShowSettings,
  } = opts;

  const worker = useRef<Worker | null>(null);
  // Track the latest QUICK_TRANSLATE requestId
  const pendingQuickTranslateId = useRef<string | null>(null);

  useEffect(() => {
    worker.current = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });

    worker.current.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
      const msg = event.data;

      if (msg.type === 'progress' && msg.progress) {
        setProgress(msg.progress);
      } else if (msg.type === 'ready') {
        setStatus('ready');
        setError('');
      } else if (msg.type === 'update') {
        setModeResults(prev => ({ ...prev, [msg.mode]: msg.text }));
        setGeneratingModes(prev => ({ ...prev, [msg.mode]: true }));
      } else if (msg.type === 'complete') {
        setModeResults(prev => ({ ...prev, [msg.mode]: msg.text }));
        setGeneratingModes(prev => ({ ...prev, [msg.mode]: false }));
        // Auto-speak
        const s = settingsRef.current;
        if (s.autoSpeak && typeof chrome !== 'undefined' && chrome.tts) {
          chrome.tts.speak(msg.text ?? '', {
            rate: 1.0,
            onEvent: (ev) => { if (ev.type === 'error') console.error('[App] TTS Error:', ev.errorMessage); },
          });
        }
      } else if (msg.type === 'error') {
        const errorContent = msg.error ?? 'Unknown error';
        if (!msg.mode) {
          setError(`Load Error: ${errorContent}`);
          setStatus('error');
          setGeneratingModes(emptyGeneratingModes());
        } else {
          setError(`${msg.mode}: ${errorContent}`);
          setGeneratingModes(prev => ({ ...prev, [msg.mode!]: false }));
        }
      }
    };

    // Storage change listener
    const storageListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName !== 'local') return;
      if (changes.selectedText) {
        setSelectedText((changes.selectedText.newValue as string) || '');
        setModeResults(emptyModeResults());
      }
      if (changes.activeTab?.newValue === 'settings') {
        setShowSettings(true);
        browser.storage.local.remove('activeTab');
      }
    };

    // Runtime listener for QUICK_TRANSLATE
    const runtimeListener = (
      message: { type: string; text?: string },
      _sender: Browser.runtime.MessageSender,
      sendResponse: (res?: { translatedText?: string; error?: string }) => void,
    ) => {
      if (message.type !== 'QUICK_TRANSLATE') return;

      const text = message.text ?? '';
      const currentSettings = settingsRef.current;
      const currentStatus = statusRef.current;

      if (currentStatus === 'loading') {
        sendResponse({ error: 'ENGINE_LOADING' });
        return;
      }

      if (!worker.current || currentStatus === 'idle' || currentStatus === 'error') {
        if (currentSettings.engine === 'online' && !currentSettings.apiKey) {
          sendResponse({ error: 'NO_API_KEY' });
        } else if ((currentSettings.engine === 'local-gpu' || currentSettings.engine === 'local-wasm') && !currentSettings.localModel) {
          sendResponse({ error: 'NO_MODEL' });
        } else {
          sendResponse({ error: 'ENGINE_NOT_READY' });
        }
        return;
      }

      // Use requestId to prevent race conditions
      const requestId = `qt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      pendingQuickTranslateId.current = requestId;
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        if (pendingQuickTranslateId.current === requestId) {
          pendingQuickTranslateId.current = null;
        }
        sendResponse({ error: 'TIMEOUT' });
        worker.current?.removeEventListener('message', handler);
      }, 15000);

      const handler = (ev: MessageEvent<WorkerOutboundMessage>) => {
        const d = ev.data;
        if ((d.type === 'complete' || d.type === 'error') && d.requestId === requestId) {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          if (pendingQuickTranslateId.current === requestId) {
            pendingQuickTranslateId.current = null;
          }
          if (d.type === 'complete') {
            sendResponse({ translatedText: d.text || 'Translation failed.' });
          } else {
            sendResponse({ translatedText: 'Translation failed.' });
          }
          worker.current?.removeEventListener('message', handler);
        }
      };

      worker.current.addEventListener('message', handler);
      worker.current.postMessage({
        type: 'generate',
        text,
        mode: 'translate',
        settings: currentSettings,
        requestId,
      });
      return true; // keep sendResponse channel open
    };

    browser.runtime.onMessage.addListener(runtimeListener as Parameters<typeof browser.runtime.onMessage.addListener>[0]);
    browser.storage.onChanged.addListener(storageListener);

    return () => {
      browser.runtime.onMessage.removeListener(runtimeListener as Parameters<typeof browser.runtime.onMessage.removeListener>[0]);
      browser.storage.onChanged.removeListener(storageListener);
      worker.current?.terminate();
    };
  }, []);

  const postMessage = useCallback((msg: unknown) => {
    worker.current?.postMessage(msg);
  }, []);

  return { postMessage };
}
