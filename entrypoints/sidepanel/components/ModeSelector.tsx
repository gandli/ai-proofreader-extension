import { ModeKey, MODES } from '../types';
import { SettingsIcon } from './Icons';

interface ModeSelectorProps {
  mode: ModeKey;
  setMode: (m: ModeKey) => void;
  t: Record<string, string>;
  onOpenSettings: () => void;
}

const baseBtn = 'flex-1 py-2 px-0.5 border-none bg-transparent rounded-md text-[11px] font-semibold text-slate-600 cursor-pointer transition-all hover:bg-brand-orange/10 hover:text-brand-orange dark:text-slate-400 dark:hover:bg-brand-orange/15 dark:hover:text-[#ff7a3d]';
const activeBtn = 'bg-white text-brand-orange shadow-sm dark:bg-[#2a2a3e] dark:text-[#ff7a3d]';

export function ModeSelector({ mode, setMode, t, onOpenSettings }: ModeSelectorProps) {
  return (
    <div className="flex items-stretch gap-1.5 mb-0.5">
      <section className="flex flex-1 gap-1 p-1 mb-0 rounded-lg bg-brand-orange-light dark:bg-brand-dark-surface">
        {MODES.map(m => (
          <button
            key={m.key}
            className={`${baseBtn} ${mode === m.key ? activeBtn : ''}`}
            onClick={() => setMode(m.key)}
            aria-pressed={mode === m.key}
          >
            {t[m.labelKey]}
          </button>
        ))}
      </section>
      <button
        className="flex items-center justify-center px-3 ml-0 text-slate-500 transition-all rounded-lg cursor-pointer bg-brand-orange-light hover:bg-white hover:text-brand-orange hover:shadow-sm dark:bg-brand-dark-surface dark:text-slate-400 dark:hover:bg-[#2a2a3e] dark:hover:text-[#ff7a3d]"
        onClick={onOpenSettings}
      >
        <SettingsIcon />
      </button>
    </div>
  );
}
