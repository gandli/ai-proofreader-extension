import { SVG_STRING } from './assets/floatingIcon';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    let floatingIcon: HTMLElement | null = null;
    let translationPopup: HTMLElement | null = null;
    let selectedText = '';
    let hoverTimer: any = null;

    const createTranslationPopup = () => {
      const container = document.createElement('div');
      container.id = 'ai-proofduck-translation-popup';
      const shadowRoot = container.attachShadow({ mode: 'open' });

      const popup = document.createElement('div');
      popup.className = 'popup-content';
      popup.innerHTML = `
        <div class="header">
          <span class="logo">${SVG_STRING.replace('width="24" height="24"', 'width="16" height="16"')}</span>
          <span class="title">AI Translation</span>
        </div>
        <div class="content" id="translation-text">Translating...</div>
      `;

      const style = document.createElement('style');
      style.textContent = `
        :host {
          position: absolute;
          z-index: 2147483647;
          display: none;
          max-width: 320px;
          min-width: 180px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          border: 1px solid #f0f0f0;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          pointer-events: auto;
        }
        .popup-content {
          padding: 12px;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: #FF5A11;
          font-weight: 700;
          font-size: 13px;
          border-bottom: 1px solid #f9f9f9;
          padding-bottom: 6px;
        }
        .content {
          font-size: 14px;
          line-height: 1.6;
          color: #2D2D2D;
          white-space: pre-wrap;
          max-height: 240px;
          overflow-y: auto;
        }
        .logo { display: flex; align-items: center; }
      `;

      shadowRoot.appendChild(style);
      shadowRoot.appendChild(popup);
      document.body.appendChild(container);
      return container;
    };

    const showTranslation = async (text: string, rect: DOMRect) => {
      if (!translationPopup) {
        translationPopup = createTranslationPopup();
      }

      const shadow = translationPopup.shadowRoot!;
      const contentEl = shadow.getElementById('translation-text')!;
      contentEl.textContent = 'Translating...';

      const offset = 12;
      let left = rect.left + window.scrollX;
      let top = rect.bottom + window.scrollY + offset;

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
        } else {
          contentEl.textContent = 'Translation unavailable. Ensure the sidepanel is open and initialized.';
        }
      } catch (err) {
        contentEl.textContent = 'Connection lost. Please reopen the sidepanel.';
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
          filter: drop-shadow(0 4px 10px rgba(0,0,0,0.15));
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        :host(:hover) {
          transform: scale(1.15);
        }
        div {
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `;

      shadowRoot.appendChild(style);
      shadowRoot.appendChild(icon);

      container.addEventListener('mouseenter', () => {
        hoverTimer = setTimeout(() => {
          if (selectedText) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              showTranslation(selectedText, rect);
            }
          }
        }, 800);
      });

      container.addEventListener('mouseleave', () => {
        if (hoverTimer) clearTimeout(hoverTimer);
      });

      icon.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      icon.addEventListener('click', async (e) => {
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
            const rect = range.getBoundingClientRect();
            showIcon(rect);
          }
        } else {
          hideIcon();
          hideTranslation();
        }
      }, 10);
    });

    document.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      if (floatingIcon && !floatingIcon.contains(target)) {
        hideIcon();
        if (hoverTimer) clearTimeout(hoverTimer);
      }
      if (translationPopup && !translationPopup.contains(target)) {
        hideTranslation();
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
