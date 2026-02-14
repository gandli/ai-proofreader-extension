import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'zh_CN',
    permissions: ['sidePanel', 'storage', 'tts', 'activeTab', 'contextMenus', 'scripting'],
    // Chrome Built-in AI Origin Trial tokens
    // Replace with actual tokens from https://developer.chrome.com/origintrials/
    trial_tokens: [
      // 'YOUR_WRITER_REWRITER_ORIGIN_TRIAL_TOKEN',
      // 'YOUR_PROOFREADER_ORIGIN_TRIAL_TOKEN',
    ],
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    action: {
      default_icon: {
        '16': 'icons/icon-16.png',
        '32': 'icons/icon-32.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png',
      },
    },
  },
});
