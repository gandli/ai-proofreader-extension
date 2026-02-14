import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPageContent } from '../pageContent';
import { Readability } from '@mozilla/readability';

vi.mock('@mozilla/readability', () => {
  return {
    Readability: vi.fn()
  };
});

describe('getPageContent', () => {
  let mockDocument: Document;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDocument = {
      cloneNode: vi.fn().mockReturnThis(),
      body: {
        innerText: 'Body text content'
      }
    } as unknown as Document;
  });

  it('should use Readability when available', () => {
    const mockArticle = { textContent: 'Readability content' };
    (Readability as unknown as ReturnType<typeof vi.fn>).mockImplementation(function() {
      return {
        parse: vi.fn().mockReturnValue(mockArticle)
      };
    });

    const content = getPageContent(mockDocument);
    expect(content).toBe('Readability content');
    expect(Readability).toHaveBeenCalled();
  });

  it('should fallback to body.innerText when Readability returns null', () => {
    (Readability as unknown as ReturnType<typeof vi.fn>).mockImplementation(function() {
      return {
        parse: vi.fn().mockReturnValue(null)
      };
    });

    const content = getPageContent(mockDocument);
    expect(content).toBe('Body text content');
  });

  it('should fallback to body.innerText when Readability throws error', () => {
    (Readability as unknown as ReturnType<typeof vi.fn>).mockImplementation(function() {
      return {
        parse: vi.fn().mockImplementation(() => { throw new Error('Parse error'); })
      };
    });

    const content = getPageContent(mockDocument);
    expect(content).toBe('Body text content');
  });
});
