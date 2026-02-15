// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import App from '../App';

// Mock browser API
const browserMock = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn(),
      remove: vi.fn(),
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn(),
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: {
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    sendMessage: vi.fn(),
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn(),
  },
};
global.browser = browserMock as any;

// Mock Worker
global.Worker = class {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  terminate = vi.fn();
} as any;

// Mock URL for worker
global.URL = class extends URL {
  constructor(url: string, base?: string | URL) {
    super(url, base);
  }
} as any;

describe('App Accessibility', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should have aria-pressed on mode buttons', async () => {
    render(<App />);

    // Check mode buttons
    const summarizeBtn = await screen.findByText(/摘要/);
    expect(summarizeBtn.getAttribute('aria-pressed')).toBe('true');

    const correctBtn = screen.getByText(/校对/);
    expect(correctBtn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(correctBtn);
    expect(correctBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('should have aria-label on icon buttons', () => {
    const { container } = render(<App />);

    // Check Settings button
    const settingsBtn = container.querySelector('button[aria-label="设置"]');
    expect(settingsBtn).toBeTruthy();
    expect(settingsBtn?.getAttribute('aria-expanded')).toBe('false');

    // Check Clear button
    const clearBtn = container.querySelector('button[aria-label="清除"]');
    expect(clearBtn).toBeTruthy();

    // Check Fetch button
    const fetchBtn = container.querySelector('button[aria-label="Fetch Page Content"]');
    expect(fetchBtn).toBeTruthy();
  });
});
