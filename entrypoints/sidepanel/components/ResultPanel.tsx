import { useCallback, useState } from 'react';
import { ModeKey, MODES } from '../types';

interface ResultPanelProps {
  mode: ModeKey;
  modeResults: Record<ModeKey, string>;
  setModeResults: React.Dispatch<React.SetStateAction<Record<ModeKey, string>>>;
  generatingModes: Record<ModeKey, boolean>;
  status: string;
  engine: string;
  t: Record<string, string>;
}

export function ResultPanel({
  mode, modeResults, setModeResults, generatingModes, status, engine, t,
}: ResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const result = modeResults[mode];
  const generating = generatingModes[mode];

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  if (!result && !generating) return null;

  const modeDef = MODES.find(m => m.key === mode)!;

  return (
    <section className={`flex flex-col flex-1 min-h-0 transition-opacity ${status === 'loading' ? 'opacity-30' : 'opacity-100'}`}>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="m-0 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
          {t[modeDef.resultLabelKey]}
        </h3>
        {result && (
          <button
            className="flex items-center justify-center p-1.5 text-slate-500 transition-all bg-white border border-slate-200 rounded-md cursor-pointer shadow-sm hover:bg-brand-orange-light hover:border-brand-orange hover:text-brand-orange hover:shadow-md hover:-translate-y-px dark:bg-brand-dark-surface dark:border-slate-700 dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:border-brand-orange dark:hover:text-[#ff7a3d]"
            onClick={handleCopy}
            title={t.copy_btn || 'Copy'}
          >
            {copied ? '✓' : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        )}
      </div>
      {engine === 'local-wasm' && !result && generating && (
        <p className="text-[11px] text-slate-500 mb-2 dark:text-slate-400">{t.wasm_warning}</p>
      )}
      <div className="relative flex flex-col flex-1 min-h-0">
        <textarea
          className="flex-1 w-full min-h-[80px] p-3.5 text-sm leading-relaxed border rounded-xl outline-none resize-y shadow-sm transition-all whitespace-pre-wrap break-words bg-brand-orange-light border-brand-orange/30 animate-[fadeIn_0.4s_cubic-bezier(0.16,1,0.3,1)] focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 dark:bg-brand-orange/10 dark:border-brand-orange/50 dark:text-slate-200 dark:focus:bg-brand-dark-bg dark:focus:border-[#ff7a3d] dark:focus:ring-[#ff7a3d]/10"
          value={result}
          onChange={(e) => setModeResults(prev => ({ ...prev, [mode]: e.target.value }))}
          placeholder={generating ? t.thinking : ''}
          readOnly={generating}
        />
        {result && (
          <div className="absolute bottom-2 right-3 text-[11px] text-slate-400 pointer-events-none bg-white/80 px-1.5 py-0.5 rounded dark:bg-[#1a1a2e]/80 dark:text-slate-500">
            {result.length} {t.char_count}
          </div>
        )}
      </div>
    </section>
  );
}
