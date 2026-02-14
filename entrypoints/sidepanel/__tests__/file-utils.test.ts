import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importFiles } from '../file-utils';

// Mock File with webkitRelativePath
class MockFile extends File {
  webkitRelativePath: string;
  constructor(bits: BlobPart[], name: string, options?: FilePropertyBag & { webkitRelativePath?: string }) {
    super(bits, name, options);
    this.webkitRelativePath = options?.webkitRelativePath || '';
  }
}

describe('importFiles Performance', () => {
  const mockPut = vi.fn();
  const mockOpen = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock Cache API
    // We need to assign to global, but ensure we clean up or TS might complain
    vi.stubGlobal('caches', {
      open: mockOpen,
    });

    // Mock Response global if needed, though happy-dom usually provides it.
    // Just to be safe for the "put" logic simulation.
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('measures execution time', async () => {
    // Setup mock behavior with delay
    mockOpen.mockResolvedValue({
      put: async (url: string, response: Response) => {
        // Simulate 20ms I/O delay
        await new Promise(resolve => setTimeout(resolve, 20));
        mockPut(url, response);
      },
    });

    const fileCount = 20;
    const files = Array.from({ length: fileCount }, (_, i) => new MockFile(['content'], `file${i}.bin`, {
      webkitRelativePath: `model/file${i}.bin`
    }));

    const onProgress = vi.fn();
    const startTime = Date.now();

    await importFiles(files as any, 'https://example.com/', onProgress, 'Importing');

    const duration = Date.now() - startTime;
    console.log(`Execution time for ${fileCount} files: ${duration}ms`);

    expect(mockPut).toHaveBeenCalledTimes(fileCount);
    expect(onProgress).toHaveBeenCalledTimes(fileCount);

    // We return the duration so we can potentially assert on it if we wanted to enforce performance
    return duration;
  });
});
