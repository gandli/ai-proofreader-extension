import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, DEFAULT_SETTINGS, WorkerInboundMessage } from '../types';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(settings);
  const statusRef = useRef(status);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => {
    statusRef.current = status;
    browser.storage.local.set({ engineStatus: status });
  }, [status]);

  // Load persisted settings on mount; returns initial text if found
  const loadPersistedSettings = useCallback(async (): Promise<string> => {
    const res = await browser.storage.local.get(['selectedText', 'settings', 'activeTab']) as Record<string, unknown>;
    let initialText = (res.selectedText as string) || '';

    if (res.activeTab === 'settings') {
      setShowSettings(true);
      browser.storage.local.remove('activeTab');
    }

    if (!initialText) {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0].id) {
          const response = (await browser.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTENT' })) as { content?: string };
          if (response?.content) initialText = response.content;
        }
      } catch { /* ignore */ }
    }

    if (res.settings) {
      const saved = res.settings as Record<string, unknown>;
      const initial: Settings = { ...DEFAULT_SETTINGS, ...(saved as Partial<Settings>) };
      if (saved.targetLanguage && !saved.extensionLanguage) {
        initial.extensionLanguage = saved.targetLanguage as string;
      }
      try {
        const sessionData = await browser.storage.session.get(['apiKey']);
        if (sessionData.apiKey) initial.apiKey = sessionData.apiKey as string;
      } catch { /* ignore */ }
      setSettings(initial);
      if (saved.engine === 'online' && initial.apiKey) setStatus('ready');
    }

    return initialText;
  }, []);

  const updateSettings = useCallback(async (
    newSettings: Partial<Settings>,
    workerPostMessage?: (msg: WorkerInboundMessage) => void,
  ) => {
    const updated = { ...settingsRef.current, ...newSettings };
    setSettings(updated);

    const engineChanged = newSettings.engine && newSettings.engine !== settingsRef.current.engine;
    const modelChanged = newSettings.localModel && newSettings.localModel !== settingsRef.current.localModel;

    if (typeof browser !== 'undefined' && browser.storage) {
      const { apiKey, ...rest } = updated;
      await browser.storage.local.set({ settings: { ...rest, apiKey: '' } });
      if (apiKey) {
        await browser.storage.session.set({ apiKey }).catch(() => {
          browser.storage.local.set({ settings: updated });
        });
      }
    }

    if (updated.engine === 'online' || updated.engine === 'chrome-ai') {
      setStatus('ready');
      if (updated.engine === 'chrome-ai') {
        workerPostMessage?.({ type: 'load', settings: updated });
      }
    } else if (engineChanged || modelChanged || statusRef.current === 'idle' || statusRef.current === 'error') {
      setStatus('loading');
      workerPostMessage?.({ type: 'load', settings: updated });
    }
  }, []);

  return {
    settings, setSettings, settingsRef,
    status, setStatus, statusRef,
    showSettings, setShowSettings,
    loadPersistedSettings, updateSettings,
  };
}
