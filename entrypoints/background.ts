export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Create context menu on install
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'ai-proofduck-process',
      title: '使用 AI 校对鸭处理',
      contexts: ['selection'],
    });
  });

  // Handle context menu clicks
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'ai-proofduck-process' && tab?.id) {
      if (info.selectionText) {
        await browser.storage.local.set({ selectedText: info.selectionText });
      }
      chrome.sidePanel.open({ tabId: tab.id, windowId: tab.windowId });
    }
  });

  browser.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'OPEN_SIDE_PANEL') {
      if (sender.tab?.id && sender.tab?.windowId) {
        chrome.sidePanel.open({ tabId: sender.tab.id, windowId: sender.tab.windowId });
      }
    }
  });
});
