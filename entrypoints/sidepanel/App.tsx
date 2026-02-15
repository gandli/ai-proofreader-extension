import { useState, useEffect } from 'react';

import { translations } from './i18n';
import { ModeKey, emptyModeResults, emptyGeneratingModes, MODES } from './types';
import { useSettings } from './hooks/useSettings';
import { useWorker } from './hooks/useWorker';
import { ModeSelector } from './components/ModeSelector';
import { ResultPanel } from './components/ResultPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { FetchIcon, ClearIcon } from './components/Icons';

function App() {
  const [selectedText, setSelectedText] = useState('');
  const [modeResults, setModeResults] = useState(emptyModeResults());
  const [mode, setMode] = useState<ModeKey>('summarize');
  const [generatingModes, setGeneratingModes] = useState(emptyGeneratingModes());
  const [progress, setProgress] = useState({ progress: 0, text: '' });
  const [error, setError] = useState('');

  const {
    settings, settingsRef, status, setStatus, statusRef,
    showSettings, setShowSettings, loadPersistedSettings, updateSettings,
  } = useSettings();

  const { postMessage } = useWorker({
    settingsRef, statusRef, setStatus, setProgress, setError,
    setModeResults, setGeneratingModes, setSelectedText, setShowSettings,
  });

  useEffect(() => { loadPersistedSettings().then(text => { if (text) setSelectedText(text); }); }, []);

  const t = translations[settings.extensionLanguage] || translations['中文'];

  const handleFetchContent = async () => {
    setError('');
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        const res = (await browser.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTENT' })) as { content?: string };
        if (res?.content) { setSelectedText(res.content); setModeResults(emptyModeResults()); }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // NOTE: String matching for connection errors is fragile but unavoidable here —
      // browser.tabs.sendMessage throws generic Error objects without error codes.
      setError(msg.includes('Could not establish connection') ? t.connection_error : (msg || t.status_error));
    }
  };

  const handleAction = () => {
    if (!selectedText || generatingModes[mode]) return;
    setError('');
    setGeneratingModes(prev => ({ ...prev, [mode]: true }));
    setModeResults(prev => ({ ...prev, [mode]: '' }));
    postMessage({ type: 'generate', text: selectedText, mode, settings });
  };

  const modeDef = MODES.find(m => m.key === mode)!;

  return (
    <div className="flex flex-col h-screen box-border p-3 font-sans bg-[#fbfbfb] text-[#1a1a1a] dark:bg-brand-dark-bg dark:text-slate-200">
      <main className="flex-1 flex flex-col gap-3 pr-1 overflow-y-auto">
        {status === 'loading' && (
          <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-white/90 text-center p-10 dark:bg-[#1a1a2e]/95">
            <div className="w-full h-2 mb-3 overflow-hidden rounded-md bg-slate-200 dark:bg-slate-700">
              <div className="h-full bg-brand-orange transition-all duration-300 ease-out" style={{ width: `${progress.progress}%` }} />
            </div>
            <div className="text-[13px] font-medium text-slate-600 dark:text-slate-400">{progress.text}</div>
            <small className="mt-3 text-slate-400">{t.loading_tip}</small>
          </div>
        )}

        <ModeSelector mode={mode} setMode={setMode} t={t} onOpenSettings={() => setShowSettings(true)} />

        <section className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="m-0 text-[13px] font-semibold text-slate-500 dark:text-slate-400">{t.original_text}</h3>
            <div className="flex gap-1.5">
              <button className="flex items-center justify-center p-1.5 text-slate-500 transition-all bg-white border border-slate-200 rounded-md cursor-pointer shadow-sm hover:bg-brand-orange-light hover:border-brand-orange hover:text-brand-orange hover:shadow-md hover:-translate-y-px dark:bg-brand-dark-surface dark:border-slate-700 dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:border-brand-orange dark:hover:text-[#ff7a3d]" onClick={() => { setSelectedText(''); setModeResults(emptyModeResults()); }} title={t.clear_btn || 'Clear'}><ClearIcon /></button>
              <button className="flex items-center justify-center p-1.5 transition-all border rounded-md cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-px bg-brand-orange-light border-brand-orange/20 text-brand-orange hover:bg-brand-orange-light hover:border-brand-orange hover:text-brand-orange dark:bg-brand-dark-surface dark:border-slate-700 dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:border-brand-orange dark:hover:text-[#ff7a3d]" onClick={handleFetchContent} title={t.fetch_page_content || 'Fetch Page Content'}><FetchIcon /></button>
            </div>
          </div>
          <div className="relative flex flex-col flex-1 min-h-0">
            <textarea className="flex-1 w-full min-h-[80px] p-3.5 text-sm leading-relaxed bg-white border-[1.5px] border-slate-200 rounded-xl outline-none resize-y shadow-sm transition-all whitespace-pre-wrap break-words text-slate-700 hover:border-slate-300 focus:bg-white focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 dark:bg-[#23233a] dark:border-[#3f3f5a] dark:text-slate-200 dark:focus:border-[#ff7a3d] dark:focus:ring-[#ff7a3d]/10 dark:bg-brand-dark-bg" value={selectedText} onChange={e => setSelectedText(e.target.value)} placeholder={t.placeholder} />
            {selectedText && <div className="absolute bottom-2 right-3 text-[11px] text-slate-400 pointer-events-none bg-white/80 px-1.5 py-0.5 rounded dark:bg-[#1a1a2e]/80 dark:text-slate-500">{selectedText.length} {t.char_count}</div>}
          </div>
        </section>

        <ResultPanel mode={mode} modeResults={modeResults} setModeResults={setModeResults} generatingModes={generatingModes} status={status} engine={settings.engine} t={t} />

        {error && <p className="p-2 my-2 text-xs text-red-600 rounded-md bg-red-50 dark:bg-[#2d1515] dark:text-red-300">{t.status_error}: {error}</p>}
      </main>

      {showSettings && <SettingsPanel settings={settings} updateSettings={s => updateSettings(s, postMessage)} onClose={() => setShowSettings(false)} status={status} setStatus={setStatus} setProgress={setProgress} setError={setError} t={t} />}

      <footer className="sticky bottom-0 left-0 right-0 p-3 bg-[#fbfbfb] border-t border-slate-100 dark:bg-brand-dark-bg dark:border-slate-800">
        {status === 'loading' ? (
          <button className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-brand-orange border-none rounded-xl cursor-pointer shadow-md shadow-brand-orange/20 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-500" disabled>{progress.text || `${t.status_loading} ${Math.round(progress.progress)}%`}</button>
        ) : status === 'error' ? (
          <button className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#e53e3e] border-none rounded-xl cursor-pointer" onClick={() => setStatus('idle')}>{t.status_error} (Click to Reset)</button>
        ) : status === 'idle' && (settings.engine === 'local-gpu' || settings.engine === 'local-wasm') ? (
          <button className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-brand-orange border-none rounded-xl cursor-pointer shadow-md shadow-brand-orange/20 transition-all hover:bg-brand-orange-dark hover:shadow-lg active:scale-[0.98]" onClick={() => { setStatus('loading'); setError(''); postMessage({ type: 'load', settings }); }}>{t.action_btn_load} ({settings.engine === 'local-gpu' ? 'WebGPU' : 'WASM'})</button>
        ) : (
          <button className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-brand-orange border-none rounded-xl cursor-pointer shadow-md shadow-brand-orange/20 transition-all hover:bg-brand-orange-dark hover:shadow-lg active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-500" onClick={handleAction} disabled={!selectedText || generatingModes[mode]}>
            {generatingModes[mode] ? t.action_generating : `${t.action_btn_execute}${t[modeDef.labelKey]}`}
          </button>
        )}
      </footer>
    </div>
  );
}

export default App;
