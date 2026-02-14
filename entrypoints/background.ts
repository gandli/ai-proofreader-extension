export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  browser.runtime.onMessage.addListener(async (message, sender) => {
    if (message.type === 'OPEN_SIDE_PANEL') {
      if (sender.tab?.id && sender.tab?.windowId) {
        chrome.sidePanel.open({ tabId: sender.tab.id, windowId: sender.tab.windowId });
      }
    } else if (message.type === 'SAVE_TEXT_AND_OPEN') {
      if (message.text) {
        await browser.storage.session.set({ selectedText: message.text });
      }
      if (sender.tab?.id && sender.tab?.windowId) {
        chrome.sidePanel.open({ tabId: sender.tab.id, windowId: sender.tab.windowId });
      }
    }
  });
});
