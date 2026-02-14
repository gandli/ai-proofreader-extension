import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
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

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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
            }
          });
        }
      } else if (type === 'error') {
        const targetMode = event.data.mode!;
        console.error(`[App] Error in ${targetMode}:`, error);
        setError(`${targetMode}: ${error ?? 'Unknown error'}`);
        setGeneratingModes((prev) => ({ ...prev, [targetMode]: false }));
      }
    };

    // Initial load of selected text and settings
    browser.storage.local
      .get(['selectedText', 'settings'])
      .then(async (res: Record<string, unknown>) => {
        let initialText = (res.selectedText as string) || '';

        // If no text selected, try to get page content
        if (!initialText) {
          if (typeof browser !== 'undefined' && browser.tabs) {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0 && tabs[0].id) {
              const response = (await browser.tabs.sendMessage(tabs[0].id, {
                type: 'GET_PAGE_CONTENT',
              })) as { content?: string };
              if (response && response.content) {
                initialText = response.content;
              }
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
            setStatus('ready');
          }
        }
      });

    const listener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName === 'local' && changes.selectedText) {
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
    };
    browser.storage.onChanged.addListener(listener);

    return () => {
      browser.storage.onChanged.removeListener(listener);
      worker.current?.terminate();
    };
  }, []);

  const loadModel = () => {
    setStatus('loading');
    worker.current?.postMessage({ type: 'load', settings });
  };

  const handleFetchContent = async () => {
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
    } catch (e) {}
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
    <div className="sidepanel-container">
      <main className="content">
        {status === 'loading' && (
          <div className="progress-container">
            <div className="progress-bar-outer">
              <div className="progress-bar-inner" style={{ width: `${progress.progress}%` }}></div>
            </div>
            <div className="progress-detail">{progress.text}</div>
            <small style={{ marginTop: '12px', color: '#a0aec0' }}>{t.loading_tip}</small>
          </div>
        )}
        <div className="mode-container">
          <section className="mode-selector">
            <button
              className={`mode-btn ${mode === 'summarize' ? 'active' : ''}`}
              onClick={() => setMode('summarize')}
            >
              {t.mode_summarize}
            </button>
            <button
              className={`mode-btn ${mode === 'correct' ? 'active' : ''}`}
              onClick={() => setMode('correct')}
            >
              {t.mode_correct}
            </button>
            <button
              className={`mode-btn ${mode === 'proofread' ? 'active' : ''}`}
              onClick={() => setMode('proofread')}
            >
              {t.mode_proofread}
            </button>
            <button
              className={`mode-btn ${mode === 'translate' ? 'active' : ''}`}
              onClick={() => setMode('translate')}
            >
              {t.mode_translate}
            </button>
            <button
              className={`mode-btn ${mode === 'expand' ? 'active' : ''}`}
              onClick={() => setMode('expand')}
            >
              {t.mode_expand}
            </button>
          </section>

          <button
            className="settings-btn mode-settings-btn"
            onClick={() => {
              setShowSettings(true);
            }}
          >
            <SettingsIcon />
          </button>
        </div>
        <section className="input-area">
          <div className="section-header">
            <h3>{t.original_text}</h3>
            <div className="header-actions">
              <button className="fetch-btn" onClick={handleClear} title={t.clear_btn || 'Clear'}>
                <ClearIcon />
              </button>
              <button
                className="fetch-btn primary-action-btn"
                onClick={handleFetchContent}
                title={t.fetch_page_content || 'Fetch Page Content'}
              >
                <FetchIcon />
              </button>
            </div>
          </div>
          <div className="input-wrapper">
            <textarea
              className="text-box editable"
              value={selectedText}
              onChange={(e) => setSelectedText(e.target.value)}
              placeholder={t.placeholder}
            />
            {selectedText && (
              <div className="char-count">
                {selectedText.length} {t.char_count}
              </div>
            )}
          </div>
        </section>

        {(modeResults[mode] || generatingModes[mode]) && (
          <section className="output-area" style={{ opacity: status === 'loading' ? 0.3 : 1 }}>
            <div className="section-header">
              <h3>
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
                  className="fetch-btn"
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
              <p style={{ fontSize: '11px', color: '#718096', marginBottom: '8px' }}>
                {t.wasm_warning}
              </p>
            )}
            <div className="output-wrapper">
              <textarea
                className="text-box result"
                value={modeResults[mode]}
                onChange={(e) => setModeResults(prev => ({ ...prev, [mode]: e.target.value }))}
                placeholder={generatingModes[mode] ? t.thinking : ''}
                readOnly={generatingModes[mode]}
              />
              {modeResults[mode] && (
                <div className="char-count">
                  {modeResults[mode].length} {t.char_count}
                </div>
              )}
            </div>
          </section>
        )}

        {error && (
          <p className="error-message">
            {t.status_error}: {error}
          </p>
        )}
      </main>

      {showSettings && (
        <div className="settings-overlay">
          <div className="settings-view">
            <div className="settings-header">
              <h2>{t.settings}</h2>
              <button className="close-settings-btn" onClick={() => setShowSettings(false)}>
                <CloseIcon />
              </button>
            </div>

            <div className="settings-group">
              <h3>{t.core_settings}</h3>
              <div className="field">
                <label>{t.lang_label}</label>
                <select
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
              <div className="field">
                <label>{t.engine_label}</label>
                <select
                  value={settings.engine}
                  onChange={(e) => updateSettings({ engine: e.target.value })}
                >
                  <option value="local-gpu">{t.engine_webgpu}</option>
                  <option value="local-wasm">{t.engine_wasm}</option>
                  <option value="online">{t.engine_online}</option>
                </select>
              </div>
              {(settings.engine === 'local-gpu' || settings.engine === 'local-wasm') && (
                <div className="field">
                  <label>{t.model_label}</label>
                  <select
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
              <div className="settings-group">
                <h3>{t.api_config}</h3>
                <div className="field">
                  <label>API Base URL</label>
                  <input
                    type="text"
                    value={settings.apiBaseUrl}
                    onChange={(e) => updateSettings({ apiBaseUrl: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>API Key</label>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => updateSettings({ apiKey: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Model ID</label>
                  <input
                    type="text"
                    value={settings.apiModel}
                    onChange={(e) => updateSettings({ apiModel: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="settings-group">
              <h3>{t.func_pref}</h3>
              <div className="field">
                <label>{t.tone_label}</label>
                <select
                  value={settings.tone}
                  onChange={(e) => updateSettings({ tone: e.target.value })}
                >
                  <option value="professional">{t.tone_professional}</option>
                  <option value="casual">{t.tone_casual}</option>
                  <option value="academic">{t.tone_academic}</option>
                  <option value="concise">{t.tone_concise}</option>
                </select>
              </div>
              <div className="field">
                <label>{t.detail_label}</label>
                <select
                  value={settings.detailLevel}
                  onChange={(e) => updateSettings({ detailLevel: e.target.value })}
                >
                  <option value="standard">{t.detail_standard}</option>
                  <option value="detailed">{t.detail_detailed}</option>
                  <option value="creative">{t.detail_creative}</option>
                </select>
              </div>
              <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="autoSpeak"
                  checked={settings.autoSpeak}
                  onChange={(e) => updateSettings({ autoSpeak: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="autoSpeak" style={{ cursor: 'pointer', marginBottom: 0 }}>
                  {t.auto_speak_label}
                </label>
              </div>
            </div>

            <div className="settings-group">
              <h3>{t.offline_import_title}</h3>
              <div className="field">
                <p style={{ fontSize: '12px', color: '#718096', marginBottom: '8px' }}>
                  {t.offline_import_tip}
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    position: 'relative',
                  }}
                >
                  <button
                    className="secondary-btn"
                    style={{ width: '100%', padding: '8px', fontSize: '13px' }}
                    onClick={() => document.getElementById('folder-input')?.click()}
                  >
                    {t.offline_import_btn}
                  </button>
                  <input
                    id="folder-input"
                    type="file"
                    webkitdirectory="true"
                    style={{ display: 'none' }}
                    onChange={handleFileImport}
                  />

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="secondary-btn"
                      style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                      onClick={handleExportModel}
                      disabled={status === 'loading'}
                    >
                      <ExportIcon />
                      {t.export_btn}
                    </button>
                    <button
                      className="secondary-btn"
                      style={{ flex: 1, padding: '8px', fontSize: '12px' }}
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
                      style={{ display: 'none' }}
                      onChange={handleImportPackage}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="compact-footer">
        {status === 'loading' ? (
          <button className="primary-btn" disabled>
            {progress.text || `${t.status_loading} ${Math.round(progress.progress)}%`}
          </button>
        ) : status === 'error' ? (
          <button
            className="primary-btn"
            onClick={() => setStatus('idle')}
            style={{ background: '#e53e3e' }}
          >
            {t.status_error} (Click to Reset)
          </button>
        ) : status === 'idle' &&
          (settings.engine === 'local-gpu' || settings.engine === 'local-wasm') ? (
          <button className="primary-btn" onClick={loadModel}>
            {t.action_btn_load} ({settings.engine === 'local-gpu' ? 'WebGPU' : 'WASM'})
          </button>
        ) : (
          <button
            className="primary-btn"
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
