import { SVG_STRING } from './assets/floatingIcon';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    let floatingIcon: HTMLElement | null = null;
    let translationPopup: HTMLElement | null = null;
    let selectedText = '';
    let lastRect: DOMRect | null = null;
    let hoverTimer: any = null;

    console.log('[AI Proofduck] Content script initialized.');

    const createTranslationPopup = () => {
      const container = document.createElement('div');
      container.id = 'ai-proofduck-translation-popup';
      const shadowRootNode = container.attachShadow({ mode: 'open' });

      const popup = document.createElement('div');
      popup.className = 'popup-content';
      popup.innerHTML = `
        <div class="header">
          <div class="status-indicator">
            <span class="dot"></span>
            <span class="status-text" id="status-label">TRANSLATING</span>
          </div>
          <button class="close-btn" id="close-popup-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div class="section">
          <div class="section-label">ORIGINAL</div>
          <div class="text-box source" id="source-display"></div>
        </div>

        <div class="section">
          <div class="section-label">TRANSLATION</div>
          <div class="text-box result" id="translation-text">Translating...</div>
        </div>

        <div class="footer">
          <div class="brand">AI Proofduck 🐣</div>
          <button class="copy-btn" id="copy-translation-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
        </div>
      `;

      const style = document.createElement('style');
      style.textContent = `
        :host {
          position: absolute;
          z-index: 2147483647;
          display: none;
          width: 300px;
          background: #fbfbfb;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          border: 1px solid #e2e8f0;
          overflow: hidden;
          font-family: Inter, system-ui, -apple-system, sans-serif;
          pointer-events: auto;
          color: #1a1a1a;
        }

        @media (prefers-color-scheme: dark) {
          :host {
            background: #1a1a2e;
            border-color: #3f3f5a;
            color: #e2e8f0;
          }
        }

        .popup-content {
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          background: #fff5eb;
          padding: 2px 8px;
          border-radius: 12px;
        }
        @media (prefers-color-scheme: dark) {
          .status-indicator { background: #2d2d44; }
        }

        .dot {
          width: 5px;
          height: 5px;
          background: #ff5a11;
          border-radius: 50%;
        }

        .status-text {
          color: #ff5a11;
          font-weight: 700;
          font-size: 10px;
          text-transform: uppercase;
        }

        .close-btn {
          background: #edf2f7;
          border: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          color: #718096;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .close-btn:hover {
          background: #e2e8f0;
          color: #ff5a11;
        }
        @media (prefers-color-scheme: dark) {
          .close-btn { background: #2d2d44; color: #a0aec0; }
        }

        .section {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .section-label {
          font-size: 9px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.2px;
          padding-left: 2px;
        }

        .text-box {
          background: white;
          padding: 8px 10px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 12.5px;
          line-height: 1.5;
          max-height: 100px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .text-box.source {
          color: #64748b;
          border-color: #f1f5f9;
        }

        .text-box.result {
          background: #fff5eb;
          border-color: rgba(255, 90, 17, 0.2);
          color: #1a1a1a;
          font-weight: 500;
        }

        @media (prefers-color-scheme: dark) {
          .text-box {
            background: #23233a;
            border-color: #3f3f5a;
            color: #e2e8f0;
          }
          .text-box.source { border-color: #2d2d44; }
          .text-box.result {
            background: rgba(255, 90, 17, 0.06);
            border-color: rgba(255, 90, 17, 0.4);
          }
        }

        .footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 8px;
          margin-top: 2px;
          border-top: 1px solid #f1f5f9;
        }
        @media (prefers-color-scheme: dark) {
          .footer { border-top-color: #2d2d44; }
        }

        .brand {
          font-weight: 800;
          font-size: 11px;
          color: #ff5a11;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .copy-btn {
          background: white;
          border: 1px solid #e2e8f0;
          color: #718096;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
        }

        .copy-btn:hover {
          background: #fff5eb;
          border-color: #ff5a11;
          color: #ff5a11;
        }
        
        .copy-btn.copied {
          background: #ff5a11;
          color: white;
          border-color: #ff5a11;
        }

        @media (prefers-color-scheme: dark) {
          .copy-btn {
            background: #2d2d44;
            border-color: #4a4a6a;
            color: #a0aec0;
          }
          .copy-btn:hover {
            background: #2d1f10;
            border-color: #ff5a11;
            color: #ff7a3d;
          }
        }
        
        /* Scrollbar */
        .text-box::-webkit-scrollbar { width: 3px; }
        .text-box::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }
        @media (prefers-color-scheme: dark) {
          .text-box::-webkit-scrollbar-thumb { background: #4a4a6a; }
        }
      `;

      shadowRootNode.appendChild(style);
      shadowRootNode.appendChild(popup);
      
      // Events
      shadowRootNode.getElementById('close-popup-btn')?.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        hideTranslation();
      });
      
      shadowRootNode.getElementById('copy-translation-btn')?.addEventListener('click', async (e: MouseEvent) => {
        e.stopPropagation();
        const text = shadowRootNode.getElementById('translation-text')?.textContent;
        if (text && text !== 'Translating...') {
          try {
            await navigator.clipboard.writeText(text);
            const btn = shadowRootNode.getElementById('copy-translation-btn') as HTMLButtonElement;
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<span>Copied!</span>';
            btn.classList.add('copied');
            setTimeout(() => {
              btn.innerHTML = originalHtml;
              btn.classList.remove('copied');
            }, 2000);
          } catch (err) {
            console.error('[AI Proofduck] Copy failed:', err);
          }
        }
      });

      document.body.appendChild(container);
      return container;
    };

    const showTranslation = async (text: string, rect: DOMRect) => {
      console.log('[AI Proofduck] Showing translation for:', text.substring(0, 20) + '...');
      if (!translationPopup) {
        translationPopup = createTranslationPopup();
      }

      const shadowRootNode = translationPopup.shadowRoot!;
      const contentEl = shadowRootNode.getElementById('translation-text')!;
      const sourceEl = shadowRootNode.getElementById('source-display')!;
      const statusLabel = shadowRootNode.getElementById('status-label')!;
      
      contentEl.textContent = 'Translating...';
      sourceEl.textContent = text;
      statusLabel.textContent = 'TRANSLATING';

      const offset = 8;
      let left = rect.left + window.scrollX;
      let top = rect.bottom + window.scrollY + offset;

      const viewportWidth = window.innerWidth;
      const popupWidth = 300;
      if (left + popupWidth > viewportWidth - 15) {
        left = viewportWidth - popupWidth - 15;
      }
      if (left < 15) left = 15;

      translationPopup.style.left = `${left}px`;
      translationPopup.style.top = `${top}px`;
      translationPopup.style.display = 'block';

      try {
        const response = await browser.runtime.sendMessage({
          type: 'QUICK_TRANSLATE',
          text: text
        });
        if (response && response.translatedText) {
          contentEl.textContent = response.translatedText;
          statusLabel.textContent = 'COMPLETED';
        } else {
          contentEl.textContent = 'Unavailable. Ensure sidepanel is initialized.';
          statusLabel.textContent = 'FAILED';
        }
      } catch (err) {
        console.error('[AI Proofduck] Translation message error:', err);
        contentEl.textContent = 'Check sidepanel connection.';
        statusLabel.textContent = 'ERROR';
      }
    };

    const hideTranslation = () => {
      if (translationPopup) {
        translationPopup.style.display = 'none';
      }
    };

    const createFloatingIcon = () => {
      const container = document.createElement('div');
      container.id = 'ai-proofduck-icon-container';
      const shadowRootNode = container.attachShadow({ mode: 'open' });

      const icon = document.createElement('div');
      icon.innerHTML = SVG_STRING;
      icon.style.width = '24px';
      icon.style.height = '24px';
      icon.style.display = 'flex';

      const style = document.createElement('style');
      style.textContent = `
        :host {
          position: absolute;
          z-index: 2147483647;
          top: 0;
          left: 0;
          cursor: pointer;
          display: none;
          pointer-events: auto;
          width: 24px;
          height: 24px;
          filter: drop-shadow(0 4px 10px rgba(0,0,0,0.2));
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        :host(:hover) {
          transform: scale(1.15);
        }
        div { width: 24px; height: 24px; }
      `;

      shadowRootNode.appendChild(style);
      shadowRootNode.appendChild(icon);

      container.addEventListener('mouseenter', () => {
        if (hoverTimer) clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
          if (selectedText && lastRect) {
            showTranslation(selectedText, lastRect);
          }
        }, 800);
      });

      container.addEventListener('mouseleave', () => {
        if (hoverTimer) clearTimeout(hoverTimer);
      });

      icon.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      });

      icon.addEventListener('click', async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await browser.storage.local.set({ selectedText });
        browser.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
        hideIcon();
        hideTranslation();
      });

      document.body.appendChild(container);
      return container;
    };

    const showIcon = (rect: DOMRect) => {
      if (!floatingIcon) {
        floatingIcon = createFloatingIcon();
      }

      const iconWidth = 24;
      const iconHeight = 24;
      const offset = 5;

      let left = rect.right + window.scrollX - iconWidth / 2;
      let top = rect.top + window.scrollY - iconHeight - offset;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      if (left + iconWidth > scrollX + viewportWidth - 10) left = scrollX + viewportWidth - iconWidth - 10;
      if (left < scrollX + 10) left = scrollX + 10;
      if (top < scrollY + 10) top = rect.bottom + window.scrollY + offset;
      if (top + iconHeight > scrollY + viewportHeight - 10) top = scrollY + viewportHeight - iconHeight - 10;

      floatingIcon.style.left = `${left}px`;
      floatingIcon.style.top = `${top}px`;
      floatingIcon.style.display = 'block';
    };

    const hideIcon = () => {
      if (floatingIcon) {
        floatingIcon.style.display = 'none';
      }
    };

    document.addEventListener('mouseup', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const iconContainer = document.getElementById('ai-proofduck-icon-container');
      const popupContainer = document.getElementById('ai-proofduck-translation-popup');
      
      const isInsideUI = (iconContainer && iconContainer.contains(target)) || 
                        (popupContainer && popupContainer.contains(target));

      if (isInsideUI) {
        return; 
      }

      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();

        if (text && text.length > 0) {
          selectedText = text;
          const range = selection?.getRangeAt(0);
          if (range) {
            lastRect = range.getBoundingClientRect();
            showIcon(lastRect);
          }
        } else {
          hideIcon();
        }
      }, 10);
    });

    document.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const iconContainer = document.getElementById('ai-proofduck-icon-container');
      const popupContainer = document.getElementById('ai-proofduck-translation-popup');
      
      const isInsideUI = (iconContainer && iconContainer.contains(target)) || 
                        (popupContainer && popupContainer.contains(target));

      if (!isInsideUI) {
        hideIcon();
        hideTranslation();
        if (hoverTimer) clearTimeout(hoverTimer);
      }
    });

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_PAGE_CONTENT') {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        sendResponse({ content: text || document.body.innerText });
      }
    });
  },
});
