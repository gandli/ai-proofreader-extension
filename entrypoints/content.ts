import { SVG_STRING } from './assets/floatingIcon';
import tailwindStyles from './content-styles.css?inline';
import type { Settings } from './sidepanel/types';

type ContentSettings = Partial<Pick<Settings, 'engine' | 'apiKey' | 'localModel'>>;

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  // Excludes browser internal pages (chrome://, about:, etc.) by only matching http(s)
  main() {
    let floatingIcon: HTMLElement | null = null;
    let translationPopup: HTMLElement | null = null;
    let selectedText = '';
    let lastRect: DOMRect | null = null;
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;

    console.log('[AI Proofduck] Content script initialized.');

    const createTranslationPopup = () => {
      const container = document.createElement('div');
      container.id = 'ai-proofduck-translation-popup';
      const shadowRootNode = container.attachShadow({ mode: 'open' });

      // Tailwind styles
      const twStyle = document.createElement('style');
      twStyle.textContent = tailwindStyles;
      shadowRootNode.appendChild(twStyle);

      // Custom resets for Shadow DOM
      const resetStyle = document.createElement('style');
      resetStyle.textContent = `
        :host {
          position: absolute;
          z-index: 2147483647;
          display: none;
          font-family: Inter, system-ui, -apple-system, sans-serif;
          pointer-events: auto;
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        @media (prefers-color-scheme: dark) {
          ::-webkit-scrollbar-thumb { background: #475569; }
        }
      `;
      shadowRootNode.appendChild(resetStyle);

      const popup = document.createElement('div');
      popup.className = 'w-[300px] flex flex-col gap-2 p-3 bg-[#fbfbfb] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-slate-200 text-[#1a1a1a] dark:bg-[#1a1a2e] dark:border-[#3f3f5a] dark:text-slate-200';
      popup.innerHTML = `
        <div class="flex items-center justify-between mb-0.5">
          <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-orange-light dark:bg-[#2d2d44]">
            <span class="w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
            <span class="text-[10px] font-bold text-brand-orange uppercase tracking-wide" id="status-label">TRANSLATING</span>
          </div>
          <button class="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-brand-orange dark:bg-[#2d2d44] dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:text-[#ff7a3d]" id="close-popup-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div class="flex flex-col gap-1">
          <div class="px-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide">ORIGINAL</div>
          <div class="w-full max-h-[100px] overflow-y-auto p-2.5 bg-white border border-slate-200 rounded-lg text-[12.5px] leading-relaxed text-slate-500 whitespace-pre-wrap break-words dark:bg-[#23233a] dark:border-[#3f3f5a] dark:text-slate-400" id="source-display"></div>
        </div>

        <div class="flex flex-col gap-1" id="translation-section">
          <div class="px-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide">TRANSLATION</div>
          <div class="w-full max-h-[120px] overflow-y-auto p-2.5 bg-[#fff5eb] border border-brand-orange/20 rounded-lg text-[12.5px] leading-relaxed text-[#1a1a1a] font-medium whitespace-pre-wrap break-words dark:bg-[#2d1f10] dark:border-brand-orange/30 dark:text-slate-200" id="translation-text">Translating...</div>
        </div>

        <div class="hidden flex flex-col gap-1" id="action-section">
          <div class="px-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide">SETUP GUIDE</div>
          <div class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg dark:bg-[#2d2d44] dark:border-[#3f3f5a]" id="action-content"></div>
        </div>

        <div class="flex items-center justify-between pt-2 mt-0.5 border-t border-slate-100 dark:border-[#2d2d44]">
          <div class="flex items-center gap-1 text-[11px] font-extrabold text-brand-orange">AI Proofduck 🐣</div>
          <button class="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-semibold text-slate-500 transition-colors hover:bg-brand-orange-light hover:border-brand-orange hover:text-brand-orange dark:bg-[#2d2d44] dark:border-[#4a4a6a] dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:border-brand-orange dark:hover:text-[#ff7a3d]" id="copy-translation-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
        </div>
      `;

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
            
            // Copied state style
            btn.innerHTML = '<span>Copied!</span>';
            btn.classList.add('bg-brand-orange', 'text-white', 'border-brand-orange');
            btn.classList.remove('bg-white', 'text-slate-500', 'hover:bg-brand-orange-light', 'hover:text-brand-orange');
            
            setTimeout(() => {
              btn.innerHTML = originalHtml;
              btn.classList.remove('bg-brand-orange', 'text-white', 'border-brand-orange');
              btn.classList.add('bg-white', 'text-slate-500', 'hover:bg-brand-orange-light', 'hover:text-brand-orange');
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
      
      // Update storage so sidepanel stays in sync
      await browser.storage.local.set({ selectedText: text });

      if (!translationPopup) {
        translationPopup = createTranslationPopup();
      }

      const shadowRootNode = translationPopup.shadowRoot!;
      const contentEl = shadowRootNode.getElementById('translation-text')!;
      const sourceEl = shadowRootNode.getElementById('source-display')!;
      const statusLabel = shadowRootNode.getElementById('status-label')!;
      const actionContentEl = shadowRootNode.getElementById('action-content')!;
      const translateSection = shadowRootNode.getElementById('translation-section')!;
      const actionSection = shadowRootNode.getElementById('action-section')!;
      const copyBtn = shadowRootNode.getElementById('copy-translation-btn')!;
      
      sourceEl.textContent = text;

      const showActionUI = (msg: string, btnText: string, onAction: () => void | Promise<void>) => {
        translateSection.classList.add('hidden');
        actionSection.classList.remove('hidden');
        if (copyBtn) (copyBtn as HTMLElement).style.visibility = 'hidden';
        
        actionContentEl.innerHTML = `
          <div class="flex flex-col gap-3">
            <span class="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">${msg}</span>
            <button id="popup-action-btn" class="w-full py-2 bg-brand-orange text-white text-[12px] font-bold rounded-lg shadow-sm transition-all hover:bg-brand-orange-dark hover:shadow-md active:scale-[0.98]">
              ${btnText}
            </button>
          </div>
        `;
        
        const btn = shadowRootNode.getElementById('popup-action-btn');
        btn?.addEventListener('click', (e) => {
          e.stopPropagation();
          onAction();
        });
      };

      const showTranslateUI = () => {
        translateSection.classList.remove('hidden');
        actionSection.classList.add('hidden');
        if (copyBtn) (copyBtn as HTMLElement).style.visibility = 'visible';
      };

      const handleError = (errorCode: string) => {
        statusLabel.textContent = 'ACTION REQUIRED';
        
        let errorMsg = 'Unknown error.';
        let btnLabel = 'Check Settings';
        let onAction: () => void | Promise<void> = async () => {
          await browser.storage.local.set({ activeTab: 'settings' });
          browser.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
          hideTranslation();
        };

        if (errorCode === 'NO_API_KEY') {
          errorMsg = 'API Key is missing. Please configure it in settings.';
          btnLabel = 'Set API Key';
        } else if (errorCode === 'NO_MODEL') {
          errorMsg = 'Local model is not selected. Please choose a model.';
          btnLabel = 'Select Model';
        } else if (errorCode === 'ENGINE_NOT_READY' || errorCode === 'UNAVAILABLE') {
          errorMsg = errorCode === 'UNAVAILABLE' 
            ? 'Translation unavailable. Ensure sidepanel is active.' 
            : 'Engine is not ready. Open sidepanel to initialize.';
          btnLabel = 'Open Sidepanel';
          onAction = async () => {
            browser.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
            hideTranslation();
          };
        } else if (errorCode === 'ENGINE_LOADING') {
          errorMsg = 'Initializing the model may take a few minutes, please do not close the sidebar.';
          btnLabel = 'View Progress';
          onAction = async () => {
            browser.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
            hideTranslation();
          };
        } else if (errorCode === 'TIMEOUT') {
          errorMsg = 'Translation timed out. Please try again.';
          btnLabel = 'Retry';
          onAction = async () => {
            showTranslation(text, rect);
          };
        } else if (errorCode === 'CONNECTION_FAILED') {
          errorMsg = 'Connection failed. Is the sidepanel open?';
          btnLabel = 'Try Opening Sidepanel';
          onAction = async () => {
            browser.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
            hideTranslation();
          };
        }

        showActionUI(errorMsg, btnLabel, onAction);
      };
      
      // Proactive check: check both settings and engine status
      const storage = await browser.storage.local.get(['settings', 'engineStatus']);
      let settings = storage.settings as ContentSettings | undefined;
      const engineStatus = storage.engineStatus as string | undefined;
      
      // If settings don't exist in storage yet, use defaults similar to App.tsx
      if (!settings) {
        settings = {
          engine: 'local-gpu',
          localModel: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'
        };
      }

      // Handle loading status proactively
      if (engineStatus === 'loading') {
        handleError('ENGINE_LOADING');
        updatePopupPosition(rect);
        translationPopup.style.display = 'block';
        return;
      }

      if (settings.engine === 'online' && !settings.apiKey) {
        const session = await browser.storage.session.get('apiKey').catch(() => ({ apiKey: undefined }));
        if (!session.apiKey) {
          handleError('NO_API_KEY');
          updatePopupPosition(rect);
          translationPopup.style.display = 'block';
          return;
        }
      } else if ((settings.engine === 'local-gpu' || settings.engine === 'local-wasm') && !settings.localModel) {
        handleError('NO_MODEL');
        updatePopupPosition(rect);
        translationPopup.style.display = 'block';
        return;
      } else if ((settings.engine === 'local-gpu' || settings.engine === 'local-wasm') && engineStatus !== 'ready') {
        handleError('ENGINE_NOT_READY');
        updatePopupPosition(rect);
        translationPopup.style.display = 'block';
        return;
      }

      // Default translation UI
      showTranslateUI();
      contentEl.textContent = 'Translating...';
      statusLabel.textContent = 'TRANSLATING';

      updatePopupPosition(rect);
      translationPopup.style.display = 'block';

      try {
        const response = await browser.runtime.sendMessage({
          type: 'QUICK_TRANSLATE',
          text: text
        });

        if (response && response.translatedText) {
          contentEl.textContent = response.translatedText;
          statusLabel.textContent = 'COMPLETED';
        } else if (response && response.error) {
          handleError(response.error);
        } else {
          handleError('UNAVAILABLE');
        }
      } catch (err) {
        console.error('[AI Proofduck] Translation message error:', err);
        handleError('CONNECTION_FAILED');
      }
    };

    const updatePopupPosition = (rect: DOMRect) => {
      if (!translationPopup) return;
      
      // Smart Positioning with Collision Detection
      const popupWidth = 300;
      const popupMaxHeight = 280; // Adjusted for error states
      const offset = 8;
      const margin = 15;
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      let left = rect.left + scrollX;
      let top = rect.bottom + scrollY + offset;

      // Vertical Check: Try Below first, then Above if no space
      const spaceBelow = viewportHeight - (rect.bottom - scrollY);
      const spaceAbove = rect.top - margin;
      
      if (spaceBelow < popupMaxHeight + margin && spaceAbove > spaceBelow) {
        // Show ABOVE
        top = rect.top + scrollY - popupMaxHeight - offset;
        // Adjust if it still goes off top
        if (top < scrollY + margin) top = scrollY + margin;
      } else {
        // Show BELOW (default)
        // Adjust if it goes off bottom
        if (top + popupMaxHeight > scrollY + viewportHeight - margin) {
            top = scrollY + viewportHeight - popupMaxHeight - margin;
        }
      }

      // Horizontal Check: Center if possible, or snap to edges
      if (left + popupWidth > scrollX + viewportWidth - margin) {
        left = scrollX + viewportWidth - popupWidth - margin;
      }
      if (left < scrollX + margin) left = scrollX + margin;

      translationPopup.style.left = `${left}px`;
      translationPopup.style.top = `${top}px`;
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

      // Tailwind styles
      const twStyle = document.createElement('style');
      twStyle.textContent = tailwindStyles;
      shadowRootNode.appendChild(twStyle);

      // Custom resets & Host styles
      const resetStyle = document.createElement('style');
      resetStyle.textContent = `
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
        }
      `;
      shadowRootNode.appendChild(resetStyle);

      const icon = document.createElement('div');
      icon.innerHTML = SVG_STRING;
      // Using Tailwind for dimensions, transition, hover scale, and drop shadow
      icon.className = 'w-6 h-6 flex drop-shadow-md transition-transform duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:scale-[1.15]';

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

    // Listen for storage changes to update popup status (e.g. when engine becomes ready)
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.engineStatus && translationPopup && translationPopup.style.display === 'block') {
        const newStatus = changes.engineStatus.newValue as string;
        const oldStatus = changes.engineStatus.oldValue as string;
        
        console.log(`[AI Proofduck] Engine status changed: ${oldStatus} -> ${newStatus}`);
        
        // If it becomes ready and we were showing an "Action Required" UI, retry translation
        if (newStatus === 'ready' && selectedText) {
          const shadowRootNode = translationPopup.shadowRoot!;
          const statusLabel = shadowRootNode.getElementById('status-label');
          if (statusLabel && statusLabel.textContent === 'ACTION_REQUIRED') {
            console.log('[AI Proofduck] Engine ready, retrying translation automatically...');
            showTranslation(selectedText, lastRect || new DOMRect());
          }
        }
      }
    });
  },
});
