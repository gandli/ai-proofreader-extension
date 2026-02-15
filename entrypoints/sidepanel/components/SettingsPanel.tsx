import { useState, useEffect } from 'react';
import { Settings, ModeKey, MODES, EngineType, ToneType, DetailLevelType } from '../types';
import { CloseIcon } from './Icons';
import { ModelImportExport } from './ModelImportExport';
import { detectChromeAI, type ChromeAIStatus, type ChromeAICapability, MODE_API_MAP } from '../engines/chrome-ai';

interface SettingsPanelProps {
  settings: Settings;
  updateSettings: (s: Partial<Settings>) => void;
  onClose: () => void;
  status: string;
  setStatus: (s: 'idle' | 'loading' | 'ready' | 'error') => void;
  setProgress: (p: { progress: number; text: string }) => void;
  setError: (e: string) => void;
  t: Record<string, string>;
}

const selectClass = "p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-orange/10 dark:bg-brand-dark-bg dark:border-[#4a4a6a] dark:text-slate-200 dark:focus:bg-brand-dark-surface";
const inputClass = selectClass;
const labelClass = "text-[11px] text-slate-500 font-semibold uppercase dark:text-slate-400";

export function SettingsPanel({ settings, updateSettings, onClose, status, setStatus, setProgress, setError, t }: SettingsPanelProps) {
  const [chromeAIStatus, setChromeAIStatus] = useState<ChromeAIStatus | null>(null);
  const [urlError, setUrlError] = useState('');

  const validateUrl = (url: string) => {
    if (!url) { setUrlError(''); return; }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setUrlError(t.url_must_be_http || 'URL must start with http:// or https://');
      } else {
        setUrlError('');
      }
    } catch {
      setUrlError(t.invalid_url || 'Invalid URL format');
    }
  };

  useEffect(() => {
    detectChromeAI().then(setChromeAIStatus).catch((e) => { console.error('Chrome AI detection failed:', e); });
  }, []);

  const statusIcon = (cap: ChromeAICapability) => {
    switch (cap) {
      case 'available': return '✅';
      case 'experimental': return '🧪';
      default: return '❌';
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 backdrop-blur-[4px]">
      <div className="flex flex-col gap-4 w-full p-6 pb-4 bg-[#fbfbfb] rounded-t-[20px] max-h-[90vh] overflow-y-auto shadow-[-10px_25px_rgba(0,0,0,0.1)] animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)] dark:bg-brand-dark-bg dark:shadow-[-10px_25px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="m-0 text-xl font-extrabold">{t.settings}</h2>
          <button className="flex items-center justify-center w-8 h-8 text-slate-500 border-none rounded-full cursor-pointer bg-slate-100 dark:bg-brand-dark-surface dark:text-slate-400" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {/* Core Settings */}
        <div className="flex flex-col gap-3 p-4 bg-white border border-slate-200 rounded-xl dark:bg-brand-dark-surface dark:border-slate-700">
          <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-200">{t.core_settings}</h3>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t.lang_label}</label>
            <select className={selectClass} value={settings.extensionLanguage} onChange={e => updateSettings({ extensionLanguage: e.target.value })}>
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
            <label className={labelClass}>{t.engine_label}</label>
            <select className={selectClass} value={settings.engine} onChange={e => updateSettings({ engine: e.target.value as EngineType })}>
              <option value="chrome-ai">{t.engine_chrome_ai || 'Chrome Built-in AI (推荐)'}</option>
              <option value="local-gpu">{t.engine_webgpu}</option>
              <option value="local-wasm">{t.engine_wasm}</option>
              <option value="online">{t.engine_online}</option>
            </select>
          </div>
          {settings.engine === 'chrome-ai' && chromeAIStatus && (
            <div className="flex flex-col gap-1 p-3 bg-slate-50 rounded-lg text-xs dark:bg-brand-dark-bg">
              <span className="font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.chrome_ai_status || 'API 可用状态'}</span>
              {MODES.map(({ key: mode }) => (
                <div key={mode} className="flex items-center gap-1.5">
                  <span>{statusIcon(chromeAIStatus[mode])}</span>
                  <span className="text-slate-500 dark:text-slate-400">{t[`mode_${mode}`]} — {MODE_API_MAP[mode]}</span>
                </div>
              ))}
            </div>
          )}
          {(settings.engine === 'local-gpu' || settings.engine === 'local-wasm') && (
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t.model_label}</label>
              <select className={selectClass} value={settings.localModel} onChange={e => updateSettings({ localModel: e.target.value })}>
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

        {/* Online API */}
        {settings.engine === 'online' && (
          <div className="flex flex-col gap-3 p-4 bg-white border border-slate-200 rounded-xl dark:bg-brand-dark-surface dark:border-slate-700">
            <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-200">{t.api_config}</h3>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>API Base URL</label>
              <input className={inputClass} type="text" value={settings.apiBaseUrl} onChange={e => updateSettings({ apiBaseUrl: e.target.value })} onBlur={e => validateUrl(e.target.value)} />
              {urlError && <span className="text-xs text-red-500">{urlError}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>API Key</label>
              <input className={inputClass} type="password" value={settings.apiKey} onChange={e => updateSettings({ apiKey: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Model ID</label>
              <input className={inputClass} type="text" value={settings.apiModel} onChange={e => updateSettings({ apiModel: e.target.value })} />
            </div>
          </div>
        )}

        {/* Preferences */}
        <div className="flex flex-col gap-3 p-4 bg-white border border-slate-200 rounded-xl dark:bg-brand-dark-surface dark:border-slate-700">
          <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-200">{t.func_pref}</h3>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t.tone_label}</label>
            <select className={selectClass} value={settings.tone} onChange={e => updateSettings({ tone: e.target.value as ToneType })}>
              <option value="professional">{t.tone_professional}</option>
              <option value="casual">{t.tone_casual}</option>
              <option value="academic">{t.tone_academic}</option>
              <option value="concise">{t.tone_concise}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t.detail_label}</label>
            <select className={selectClass} value={settings.detailLevel} onChange={e => updateSettings({ detailLevel: e.target.value as DetailLevelType })}>
              <option value="standard">{t.detail_standard}</option>
              <option value="detailed">{t.detail_detailed}</option>
              <option value="creative">{t.detail_creative}</option>
            </select>
          </div>
          <div className="flex items-center gap-2.5 mt-1">
            <input type="checkbox" id="autoSpeak" checked={settings.autoSpeak} onChange={e => updateSettings({ autoSpeak: e.target.checked })} className="w-4 h-4 cursor-pointer" />
            <label htmlFor="autoSpeak" className="cursor-pointer mb-0">{t.auto_speak_label}</label>
          </div>
        </div>

        {/* Model Import/Export */}
        <ModelImportExport settings={settings} status={status} setStatus={setStatus} setProgress={setProgress} setError={setError} t={t} />
      </div>
    </div>
  );
}
