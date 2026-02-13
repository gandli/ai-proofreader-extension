import { useState, useEffect, useRef } from 'react';
import './App.css';
import { translations } from './i18n';

function App() {
    const [selectedText, setSelectedText] = useState('');
    const [modeResults, setModeResults] = useState<Record<string, string>>({
        summarize: '',
        correct: '',
        proofread: '',
        translate: '',
        expand: ''
    });
    const [mode, setMode] = useState('summarize'); // summarize, correct, proofread, translate, expand
    const [status, setStatus] = useState('idle'); // idle, loading, ready, error
    const [generatingModes, setGeneratingModes] = useState<Record<string, boolean>>({
        summarize: false,
        correct: false,
        proofread: false,
        translate: false,
        expand: false
    });
    const [progress, setProgress] = useState({ progress: 0, text: '' });
    const [error, setError] = useState('');
    const [showSettings, setShowSettings] = useState(false);

    // Settings State
    const [settings, setSettings] = useState({
        engine: 'local-gpu', // local-gpu, local-wasm, online
        extensionLanguage: '中文', // Global target language
        tone: 'professional', // professional, casual, academic, concise
        detailLevel: 'standard', // standard, detailed, creative
        localModel: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        apiModel: 'gpt-3.5-turbo'
    });
    const [tempSettings, setTempSettings] = useState(settings);

    const worker = useRef<Worker | null>(null);

    useEffect(() => {
        // Initialize Worker
        worker.current = new Worker(new URL('./worker.ts', import.meta.url), {
            type: 'module',
        });

        worker.current.onmessage = (event) => {
            const { type, progress, text, error } = event.data;
            if (type === 'progress') {
                setProgress(progress);
            } else if (type === 'ready') {
                setStatus('ready');
            } else if (type === 'update') {
                const targetMode = event.data.mode || mode;
                console.log(`[App] Update: ${targetMode}, len: ${text.length}`);
                setModeResults(prev => ({ ...prev, [targetMode]: text }));
                setGeneratingModes(prev => ({ ...prev, [targetMode]: true }));
            } else if (type === 'complete') {
                const targetMode = event.data.mode || mode;
                console.log(`[App] Complete: ${targetMode}, len: ${text.length}`);
                setModeResults(prev => ({ ...prev, [targetMode]: text }));
                setGeneratingModes(prev => ({ ...prev, [targetMode]: false }));
            } else if (type === 'error') {
                const targetMode = event.data.mode || mode;
                console.error(`[App] Error in ${targetMode}:`, error);
                setError(`${targetMode}: ${error}`);
                setGeneratingModes(prev => ({ ...prev, [targetMode]: false }));
            }
        };

        // Initial load of selected text and settings
        browser.storage.local.get(['selectedText', 'settings']).then((res: any) => {
            setSelectedText(res.selectedText || '');
            if (res.settings) {
                // Migrate targetLanguage to extensionLanguage if exists
                const initialSettings = { ...settings, ...res.settings };
                if (res.settings.targetLanguage && !res.settings.extensionLanguage) {
                    initialSettings.extensionLanguage = res.settings.targetLanguage;
                }
                setSettings(initialSettings);
                setTempSettings(initialSettings);
                if (res.settings.engine === 'online') {
                    setStatus('ready');
                }
            }
        });

        const listener = (changes: any, areaName: string) => {
            if (areaName === 'local' && changes.selectedText) {
                const newText = changes.selectedText.newValue || '';
                setSelectedText(newText);
                // Clear all previous results when new text is selected
                setModeResults({
                    summarize: '',
                    correct: '',
                    proofread: '',
                    translate: '',
                    expand: ''
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

    const handleAction = () => {
        if (!selectedText || generatingModes[mode]) return;
        console.log(`[App] Requesting ${mode} (${settings.engine}) for:`, selectedText);
        setGeneratingModes(prev => ({ ...prev, [mode]: true }));
        // Clear ONLY the current mode's result to show "thinking"
        setModeResults(prev => ({ ...prev, [mode]: '' }));
        worker.current?.postMessage({
            type: 'generate',
            text: selectedText,
            mode,
            settings
        });
    };

    const applySettings = () => {
        const engineChanged = settings.engine !== tempSettings.engine;
        const modelChanged = settings.localModel !== tempSettings.localModel;

        setSettings(tempSettings);
        browser.storage.local.set({ settings: tempSettings });

        if (tempSettings.engine === 'online') {
            setStatus('ready');
            setShowSettings(false);
        } else if (engineChanged || modelChanged || status === 'idle' || status === 'error') {
            setStatus('loading');
            worker.current?.postMessage({ type: 'load', settings: tempSettings });
            setShowSettings(false);
        } else {
            setShowSettings(false);
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

            const modelId = tempSettings.localModel;
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
                    text: `${t.importing} (${count}/${total})`
                });
            }

            alert(t.import_success);
            setStatus('idle');
        } catch (err: any) {
            console.error("Import failed:", err);
            setError(`${t.import_failed}: ${err.message}`);
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
            const filteredKeys = keys.filter(req => req.url.includes(modelId));
            if (filteredKeys.length === 0) {
                alert("No cached files found for this model.");
                setStatus('ready');
                return;
            }

            const filesData: { url: string, blob: Blob }[] = [];
            for (let i = 0; i < filteredKeys.length; i++) {
                const req = filteredKeys[i];
                const resp = await cache.match(req);
                if (resp) {
                    filesData.push({ url: req.url, blob: await resp.blob() });
                }
                setProgress({
                    progress: ((i + 1) / filteredKeys.length) * 50,
                    text: `${t.exporting} (${i + 1}/${filteredKeys.length})`
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

            view.setUint32(0, 0x4D4C4350); // "MLCP"
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
                    progress: 50 + (((i + 1) / filesData.length) * 50),
                    text: `${t.exporting} (Packing ${i + 1}/${filesData.length})`
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
        } catch (err: any) {
            console.error("Export failed:", err);
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

            if (view.getUint32(0) !== 0x4D4C4350) {
                throw new Error("Invalid MLCP file format");
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
                    text: `${t.importing} (${i + 1}/${fileCount})`
                });
            }

            alert(t.import_success);
            setStatus('idle');
        } catch (err: any) {
            console.error("Import failed:", err);
            alert(`${t.import_failed}: ${err.message}`);
            setStatus('error');
        }
    };

    const t = showSettings
        ? (translations[tempSettings.extensionLanguage] || translations['中文'])
        : (translations[settings.extensionLanguage] || translations['中文']);

    return (
        <div className="sidepanel-container">
            <header>
                <h1>{t.title}</h1>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className={`status-badge ${status}`}>
                        {status === 'idle' && t.status_idle}
                        {status === 'loading' && `${t.status_loading} ${Math.round(progress.progress)}%`}
                        {status === 'ready' && (settings.engine === 'online' ? t.status_ready_online : t.status_ready_local)}
                        {Object.values(generatingModes).some(v => v) && t.status_generating}
                        {status === 'error' && t.status_error}
                    </div>
                    <button className="settings-btn" onClick={() => {
                        setTempSettings(settings); // Sync when opening
                        setShowSettings(true);
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                    </button>
                </div>
            </header>

            <main className="content">
                {status === 'loading' && (
                    <div className="progress-container">
                        <div className="progress-bar-outer">
                            <div className="progress-bar-inner" style={{ width: `${progress.progress}%` }}></div>
                        </div>
                        <div className="progress-detail">{progress.text}</div>
                        <small style={{ marginTop: '12px', color: '#a0aec0' }}>
                            {t.loading_tip}
                        </small>
                    </div>
                )}

                <section className="mode-selector">
                    <button
                        className={`mode-btn ${mode === 'summarize' ? 'active' : ''}`}
                        onClick={() => setMode('summarize')}
                    >{t.mode_summarize}</button>
                    <button
                        className={`mode-btn ${mode === 'correct' ? 'active' : ''}`}
                        onClick={() => setMode('correct')}
                    >{t.mode_correct}</button>
                    <button
                        className={`mode-btn ${mode === 'proofread' ? 'active' : ''}`}
                        onClick={() => setMode('proofread')}
                    >{t.mode_proofread}</button>
                    <button
                        className={`mode-btn ${mode === 'translate' ? 'active' : ''}`}
                        onClick={() => setMode('translate')}
                    >{t.mode_translate}</button>
                    <button
                        className={`mode-btn ${mode === 'expand' ? 'active' : ''}`}
                        onClick={() => setMode('expand')}
                    >{t.mode_expand}</button>
                </section>

                <section className="input-area">
                    <h3>{t.original_text}</h3>
                    <div className="text-box">
                        {selectedText || <span className="placeholder">{t.placeholder}</span>}
                    </div>
                </section>

                {(modeResults[mode] || generatingModes[mode]) && (
                    <section className="output-area" style={{ opacity: status === 'loading' ? 0.3 : 1 }}>
                        <h3>{
                            mode === 'summarize' ? t.result_summarize :
                                mode === 'correct' ? t.result_correct :
                                    mode === 'proofread' ? t.result_proofread :
                                        mode === 'translate' ? t.result_translate :
                                            t.result_expand
                        }</h3>
                        {settings.engine === 'local-wasm' && !modeResults[mode] && generatingModes[mode] && (
                            <p style={{ fontSize: '11px', color: '#718096', marginBottom: '8px' }}>
                                {t.wasm_warning}
                            </p>
                        )}
                        <div className="text-box result">
                            {modeResults[mode] || (generatingModes[mode] && t.thinking)}
                        </div>
                    </section>
                )}

                {error && <p className="error-message">{t.status_error}: {error}</p>}
            </main>

            {showSettings && (
                <div className="settings-overlay">
                    <div className="settings-view">
                        <div className="settings-header">
                            <h2>{t.settings}</h2>
                            <button className="close-settings-btn" onClick={() => setShowSettings(false)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="settings-group">
                            <h3>{t.core_settings}</h3>
                            <div className="field">
                                <label>{t.lang_label}</label>
                                <select
                                    value={tempSettings.extensionLanguage}
                                    onChange={(e) => setTempSettings({ ...tempSettings, extensionLanguage: e.target.value })}
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
                                    value={tempSettings.engine}
                                    onChange={(e) => setTempSettings({ ...tempSettings, engine: e.target.value })}
                                >
                                    <option value="local-gpu">{t.engine_webgpu}</option>
                                    <option value="local-wasm">{t.engine_wasm}</option>
                                    <option value="online">{t.engine_online}</option>
                                </select>
                            </div>
                            {(tempSettings.engine === 'local-gpu' || tempSettings.engine === 'local-wasm') && (
                                <div className="field">
                                    <label>{t.model_label}</label>
                                    <select
                                        value={tempSettings.localModel}
                                        onChange={(e) => setTempSettings({ ...tempSettings, localModel: e.target.value })}
                                    >
                                        <optgroup label="Qwen (通义千问)">
                                            <option value="Qwen2.5-0.5B-Instruct-q4f16_1-MLC">Qwen2.5 0.5B (~380MB)</option>
                                            <option value="Qwen2.5-1.5B-Instruct-q4f16_1-MLC">Qwen2.5 1.5B (~1.1GB)</option>
                                            <option value="Qwen2-7B-Instruct-q4f16_1-MLC">Qwen2 7B (~4.8GB)</option>
                                        </optgroup>
                                        <optgroup label="Llama">
                                            <option value="Llama-3.2-1B-Instruct-q4f16_1-MLC">Llama 3.2 1B (~780MB)</option>
                                            <option value="Llama-3-8B-Instruct-q4f16_1-MLC">Llama 3 8B (~5.2GB)</option>
                                            <option value="Llama-2-7b-chat-hf-q4f16_1-MLC">Llama 2 7B (~4.5GB)</option>
                                            <option value="Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC">Hermes-2 Pro Llama 3 8B (~5.2GB)</option>
                                        </optgroup>
                                        <optgroup label="Mistral">
                                            <option value="Mistral-7B-Instruct-v0.3-q4f16_1-MLC">Mistral 7B v0.3 (~4.7GB)</option>
                                            <option value="Hermes-2-Pro-Mistral-7B-q4f16_1-MLC">Hermes-2 Pro Mistral 7B (~4.7GB)</option>
                                            <option value="NeuralHermes-2.5-Mistral-7B-q4f16_1-MLC">NeuralHermes 2.5 Mistral 7B (~4.7GB)</option>
                                            <option value="OpenHermes-2.5-Mistral-7B-q4f16_1-MLC">OpenHermes 2.5 Mistral 7B (~4.7GB)</option>
                                        </optgroup>
                                        <optgroup label="Phi">
                                            <option value="Phi-3-mini-4k-instruct-q4f16_1-MLC">Phi 3 Mini (~2.3GB)</option>
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

                        {tempSettings.engine === 'online' && (
                            <div className="settings-group">
                                <h3>{t.api_config}</h3>
                                <div className="field">
                                    <label>API Base URL</label>
                                    <input
                                        type="text"
                                        value={tempSettings.apiBaseUrl}
                                        onChange={(e) => setTempSettings({ ...tempSettings, apiBaseUrl: e.target.value })}
                                    />
                                </div>
                                <div className="field">
                                    <label>API Key</label>
                                    <input
                                        type="password"
                                        value={tempSettings.apiKey}
                                        onChange={(e) => setTempSettings({ ...tempSettings, apiKey: e.target.value })}
                                    />
                                </div>
                                <div className="field">
                                    <label>Model ID</label>
                                    <input
                                        type="text"
                                        value={tempSettings.apiModel}
                                        onChange={(e) => setTempSettings({ ...tempSettings, apiModel: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="settings-group">
                            <h3>{t.func_pref}</h3>
                            <div className="field">
                                <label>{t.tone_label}</label>
                                <select
                                    value={tempSettings.tone}
                                    onChange={(e) => setTempSettings({ ...tempSettings, tone: e.target.value })}
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
                                    value={tempSettings.detailLevel}
                                    onChange={(e) => setTempSettings({ ...tempSettings, detailLevel: e.target.value })}
                                >
                                    <option value="standard">{t.detail_standard}</option>
                                    <option value="detailed">{t.detail_detailed}</option>
                                    <option value="creative">{t.detail_creative}</option>
                                </select>
                            </div>
                        </div>

                        <div className="settings-group">
                            <h3>{t.offline_import_title}</h3>
                            <div className="field">
                                <p style={{ fontSize: '12px', color: '#718096', marginBottom: '8px' }}>
                                    {t.offline_import_tip}
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
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
                                        // @ts-ignore
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
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                            {t.export_btn}
                                        </button>
                                        <button
                                            className="secondary-btn"
                                            style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                                            onClick={() => document.getElementById('pkg-input')?.click()}
                                            disabled={status === 'loading'}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
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

                        <button className="save-btn" onClick={applySettings}>
                            {t.save_btn}
                        </button>
                    </div>
                </div>
            )}

            <footer className="actions">
                {status === 'idle' && (settings.engine === 'local-gpu' || settings.engine === 'local-wasm') ? (
                    <button className="primary-btn" onClick={loadModel}>
                        {t.action_btn_load} ({settings.engine === 'local-gpu' ? 'WebGPU' : 'WASM'})
                    </button>
                ) : (
                    <button
                        className="primary-btn"
                        onClick={handleAction}
                        disabled={!selectedText || generatingModes[mode] || (status === 'loading' && settings.engine !== 'online')}
                    >
                        {generatingModes[mode] ? t.action_generating : `${t.action_btn_execute}${mode === 'summarize' ? t.mode_summarize :
                            mode === 'correct' ? t.mode_correct :
                                mode === 'proofread' ? t.mode_proofread :
                                    mode === 'translate' ? t.mode_translate :
                                        t.mode_expand
                            }`}
                    </button>
                )}
            </footer>
        </div>
    );
}

export default App;
