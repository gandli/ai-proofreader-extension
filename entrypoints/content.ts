import { SVG_STRING } from './assets/floatingIcon';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    let floatingIcon: HTMLElement | null = null;
    let selectedText = '';

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
          filter: drop-shadow(0 2px 5px rgba(0,0,0,0.2));
          transition: transform 0.1s ease;
        }
        :host(:hover) {
          transform: scale(1.1);
        }
        div {
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `;

      shadowRoot.appendChild(style);
      shadowRoot.appendChild(icon);

      icon.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      icon.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await browser.runtime.sendMessage({ type: 'SAVE_TEXT_AND_OPEN', text: selectedText });
        hideIcon();
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

      // Position: Top-right of the selection
      let left = rect.right + window.scrollX - iconWidth / 2;
      let top = rect.top + window.scrollY - iconHeight - offset;

      // Boundary Checks (Viewport-relative)
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      // Ensure not off-screen right
      if (left + iconWidth > scrollX + viewportWidth - 10) {
        left = scrollX + viewportWidth - iconWidth - 10;
      }
      // Ensure not off-screen left
      if (left < scrollX + 10) {
        left = scrollX + 10;
      }
      // Ensure not off-screen top (if no space above, move below)
      if (top < scrollY + 10) {
        top = rect.bottom + window.scrollY + offset;
      }
      // Ensure not off-screen bottom
      if (top + iconHeight > scrollY + viewportHeight - 10) {
        top = scrollY + viewportHeight - iconHeight - 10;
      }

      floatingIcon.style.left = `${left}px`;
      floatingIcon.style.top = `${top}px`;
      floatingIcon.style.display = 'block';
    };

    const hideIcon = () => {
      if (floatingIcon) {
        floatingIcon.style.display = 'none';
      }
    };

    document.addEventListener('mouseup', (e) => {
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();

        if (text && text.length > 0) {
          selectedText = text;
          const range = selection?.getRangeAt(0);
          const rect = range?.getBoundingClientRect();
          if (rect) {
            showIcon(rect);
          }
        } else {
          hideIcon();
        }
      }, 10);
    });

    document.addEventListener('mousedown', (e) => {
      if (floatingIcon && !floatingIcon.contains(e.target as Node)) {
        hideIcon();
      }
    });

    // Listen for messages from the sidepanel
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_PAGE_CONTENT') {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (selectedText) {
          sendResponse({ content: selectedText });
        } else {
          // Fallback to body content if no selection
          // Simple extraction: document.body.innerText
          // Could be improved later with Readability.js if needed
          sendResponse({ content: document.body.innerText });
        }
      }
    });
  },
});
