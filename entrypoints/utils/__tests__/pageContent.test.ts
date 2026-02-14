/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractPageContent } from '../pageContent';
import { Readability } from '@mozilla/readability';

// Mock Readability
vi.mock('@mozilla/readability', () => {
  return {
    Readability: vi.fn(),
  };
});

describe('extractPageContent', () => {
  let doc: Document;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create a basic document
    doc = document.implementation.createHTMLDocument('Test Document');
    doc.body.innerHTML = '<div>Fallback content</div>';
  });

  it('should use Readability to extract content', () => {
    const mockArticle = { textContent: 'Readability content' };

    // Setup mock return value
    const parseMock = vi.fn().mockReturnValue(mockArticle);
    (Readability as unknown as ReturnType<typeof vi.fn>).mockImplementation(function() {
      return { parse: parseMock };
    });

    const result = extractPageContent(doc);
    expect(result).toBe('Readability content');
    expect(Readability).toHaveBeenCalled();
  });

  it('should fallback to body.innerText if Readability returns null', () => {
    // Setup mock to return null
    const parseMock = vi.fn().mockReturnValue(null);
    (Readability as unknown as ReturnType<typeof vi.fn>).mockImplementation(function() {
      return { parse: parseMock };
    });

    const result = extractPageContent(doc);
    expect(result).toBe('Fallback content');
  });

  it('should fallback to body.innerText if Readability throws', () => {
    // Setup mock to throw
    (Readability as unknown as ReturnType<typeof vi.fn>).mockImplementation(function() {
      throw new Error('Parse error');
    });

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = extractPageContent(doc);
    expect(result).toBe('Fallback content');

    consoleSpy.mockRestore();
  });
});
