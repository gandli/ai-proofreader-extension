export default defineBackground(() => {
  // @ts-ignore
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  browser.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'OPEN_SIDE_PANEL') {
      // @ts-ignore
      chrome.sidePanel.open({ tabId: sender.tab?.id });
    }
  });
});
