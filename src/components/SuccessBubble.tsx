/** SuccessBubble: SelectionBubble 成功态气泡 */
import { useState, memo } from 'react';

interface Props {
  output: string;
  engineName?: string;
  onCopy?: () => void;
  onDismiss: () => void;
  onRetry?: () => void;
}

// ⚡ Bolt: Memoize SuccessBubble to prevent unnecessary re-renders when parent SelectionBubble state updates.
// Impact: Reduces React rendering workload during text selection and floating bubble updates.
export const SuccessBubble = memo(function SuccessBubble({ output, engineName, onDismiss }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div
      style={{
        position: 'relative',
        background: '#495057',
        color: 'white',
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(73,80,87,0.28), 0 2px 4px rgba(73,80,87,0.15)',
        border: '1px solid #343a40',
        padding: '10px 12px',
        fontSize: 13,
        maxWidth: 320,
        lineHeight: 1.6,
      }}
    >
      {/* 顶部箭头 */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: -6,
          left: 20,
          width: 12,
          height: 12,
          background: '#495057',
          transform: 'rotate(45deg)',
          borderRadius: 2,
          borderTop: '1px solid #343a40',
          borderLeft: '1px solid #343a40',
        }}
      />
      {/* 顶栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
        {engineName && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#ffd43b', fontWeight: 600 }}>
            <span aria-hidden>🖥</span>
            <span>{engineName}</span>
          </span>
        )}
        <div style={{ display: 'flex', gap: 1 }}>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "已复制" : "复制译文"}
            title={copied ? "已复制" : "复制译文"}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
            style={{ width: 22, height: 22, background: 'transparent', border: 'none', color: '#ced4da', cursor: 'pointer', borderRadius: 4, display: 'grid', placeItems: 'center', fontSize: 11, padding: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ced4da'; }}
          >
            {copied ? "✓" : "📋"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="关闭"
            title="关闭（Esc）"
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
            style={{ width: 22, height: 22, background: 'transparent', border: 'none', color: '#ced4da', cursor: 'pointer', borderRadius: 4, display: 'grid', placeItems: 'center', fontSize: 11, padding: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ced4da'; }}
          >
            ✕
          </button>
        </div>
      </div>
      {/* 译文 */}
      <div style={{ fontFamily: '"Noto Serif SC", Georgia, serif', fontSize: 14, lineHeight: 1.6, color: 'white' }}>
        {output}
      </div>
      {/* 底部快捷键 */}
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 10.5, color: '#adb5bd', display: 'flex', justifyContent: 'flex-end' }}>
        <span>
          <kbd style={{ fontFamily: '"JetBrains Mono", "SF Mono", monospace', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3, color: '#ced4da', fontSize: 10 }}>Esc</kbd> 关闭
        </span>
      </div>
    </div>
  );
});
