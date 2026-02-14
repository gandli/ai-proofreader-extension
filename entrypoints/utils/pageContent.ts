import { Readability } from '@mozilla/readability';

/**
 * Extracts the main content from the document using Readability.js.
 * Falls back to document.body.innerText if extraction fails.
 *
 * @param doc The document to extract content from.
 * @returns The extracted text content.
 */
export function extractPageContent(doc: Document): string {
  try {
    // Clone the document to avoid modifying the original DOM
    const clone = doc.cloneNode(true) as Document;
    const reader = new Readability(clone);
    const article = reader.parse();

    if (article && article.textContent) {
      return article.textContent.trim();
    }
  } catch (error) {
    console.warn('Readability extraction failed, falling back to innerText:', error);
  }

  // Fallback to simple extraction
  return doc.body.innerText.trim();
}
