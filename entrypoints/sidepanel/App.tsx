import { useState, useEffect, useRef, useCallback } from 'react';

import { translations } from './i18n';
import {
  SettingsIcon,
  FetchIcon,
  CloseIcon,
  ExportIcon,
  ImportIcon,
  ClearIcon,
} from './components/Icons';

type ModeKey = 'summarize' | 'correct' | 'proofread' | 'translate' | 'expand';

interface Settings {
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

interface WorkerMessage {
  type: 'progress' | 'ready' | 'update' | 'complete' | 'error';
  progress?: { progress: number; text: string };
  text?: string;
  error?: string;
  mode?: ModeKey;
}

function App() {
  const [selectedText, setSelectedText] = useState('');
  const [modeResults, setModeResults] = useState<Record<ModeKey, string>>({
    summarize: '',
    correct: '',
    proofread: '',
    translate: '',
    expand: '',
  });
  const [mode, setMode] = useState<ModeKey>('summarize');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [generatingModes, setGeneratingModes] = useState<Record<ModeKey, boolean>>({
    summarize: false,
    correct: false,
    proofread: false,
    translate: false,
    expand: false,
  });
  const [progress, setProgress] = useState({ progress: 0, text: '' });
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<Settings>({
    engine: 'local-gpu', // local-gpu, local-wasm, online
    extensionLanguage: '中文', // Global target language
    tone: 'professional', // professional, casual, academic, concise
    detailLevel: 'standard', // standard, detailed, creative
    localModel: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    apiBaseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    apiModel: 'gpt-3.5-turbo',
    autoSpeak: false,
  });
  const worker = useRef<Worker | null>(null);
  const settingsRef = useRef(settings);
  const statusRef = useRef(status);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    statusRef.current = status;
    // Sync status to local storage so content script can know proactively
    browser.storage.local.set({ engineStatus: status });
  }, [status]);

  useEffect(() => {
    // Initialize Worker
    worker.current = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.current.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const { type, progress, text, error } = event.data;
      if (type === 'progress' && progress) {
        setProgress(progress);
      } else if (type === 'ready') {
        setStatus('ready');
        setError('');
      } else if (type === 'update') {
        const targetMode = event.data.mode!;

        setModeResults((prev) => ({ ...prev, [targetMode]: text ?? '' }));
        setGeneratingModes((prev) => ({ ...prev, [targetMode]: true }));
      } else if (type === 'complete') {
        const targetMode = event.data.mode!;

        setModeResults((prev) => ({ ...prev, [targetMode]: text ?? '' }));
        setGeneratingModes((prev) => ({ ...prev, [targetMode]: false }));
        // Auto-speak result if enabled
        const currentSettings = settingsRef.current;
        if (currentSettings.autoSpeak && typeof chrome !== 'undefined' && chrome.tts) {
          console.log('[App] Auto-speaking result:', text?.substring(0, 50) + '...');
          chrome.tts.speak(text ?? '', {
            rate: 1.0,
            onEvent: (event) => {
              if (event.type === 'error') {
                console.error('[App] TTS Error:', event.errorMessage);
              }
            },
          });
        }
      } else if (type === 'error') {
        const targetMode = event.data.mode;
        const errorContent = error ?? 'Unknown error';

        if (!targetMode) {
          // This is likely a global/loading error
          console.error('[App] Global/Load Error:', errorContent);
          setError(`Load Error: ${errorContent}`);
          setStatus('error');
          // Reset all generating states on global error
          setGeneratingModes({
            summarize: false,
            correct: false,
            proofread: false,
            translate: false,
            expand: false,
          });
        } else {
          console.error(`[App] Error in ${targetMode}:`, errorContent);
          setError(`${targetMode}: ${errorContent}`);
          setGeneratingModes((prev) => ({ ...prev, [targetMode]: false }));
        }
      }
    };

    // Initial load of selected text and settings
    browser.storage.local
      .get(['selectedText', 'settings', 'activeTab'])
      .then(async (res: Record<string, unknown>) => {
        let initialText = (res.selectedText as string) || '';
        if (res.activeTab === 'settings') {
          setShowSettings(true);
          // Clear it so it doesn't persist on next normal open
          browser.storage.local.remove('activeTab');
        }

        // If no text selected, try to get page content
        if (!initialText) {
          if (typeof browser !== 'undefined' && browser.tabs) {
            try {
              const tabs = await browser.tabs.query({ active: true, currentWindow: true });
              if (tabs.length > 0 && tabs[0].id) {
                const response = (await browser.tabs.sendMessage(tabs[0].id, {
                  type: 'GET_PAGE_CONTENT',
                })) as { content?: string };
                if (response && response.content) {
                  initialText = response.content;
                }
              }
            } catch (e) {
              console.warn('[App] Initial content fetch failed (likely connection issue):', e);
            }
          }
        }

        setSelectedText(initialText);

        if (res.settings) {
          // Migrate targetLanguage to extensionLanguage if exists
          const savedSettings = res.settings as Record<string, unknown>;
          const initialSettings: Settings = {
            ...settings,
            ...(savedSettings as Partial<Settings>),
          };
          if (savedSettings.targetLanguage && !savedSettings.extensionLanguage) {
            initialSettings.extensionLanguage = savedSettings.targetLanguage as string;
          }
          // Restore API key from session storage (more secure)
          try {
            const sessionData = await browser.storage.session.get(['apiKey']);
            if (sessionData.apiKey) {
              initialSettings.apiKey = sessionData.apiKey as string;
            }
          } catch {
            // session storage may not be available in all contexts
          }
          setSettings(initialSettings);
          if (savedSettings.engine === 'online') {
            // Online engine is ready by default if API key is present
            if (initialSettings.apiKey) setStatus('ready');
          }
        }
      });

    const listener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName === 'local') {
        if (changes.selectedText) {
          const newText = (changes.selectedText.newValue as string) || '';
          setSelectedText(newText);
          // Clear all previous results when new text is selected
          setModeResults({
            summarize: '',
            correct: '',
            proofread: '',
            translate: '',
            expand: '',
          });
        }
        if (changes.activeTab && changes.activeTab.newValue === 'settings') {
          setShowSettings(true);
          browser.storage.local.remove('activeTab');
        }
      }
    };
    const runtimeListener = (message: any, sender: any, sendResponse: (res?: any) => void) => {
      if (message.type === 'QUICK_TRANSLATE') {
        const text = message.text;
        const currentSettings = settingsRef.current;
        console.log('[App] Received QUICK_TRANSLATE request.');

        const currentStatus = statusRef.current;
        if (currentStatus === 'loading') {
          console.warn('[App] Engine is still loading, returning ENGINE_LOADING');
          sendResponse({ error: 'ENGINE_LOADING' });
          return;
        }

        if (!worker.current || currentStatus === 'idle' || currentStatus === 'error') {
          console.warn(
            '[App] Worker not initialized or engine not ready for QUICK_TRANSLATE, status:',
            currentStatus,
          );
          // Check why worker is not initialized
          if (currentSettings.engine === 'online' && !currentSettings.apiKey) {
            sendResponse({ error: 'NO_API_KEY' });
          } else if (
            (currentSettings.engine === 'local-gpu' || currentSettings.engine === 'local-wasm') &&
            !currentSettings.localModel
          ) {
            sendResponse({ error: 'NO_MODEL' });
          } else {
            // General not ready
            sendResponse({ error: 'ENGINE_NOT_READY' });
          }
          return;
        }

        // Timeout for safety
        const timeoutId = setTimeout(() => {
          console.warn('[App] QUICK_TRANSLATE timed out.');
          sendResponse({ error: 'TIMEOUT' });
          worker.current?.removeEventListener('message', handleTranslateResponse);
        }, 15000);

        const handleTranslateResponse = (event: MessageEvent<WorkerMessage>) => {
          const { type, text: resultText, mode: resultMode } = event.data;
          if ((type === 'complete' || type === 'error') && resultMode === 'translate') {
            clearTimeout(timeoutId);
            sendResponse({ translatedText: resultText || 'Translation failed.' });
            worker.current?.removeEventListener('message', handleTranslateResponse);
          }
        };

        worker.current.addEventListener('message', handleTranslateResponse);
        worker.current.postMessage({
          type: 'generate',
          text,
          mode: 'translate',
          settings: currentSettings,
        });
        return true;
      }
    };
    browser.runtime.onMessage.addListener(runtimeListener);

    browser.storage.onChanged.addListener(listener);

    return () => {
      browser.runtime.onMessage.removeListener(runtimeListener);
      browser.storage.onChanged.removeListener(listener);
      worker.current?.terminate();
    };
  }, []);

  const loadModel = () => {
    setStatus('loading');
    setError('');
    worker.current?.postMessage({ type: 'load', settings });
  };

  const handleFetchContent = async () => {
    setError('');
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].id) {
        const response = (await browser.tabs.sendMessage(tabs[0].id, {
          type: 'GET_PAGE_CONTENT',
        })) as { content?: string };
        if (response && response.content) {
          setSelectedText(response.content);
          // Clear previous results
          setModeResults({
            summarize: '',
            correct: '',
            proofread: '',
            translate: '',
            expand: '',
          });
        }
      }
    } catch (e: any) {
      console.error('[App] Failed to fetch content:', e);
      // If it's a connection error, show a more specific hint
      if (e.message?.includes('Could not establish connection')) {
        setError(t.connection_error);
      } else {
        setError(e.message || t.status_error);
      }
    }
  };

  const handleClear = () => {
    setSelectedText('');
    // Also clear results when manually clearing input
    setModeResults({
      summarize: '',
      correct: '',
      proofread: '',
      translate: '',
      expand: '',
    });
  };

  const handleAction = () => {
    if (!selectedText || generatingModes[mode]) return;
    setError('');
    setGeneratingModes((prev) => ({ ...prev, [mode]: true }));
    // Clear ONLY the current mode's result to show "thinking"
    setModeResults((prev) => ({ ...prev, [mode]: '' }));
    worker.current?.postMessage({
      type: 'generate',
      text: selectedText,
      mode,
      settings,
    });
  };

  const handleCopyResult = useCallback(() => {
    const text = modeResults[mode];
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [modeResults, mode]);

  const updateSettings = async (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    const engineChanged = newSettings.engine && newSettings.engine !== settings.engine;
    const modelChanged = newSettings.localModel && newSettings.localModel !== settings.localModel;

    // Persist settings
    if (typeof browser !== 'undefined' && browser.storage) {
      const { apiKey, ...settingsWithoutKey } = updated;
      await browser.storage.local.set({ settings: { ...settingsWithoutKey, apiKey: '' } });
      if (apiKey) {
        await browser.storage.session.set({ apiKey }).catch(() => {
          browser.storage.local.set({ settings: updated });
        });
      }
    }

    // Handle engine/model side effects
    if (updated.engine === 'online') {
      setStatus('ready');
    } else if (engineChanged || modelChanged || status === 'idle' || status === 'error') {
      setStatus('loading');
      worker.current?.postMessage({ type: 'load', settings: updated });
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setStatus('loading');
    setProgress({ progress: 0, text: t.importing });

    try {
      const cache = await caches.open('webllm/model');
      const total = files.length;
      let count = 0;

      const modelId = settings.localModel;
      const baseUrl = `https://huggingface.co/mlc-ai/${modelId}/resolve/main/`;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.webkitRelativePath.split('/').slice(1).join('/');
        if (!relativePath) continue;

        const url = new URL(relativePath, baseUrl).toString();
        const response = new Response(file);
        await cache.put(url, response);

        count++;
        setProgress({
          progress: (count / total) * 100,
          text: `${t.importing} (${count}/${total})`,
        });
      }

      alert(t.import_success);
      setStatus('idle');
    } catch (err: unknown) {
      console.error('Import failed:', err);
      setError(`${t.import_failed}: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('error');
    }
  };

  const handleExportModel = async () => {
    setStatus('loading');
    setProgress({ progress: 0, text: t.exporting });
    try {
      const cache = await caches.open('webllm/model');
      const keys = await cache.keys();
      const modelId = settings.localModel;

      // Filter keys related to current model
      const filteredKeys = keys.filter((req) => req.url.includes(modelId));
      if (filteredKeys.length === 0) {
        alert('No cached files found for this model.');
        setStatus('ready');
        return;
      }

      const filesData: { url: string; blob: Blob }[] = [];
      for (let i = 0; i < filteredKeys.length; i++) {
        const req = filteredKeys[i];
        const resp = await cache.match(req);
        if (resp) {
          filesData.push({ url: req.url, blob: await resp.blob() });
        }
        setProgress({
          progress: ((i + 1) / filteredKeys.length) * 50,
          text: `${t.exporting} (${i + 1}/${filteredKeys.length})`,
        });
      }

      // Pack into binary format
      // [Magic 4][FileCount 4]
      // For each: [URL_Len 4][URL][Size 8][Data]
      let totalSize = 8;
      for (const f of filesData) {
        totalSize += 4 + f.url.length + 8 + f.blob.size;
      }

      const buffer = new ArrayBuffer(totalSize);
      const view = new DataView(buffer);
      const encoder = new TextEncoder();

      view.setUint32(0, 0x4d4c4350); // "MLCP"
      view.setUint32(4, filesData.length);

      let offset = 8;
      for (let i = 0; i < filesData.length; i++) {
        const f = filesData[i];
        const urlBytes = encoder.encode(f.url);
        view.setUint32(offset, urlBytes.length);
        new Uint8Array(buffer, offset + 4, urlBytes.length).set(urlBytes);
        offset += 4 + urlBytes.length;

        view.setBigUint64(offset, BigInt(f.blob.size));
        const blobData = new Uint8Array(await f.blob.arrayBuffer());
        new Uint8Array(buffer, offset + 8, f.blob.size).set(blobData);
        offset += 8 + f.blob.size;

        setProgress({
          progress: 50 + ((i + 1) / filesData.length) * 50,
          text: `${t.exporting} (Packing ${i + 1}/${filesData.length})`,
        });
      }

      const finalBlob = new Blob([buffer], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${modelId}.mlcp`;
      a.click();
      URL.revokeObjectURL(downloadUrl);

      setStatus('ready');
      alert(t.export_success);
    } catch (err: unknown) {
      console.error('Export failed:', err);
      alert(t.export_failed);
      setStatus('ready');
    }
  };

  const handleImportPackage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('loading');
    setProgress({ progress: 0, text: t.importing });

    try {
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);
      const decoder = new TextDecoder();

      if (view.getUint32(0) !== 0x4d4c4350) {
        throw new Error('Invalid MLCP file format');
      }

      const fileCount = view.getUint32(4);
      const cache = await caches.open('webllm/model');

      let offset = 8;
      for (let i = 0; i < fileCount; i++) {
        const urlLen = view.getUint32(offset);
        const url = decoder.decode(new Uint8Array(buffer, offset + 4, urlLen));
        offset += 4 + urlLen;

        const size = Number(view.getBigUint64(offset));
        const data = new Uint8Array(buffer, offset + 8, size);
        offset += 8 + size;

        await cache.put(url, new Response(data));

        setProgress({
          progress: ((i + 1) / fileCount) * 100,
          text: `${t.importing} (${i + 1}/${fileCount})`,
        });
      }

      alert(t.import_success);
      setStatus('idle');
    } catch (err: unknown) {
      console.error('Import failed:', err);
      alert(`${t.import_failed}: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('error');
    }
  };

  const t = translations[settings.extensionLanguage] || translations['中文'];

  return (
    <div className="flex flex-col h-screen box-border p-3 font-sans bg-[#fbfbfb] text-[#1a1a1a] dark:bg-brand-dark-bg dark:text-slate-200">
      <main className="flex-1 flex flex-col gap-3 pr-1 overflow-y-auto">
        {status === 'loading' && (
          <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-white/90 text-center p-10 dark:bg-[#1a1a2e]/95">
            <div className="w-full h-2 mb-3 overflow-hidden rounded-md bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full bg-brand-orange transition-all duration-300 ease-out"
                style={{ width: `${progress.progress}%` }}
              ></div>
            </div>
            <div className="text-[13px] font-medium text-slate-600 dark:text-slate-400">
              {progress.text}
            </div>
            <small className="mt-3 text-slate-400">{t.loading_tip}</small>
          </div>
        )}
        <div className="flex items-stretch gap-1.5 mb-0.5">
          <section className="flex flex-1 gap-1 p-1 mb-0 rounded-lg bg-brand-orange-light dark:bg-brand-dark-surface">
            <button
              aria-pressed={mode === 'summarize'}
              className={`flex-1 py-2 px-0.5 border-none bg-transparent rounded-md text-[11px] font-semibold text-slate-600 cursor-pointer transition-all hover:bg-brand-orange/10 hover:text-brand-orange dark:text-slate-400 dark:hover:bg-brand-orange/15 dark:hover:text-[#ff7a3d] ${mode === 'summarize' ? 'bg-white text-brand-orange shadow-sm dark:bg-[#2a2a3e] dark:text-[#ff7a3d]' : ''}`}
              onClick={() => setMode('summarize')}
            >
              {t.mode_summarize}
            </button>
            <button
              aria-pressed={mode === 'correct'}
              className={`flex-1 py-2 px-0.5 border-none bg-transparent rounded-md text-[11px] font-semibold text-slate-600 cursor-pointer transition-all hover:bg-brand-orange/10 hover:text-brand-orange dark:text-slate-400 dark:hover:bg-brand-orange/15 dark:hover:text-[#ff7a3d] ${mode === 'correct' ? 'bg-white text-brand-orange shadow-sm dark:bg-[#2a2a3e] dark:text-[#ff7a3d]' : ''}`}
              onClick={() => setMode('correct')}
            >
              {t.mode_correct}
            </button>
            <button
              aria-pressed={mode === 'proofread'}
              className={`flex-1 py-2 px-0.5 border-none bg-transparent rounded-md text-[11px] font-semibold text-slate-600 cursor-pointer transition-all hover:bg-brand-orange/10 hover:text-brand-orange dark:text-slate-400 dark:hover:bg-brand-orange/15 dark:hover:text-[#ff7a3d] ${mode === 'proofread' ? 'bg-white text-brand-orange shadow-sm dark:bg-[#2a2a3e] dark:text-[#ff7a3d]' : ''}`}
              onClick={() => setMode('proofread')}
            >
              {t.mode_proofread}
            </button>
            <button
              aria-pressed={mode === 'translate'}
              className={`flex-1 py-2 px-0.5 border-none bg-transparent rounded-md text-[11px] font-semibold text-slate-600 cursor-pointer transition-all hover:bg-brand-orange/10 hover:text-brand-orange dark:text-slate-400 dark:hover:bg-brand-orange/15 dark:hover:text-[#ff7a3d] ${mode === 'translate' ? 'bg-white text-brand-orange shadow-sm dark:bg-[#2a2a3e] dark:text-[#ff7a3d]' : ''}`}
              onClick={() => setMode('translate')}
            >
              {t.mode_translate}
            </button>
            <button
              aria-pressed={mode === 'expand'}
              className={`flex-1 py-2 px-0.5 border-none bg-transparent rounded-md text-[11px] font-semibold text-slate-600 cursor-pointer transition-all hover:bg-brand-orange/10 hover:text-brand-orange dark:text-slate-400 dark:hover:bg-brand-orange/15 dark:hover:text-[#ff7a3d] ${mode === 'expand' ? 'bg-white text-brand-orange shadow-sm dark:bg-[#2a2a3e] dark:text-[#ff7a3d]' : ''}`}
              onClick={() => setMode('expand')}
            >
              {t.mode_expand}
            </button>
          </section>

          <button
            aria-label={t.settings}
            aria-expanded={showSettings}
            className="flex items-center justify-center px-3 ml-0 text-slate-500 transition-all rounded-lg cursor-pointer bg-brand-orange-light hover:bg-white hover:text-brand-orange hover:shadow-sm dark:bg-brand-dark-surface dark:text-slate-400 dark:hover:bg-[#2a2a3e] dark:hover:text-[#ff7a3d]"
            onClick={() => {
              setShowSettings(true);
            }}
          >
            <SettingsIcon />
          </button>
        </div>
        <section className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="m-0 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
              {t.original_text}
            </h3>
            <div className="flex gap-1.5">
              <button
                aria-label={t.clear_btn || 'Clear'}
                className="flex items-center justify-center p-1.5 text-slate-500 transition-all bg-white border border-slate-200 rounded-md cursor-pointer shadow-sm hover:bg-brand-orange-light hover:border-brand-orange hover:text-brand-orange hover:shadow-md hover:-translate-y-px dark:bg-brand-dark-surface dark:border-slate-700 dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:border-brand-orange dark:hover:text-[#ff7a3d]"
                onClick={handleClear}
                title={t.clear_btn || 'Clear'}
              >
                <ClearIcon />
              </button>
              <button
                aria-label={t.fetch_page_content || 'Fetch Page Content'}
                className="flex items-center justify-center p-1.5 transition-all border rounded-md cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-px bg-brand-orange-light border-brand-orange/20 text-brand-orange hover:bg-brand-orange-light hover:border-brand-orange hover:text-brand-orange dark:bg-brand-dark-surface dark:border-slate-700 dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:border-brand-orange dark:hover:text-[#ff7a3d]"
                onClick={handleFetchContent}
                title={t.fetch_page_content || 'Fetch Page Content'}
              >
                <FetchIcon />
              </button>
            </div>
          </div>
          <div className="relative flex flex-col flex-1 min-h-0">
            <textarea
              className="flex-1 w-full min-h-[80px] p-3.5 text-sm leading-relaxed bg-white border-[1.5px] border-slate-200 rounded-xl outline-none resize-y shadow-sm transition-all whitespace-pre-wrap break-words text-slate-700 hover:border-slate-300 focus:bg-white focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 dark:bg-[#23233a] dark:border-[#3f3f5a] dark:text-slate-200 dark:focus:border-[#ff7a3d] dark:focus:ring-[#ff7a3d]/10 dark:bg-brand-dark-bg"
              value={selectedText}
              onChange={(e) => setSelectedText(e.target.value)}
              placeholder={t.placeholder}
            />
            {selectedText && (
              <div className="absolute bottom-2 right-3 text-[11px] text-slate-400 pointer-events-none bg-white/80 px-1.5 py-0.5 rounded dark:bg-[#1a1a2e]/80 dark:text-slate-500">
                {selectedText.length} {t.char_count}
              </div>
            )}
          </div>
        </section>

        {(modeResults[mode] || generatingModes[mode]) && (
          <section
            className={`flex flex-col flex-1 min-h-0 transition-opacity ${status === 'loading' ? 'opacity-30' : 'opacity-100'}`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="m-0 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                {mode === 'summarize'
                  ? t.result_summarize
                  : mode === 'correct'
                    ? t.result_correct
                    : mode === 'proofread'
                      ? t.result_proofread
                      : mode === 'translate'
                        ? t.result_translate
                        : t.result_expand}
              </h3>
              {modeResults[mode] && (
                <button
                  aria-label={t.copy_btn || 'Copy'}
                  className="flex items-center justify-center p-1.5 text-slate-500 transition-all bg-white border border-slate-200 rounded-md cursor-pointer shadow-sm hover:bg-brand-orange-light hover:border-brand-orange hover:text-brand-orange hover:shadow-md hover:-translate-y-px dark:bg-brand-dark-surface dark:border-slate-700 dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:border-brand-orange dark:hover:text-[#ff7a3d]"
                  onClick={handleCopyResult}
                  title={t.copy_btn || 'Copy'}
                >
                  {copied ? (
                    '✓'
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            {settings.engine === 'local-wasm' && !modeResults[mode] && generatingModes[mode] && (
              <p className="text-[11px] text-slate-500 mb-2 dark:text-slate-400">
                {t.wasm_warning}
              </p>
            )}
            <div className="relative flex flex-col flex-1 min-h-0">
              <textarea
                className="flex-1 w-full min-h-[80px] p-3.5 text-sm leading-relaxed border rounded-xl outline-none resize-y shadow-sm transition-all whitespace-pre-wrap break-words bg-brand-orange-light border-brand-orange/30 animate-[fadeIn_0.4s_cubic-bezier(0.16,1,0.3,1)] focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 dark:bg-brand-orange/10 dark:border-brand-orange/50 dark:text-slate-200 dark:focus:bg-brand-dark-bg dark:focus:border-[#ff7a3d] dark:focus:ring-[#ff7a3d]/10"
                value={modeResults[mode]}
                onChange={(e) => setModeResults((prev) => ({ ...prev, [mode]: e.target.value }))}
                placeholder={generatingModes[mode] ? t.thinking : ''}
                readOnly={generatingModes[mode]}
              />
              {modeResults[mode] && (
                <div className="absolute bottom-2 right-3 text-[11px] text-slate-400 pointer-events-none bg-white/80 px-1.5 py-0.5 rounded dark:bg-[#1a1a2e]/80 dark:text-slate-500">
                  {modeResults[mode].length} {t.char_count}
                </div>
              )}
            </div>
          </section>
        )}

        {error && (
          <p className="p-2 my-2 text-xs text-red-600 rounded-md bg-red-50 dark:bg-[#2d1515] dark:text-red-300">
            {t.status_error}: {error}
          </p>
        )}
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 backdrop-blur-[4px]">
          <div className="flex flex-col gap-4 w-full p-6 pb-4 bg-[#fbfbfb] rounded-t-[20px] max-h-[90vh] overflow-y-auto shadow-[-10px_25px_rgba(0,0,0,0.1)] animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)] dark:bg-brand-dark-bg dark:shadow-[-10px_25px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="m-0 text-xl font-extrabold">{t.settings}</h2>
              <button
                aria-label="Close"
                className="flex items-center justify-center w-8 h-8 text-slate-500 border-none rounded-full cursor-pointer bg-slate-100 dark:bg-brand-dark-surface dark:text-slate-400"
                onClick={() => setShowSettings(false)}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex flex-col gap-3 p-4 bg-white border border-slate-200 rounded-xl dark:bg-brand-dark-surface dark:border-slate-700">
              <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-200">
                {t.core_settings}
              </h3>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-500 font-semibold uppercase dark:text-slate-400">
                  {t.lang_label}
                </label>
                <select
                  className="p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-orange/10 dark:bg-brand-dark-bg dark:border-[#4a4a6a] dark:text-slate-200 dark:focus:bg-brand-dark-surface"
                  value={settings.extensionLanguage}
                  onChange={(e) => updateSettings({ extensionLanguage: e.target.value })}
                >
                  <option value="中文">中文 (简体)</option>
                  <option value="English">English</option>
                  <option value="日本語">日本語</option>
                  <option value="한국어">한국어</option>
                  <option value="Français">Français</option>
                  <option value="Deutsch">Deutsch</option>
                  <option value="Español">Español</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-500 font-semibold uppercase dark:text-slate-400">
                  {t.engine_label}
                </label>
                <select
                  className="p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-orange/10 dark:bg-brand-dark-bg dark:border-[#4a4a6a] dark:text-slate-200 dark:focus:bg-brand-dark-surface"
                  value={settings.engine}
                  onChange={(e) => updateSettings({ engine: e.target.value })}
                >
                  <option value="local-gpu">{t.engine_webgpu}</option>
                  <option value="local-wasm">{t.engine_wasm}</option>
                  <option value="online">{t.engine_online}</option>
                </select>
              </div>
              {(settings.engine === 'local-gpu' || settings.engine === 'local-wasm') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold uppercase dark:text-slate-400">
                    {t.model_label}
                  </label>
                  <select
                    className="p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-orange/10 dark:bg-brand-dark-bg dark:border-[#4a4a6a] dark:text-slate-200 dark:focus:bg-brand-dark-surface"
                    value={settings.localModel}
                    onChange={(e) => updateSettings({ localModel: e.target.value })}
                  >
                    <optgroup label="Qwen (通义千问)">
                      <option value="Qwen2.5-0.5B-Instruct-q4f16_1-MLC">
                        Qwen2.5 0.5B (~380MB)
                      </option>
                      <option value="Qwen2.5-1.5B-Instruct-q4f16_1-MLC">
                        Qwen2.5 1.5B (~1.1GB)
                      </option>
                      <option value="Qwen2-7B-Instruct-q4f16_1-MLC">Qwen2 7B (~4.8GB)</option>
                    </optgroup>
                    <optgroup label="Llama">
                      <option value="Llama-3.2-1B-Instruct-q4f16_1-MLC">
                        Llama 3.2 1B (~780MB)
                      </option>
                      <option value="Llama-3-8B-Instruct-q4f16_1-MLC">Llama 3 8B (~5.2GB)</option>
                      <option value="Llama-2-7b-chat-hf-q4f16_1-MLC">Llama 2 7B (~4.5GB)</option>
                      <option value="Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC">
                        Hermes-2 Pro Llama 3 8B (~5.2GB)
                      </option>
                    </optgroup>
                    <optgroup label="Mistral">
                      <option value="Mistral-7B-Instruct-v0.3-q4f16_1-MLC">
                        Mistral 7B v0.3 (~4.7GB)
                      </option>
                      <option value="Hermes-2-Pro-Mistral-7B-q4f16_1-MLC">
                        Hermes-2 Pro Mistral 7B (~4.7GB)
                      </option>
                      <option value="NeuralHermes-2.5-Mistral-7B-q4f16_1-MLC">
                        NeuralHermes 2.5 Mistral 7B (~4.7GB)
                      </option>
                      <option value="OpenHermes-2.5-Mistral-7B-q4f16_1-MLC">
                        OpenHermes 2.5 Mistral 7B (~4.7GB)
                      </option>
                    </optgroup>
                    <optgroup label="Phi">
                      <option value="Phi-3-mini-4k-instruct-q4f16_1-MLC">
                        Phi 3 Mini (~2.3GB)
                      </option>
                      <option value="Phi-2-q4f16_1-MLC">Phi 2 (~1.6GB)</option>
                      <option value="Phi-1_5-q4f16_1-MLC">Phi 1.5 (~0.9GB)</option>
                    </optgroup>
                    <optgroup label="Gemma">
                      <option value="gemma-2b-it-q4f16_1-MLC">Gemma 2B (~1.7GB)</option>
                    </optgroup>
                  </select>
                </div>
              )}
            </div>

            {settings.engine === 'online' && (
              <div className="flex flex-col gap-3 p-4 bg-white border border-slate-200 rounded-xl dark:bg-brand-dark-surface dark:border-slate-700">
                <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-200">
                  {t.api_config}
                </h3>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold uppercase dark:text-slate-400">
                    API Base URL
                  </label>
                  <input
                    className="p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-orange/10 dark:bg-brand-dark-bg dark:border-[#4a4a6a] dark:text-slate-200 dark:focus:bg-brand-dark-surface"
                    type="text"
                    value={settings.apiBaseUrl}
                    onChange={(e) => updateSettings({ apiBaseUrl: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold uppercase dark:text-slate-400">
                    API Key
                  </label>
                  <input
                    className="p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-orange/10 dark:bg-brand-dark-bg dark:border-[#4a4a6a] dark:text-slate-200 dark:focus:bg-brand-dark-surface"
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => updateSettings({ apiKey: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold uppercase dark:text-slate-400">
                    Model ID
                  </label>
                  <input
                    className="p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-orange/10 dark:bg-brand-dark-bg dark:border-[#4a4a6a] dark:text-slate-200 dark:focus:bg-brand-dark-surface"
                    type="text"
                    value={settings.apiModel}
                    onChange={(e) => updateSettings({ apiModel: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 p-4 bg-white border border-slate-200 rounded-xl dark:bg-brand-dark-surface dark:border-slate-700">
              <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-200">
                {t.func_pref}
              </h3>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-500 font-semibold uppercase dark:text-slate-400">
                  {t.tone_label}
                </label>
                <select
                  className="p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-orange/10 dark:bg-brand-dark-bg dark:border-[#4a4a6a] dark:text-slate-200 dark:focus:bg-brand-dark-surface"
                  value={settings.tone}
                  onChange={(e) => updateSettings({ tone: e.target.value })}
                >
                  <option value="professional">{t.tone_professional}</option>
                  <option value="casual">{t.tone_casual}</option>
                  <option value="academic">{t.tone_academic}</option>
                  <option value="concise">{t.tone_concise}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-500 font-semibold uppercase dark:text-slate-400">
                  {t.detail_label}
                </label>
                <select
                  className="p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-orange/10 dark:bg-brand-dark-bg dark:border-[#4a4a6a] dark:text-slate-200 dark:focus:bg-brand-dark-surface"
                  value={settings.detailLevel}
                  onChange={(e) => updateSettings({ detailLevel: e.target.value })}
                >
                  <option value="standard">{t.detail_standard}</option>
                  <option value="detailed">{t.detail_detailed}</option>
                  <option value="creative">{t.detail_creative}</option>
                </select>
              </div>
              <div className="flex items-center gap-2.5 mt-1">
                <input
                  type="checkbox"
                  id="autoSpeak"
                  checked={settings.autoSpeak}
                  onChange={(e) => updateSettings({ autoSpeak: e.target.checked })}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="autoSpeak" className="cursor-pointer mb-0">
                  {t.auto_speak_label}
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-4 bg-white border border-slate-200 rounded-xl dark:bg-brand-dark-surface dark:border-slate-700">
              <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-200">
                {t.offline_import_title}
              </h3>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-slate-500 mb-2">{t.offline_import_tip}</p>
                <div className="flex flex-col gap-2 relative">
                  <button
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer transition-all w-full hover:bg-brand-orange-light hover:border-brand-orange hover:text-brand-orange hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-dark-bg dark:border-slate-700 dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:border-brand-orange dark:hover:text-[#ff7a3d]"
                    onClick={() => document.getElementById('folder-input')?.click()}
                  >
                    {t.offline_import_btn}
                  </button>
                  <input
                    id="folder-input"
                    type="file"
                    webkitdirectory="true"
                    className="hidden"
                    onChange={handleFileImport}
                  />

                  <div className="flex gap-2">
                    <button
                      className="flex items-center justify-center gap-1.5 py-2 px-3 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer transition-all flex-1 text-xs hover:bg-brand-orange-light hover:border-brand-orange hover:text-brand-orange hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-dark-bg dark:border-slate-700 dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:border-brand-orange dark:hover:text-[#ff7a3d]"
                      onClick={handleExportModel}
                      disabled={status === 'loading'}
                    >
                      <ExportIcon />
                      {t.export_btn}
                    </button>
                    <button
                      className="flex items-center justify-center gap-1.5 py-2 px-3 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer transition-all flex-1 text-xs hover:bg-brand-orange-light hover:border-brand-orange hover:text-brand-orange hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-dark-bg dark:border-slate-700 dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:border-brand-orange dark:hover:text-[#ff7a3d]"
                      onClick={() => document.getElementById('pkg-input')?.click()}
                      disabled={status === 'loading'}
                    >
                      <ImportIcon />
                      {t.import_pkg_btn}
                    </button>
                    <input
                      id="pkg-input"
                      type="file"
                      accept=".mlcp"
                      className="hidden"
                      onChange={handleImportPackage}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="sticky bottom-0 left-0 right-0 p-3 bg-[#fbfbfb] border-t border-slate-100 dark:bg-brand-dark-bg dark:border-slate-800">
        {status === 'loading' ? (
          <button
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-brand-orange border-none rounded-xl cursor-pointer shadow-md shadow-brand-orange/20 transition-all hover:bg-brand-orange-dark hover:shadow-lg hover:shadow-brand-orange/30 active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
            disabled
          >
            {progress.text || `${t.status_loading} ${Math.round(progress.progress)}%`}
          </button>
        ) : status === 'error' ? (
          <button
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#e53e3e] border-none rounded-xl cursor-pointer shadow-md shadow-brand-orange/20 transition-all hover:bg-brand-orange-dark hover:shadow-lg hover:shadow-brand-orange/30 active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
            onClick={() => setStatus('idle')}
          >
            {t.status_error} (Click to Reset)
          </button>
        ) : status === 'idle' &&
          (settings.engine === 'local-gpu' || settings.engine === 'local-wasm') ? (
          <button
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-brand-orange border-none rounded-xl cursor-pointer shadow-md shadow-brand-orange/20 transition-all hover:bg-brand-orange-dark hover:shadow-lg hover:shadow-brand-orange/30 active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
            onClick={loadModel}
          >
            {t.action_btn_load} ({settings.engine === 'local-gpu' ? 'WebGPU' : 'WASM'})
          </button>
        ) : (
          <button
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-brand-orange border-none rounded-xl cursor-pointer shadow-md shadow-brand-orange/20 transition-all hover:bg-brand-orange-dark hover:shadow-lg hover:shadow-brand-orange/30 active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
            onClick={handleAction}
            disabled={!selectedText || generatingModes[mode]}
          >
            {generatingModes[mode]
              ? t.action_generating
              : `${t.action_btn_execute}${
                  mode === 'summarize'
                    ? t.mode_summarize
                    : mode === 'correct'
                      ? t.mode_correct
                      : mode === 'proofread'
                        ? t.mode_proofread
                        : mode === 'translate'
                          ? t.mode_translate
                          : t.mode_expand
                }`}
          </button>
        )}
      </footer>
    </div>
  );
}

export default App;
