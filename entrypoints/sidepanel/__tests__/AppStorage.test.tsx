// @ts-nocheck
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import App from '../App';

// Mock Worker
class MockWorker {
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}
global.Worker = MockWorker as any;

// Mock URL
global.URL.createObjectURL = vi.fn();

// Mock browser
const mockSetLocal = vi.fn();
const mockSetSession = vi.fn();
const mockGetLocal = vi.fn().mockResolvedValue({});
const mockGetSession = vi.fn().mockResolvedValue({});

global.browser = {
  storage: {
    local: {
      set: mockSetLocal,
      get: mockGetLocal,
    },
    session: {
      set: mockSetSession,
      get: mockGetSession,
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getManifest: vi.fn().mockReturnValue({ version: '1.0.0' }),
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn(),
  },
  i18n: {
    getMessage: vi.fn((key) => key),
  }
} as any;

Object.defineProperty(navigator, 'language', {
  value: 'en-US',
  configurable: true,
});

describe('App Storage Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLocal.mockResolvedValue({});
    mockGetSession.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it('should NOT fallback to local storage for API key when session storage fails', async () => {
    // Simulate session storage failure
    mockSetSession.mockRejectedValue(new Error('Session storage failed'));

    const { container } = render(<App />);

    // Open settings panel
    const settingsBtn = container.querySelector('.settings-btn');
    if (!settingsBtn) throw new Error('Settings button not found');
    fireEvent.click(settingsBtn);

    // Wait for settings panel to open (engine label appears)
    await waitFor(() => {
        const label = screen.queryByText('AI 引擎') || screen.queryByText('AI Engine');
        expect(label).toBeTruthy();
    });

    const selects = container.querySelectorAll('select');
    // Select 0 is language, Select 1 is engine
    const engineSelect = selects[1];
    fireEvent.change(engineSelect, { target: { value: 'online' } });

    // Wait for API Config fields to appear
    await waitFor(() => screen.getByText('API Key'));

    const apiKeyLabel = screen.getByText('API Key');
    const apiKeyInput = apiKeyLabel.nextElementSibling as HTMLInputElement;

    fireEvent.change(apiKeyInput, { target: { value: 'secret-key-123' } });

    // Verify session storage was attempted
    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith({ apiKey: 'secret-key-123' });
    });

    // Verify local storage was called to save settings, BUT with empty API key
    await waitFor(() => {
      expect(mockSetLocal).toHaveBeenCalledWith(
        expect.objectContaining({
            settings: expect.objectContaining({
                apiKey: ''
            })
        })
      );
    });

    // CRITICAL CHECK: Verify local storage was NOT called with the actual API key
    expect(mockSetLocal).not.toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          apiKey: 'secret-key-123'
        })
      })
    );
  });
});
