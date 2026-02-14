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
      const shadowRoot = container.attachShadow({ mode: 'open' });

      const popup = document.createElement('div');
      popup.className = 'popup-content';
      popup.innerHTML = `
        <div class="header">
          <div class="status-indicator">
            <span class="dot"></span>
            <span class="status-text" id="status-label">TRANSLATING</span>
          </div>
          <button class="close-btn" id="close-popup-btn">&times;</button>
        </div>
        
        <div class="section">
          <div class="label">SOURCE</div>
          <div class="source-container">
            <div class="source-text" id="source-display"></div>
          </div>
        </div>

        <div class="section">
          <div class="label">TRANSLATION</div>
          <div class="content" id="translation-text">Translating...</div>
        </div>

        <div class="footer">
          <div class="brand">AI proofduck 🐣</div>
          <button class="copy-btn" id="copy-translation-btn">Copy</button>
        </div>
      `;

      const style = document.createElement('style');
      style.textContent = `
        :host {
          position: absolute;
          z-index: 2147483647;
          display: none;
          width: 340px;
          background: #FFFBF5;
          border-radius: 18px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.2);
          border: 1px solid rgba(255, 90, 17, 0.15);
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          pointer-events: auto;
          color: #4A4A4A;
        }
        .popup-content {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dot {
          width: 8px;
          height: 8px;
          background: #FF5A11;
          border-radius: 50%;
        }
        .status-text {
          color: #B45309;
          font-weight: 800;
          font-size: 13px;
          letter-spacing: 0.5px;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          color: #9CA3AF;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .close-btn:hover { color: #FF5A11; }
        
        .section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .label {
          font-size: 11px;
          font-weight: 700;
          color: #9CA3AF;
          letter-spacing: 0.8px;
        }
        .source-container {
          border-left: 3px solid #FED7AA;
          padding-left: 10px;
          margin: 4px 0;
        }
        .source-text {
          font-size: 13px;
          color: #6B7280;
          font-style: italic;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .content {
          font-size: 16px;
          line-height: 1.6;
          color: #1F2937;
          font-weight: 600;
          white-space: pre-wrap;
          max-height: 200px;
          overflow-y: auto;
          min-height: 24px;
        }
        .footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 90, 17, 0.08);
        }
        .brand {
          font-weight: 700;
          font-size: 12px;
          color: #FF5A11;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .copy-btn {
          background: #FFF;
          border: 1.5px solid #FED7AA;
          color: #C2410C;
          padding: 6px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .copy-btn:hover {
          background: #FFFAF5;
          border-color: #FF5A11;
          transform: translateY(-1px);
        }
        .copy-btn:active { transform: translateY(0); }
        .copy-btn.copied {
          background: #FF5A11;
          color: white;
          border-color: #FF5A11;
        }
      `;

      shadowRoot.appendChild(style);
      shadowRoot.appendChild(popup);
      
      // Events
      shadowRoot.getElementById('close-popup-btn')?.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        hideTranslation();
      });
      
      shadowRoot.getElementById('copy-translation-btn')?.addEventListener('click', async (e: MouseEvent) => {
        e.stopPropagation();
        const text = shadowRoot.getElementById('translation-text')?.textContent;
        if (text && text !== 'Translating...') {
          try {
            await navigator.clipboard.writeText(text);
            const btn = shadowRoot.getElementById('copy-translation-btn') as HTMLButtonElement;
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
              btn.textContent = original;
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

      const shadowRoot = translationPopup.shadowRoot!;
      const contentEl = shadowRoot.getElementById('translation-text')!;
      const sourceEl = shadowRoot.getElementById('source-display')!;
      const statusLabel = shadowRoot.getElementById('status-label')!;
      
      contentEl.textContent = 'Translating...';
      sourceEl.textContent = text;
      statusLabel.textContent = 'TRANSLATING';

      const offset = 12;
      let left = rect.left + window.scrollX;
      let top = rect.bottom + window.scrollY + offset;

      // Ensure popup doesn't go off-screen
      const viewportWidth = window.innerWidth;
      if (left + 340 > viewportWidth - 20) {
        left = viewportWidth - 340 - 20;
      }

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
          contentEl.textContent = 'Translation unavailable. Ensure sidepanel is initialized.';
          statusLabel.textContent = 'FAILED';
        }
      } catch (err) {
        console.error('[AI Proofduck] Translation message error:', err);
        contentEl.textContent = 'Sidepanel connection lost. Open sidepanel to enable translation.';
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
      const shadowRoot = container.attachShadow({ mode: 'open' });

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

      shadowRoot.appendChild(style);
      shadowRoot.appendChild(icon);

      container.addEventListener('mouseenter', () => {
        console.log('[AI Proofduck] Hover started.');
        if (hoverTimer) clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
          if (selectedText && lastRect) {
            showTranslation(selectedText, lastRect);
          } else {
            console.warn('[AI Proofduck] No text or rect to translate.');
          }
        }, 800);
      });

      container.addEventListener('mouseleave', () => {
        console.log('[AI Proofduck] Hover cancelled.');
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

    document.addEventListener('mouseup', () => {
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
      
      if (iconContainer && !iconContainer.contains(target) && 
          popupContainer && !popupContainer.contains(target)) {
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
