import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractPageContent } from '../pageContent';
import { Readability } from '@mozilla/readability';

vi.mock('@mozilla/readability', () => {
  return {
    Readability: vi.fn(),
  };
});

describe('extractPageContent', () => {
  let mockDoc: any;

  beforeEach(() => {
    mockDoc = {
      cloneNode: vi.fn().mockImplementation(() => mockDoc), // returns itself for simplicity
      body: {
        innerText: 'Fallback content',
      },
    };

    // Reset the mock implementation for Readability before each test
    (Readability as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it('should use Readability to extract content', () => {
    const mockArticle = { textContent: 'Readability Content' };
    const mockParse = vi.fn().mockReturnValue(mockArticle);

    // Use a regular function for the mock implementation so it can be called with 'new'
    (Readability as unknown as ReturnType<typeof vi.fn>).mockImplementation(function(this: any) {
      this.parse = mockParse;
      return { parse: mockParse };
    });

    const content = extractPageContent(mockDoc as Document);
    expect(content).toBe('Readability Content');
    expect(Readability).toHaveBeenCalled();
  });

  it('should fallback to innerText if Readability returns null', () => {
    const mockParse = vi.fn().mockReturnValue(null);

    (Readability as unknown as ReturnType<typeof vi.fn>).mockImplementation(function(this: any) {
      return { parse: mockParse };
    });

    const content = extractPageContent(mockDoc as Document);
    expect(content).toBe('Fallback content');
  });

  it('should fallback to innerText if Readability throws', () => {
    (Readability as unknown as ReturnType<typeof vi.fn>).mockImplementation(function(this: any) {
      return {
        parse: vi.fn().mockImplementation(() => { throw new Error('Failed'); })
      };
    });

    const content = extractPageContent(mockDoc as Document);
    expect(content).toBe('Fallback content');
  });
});
