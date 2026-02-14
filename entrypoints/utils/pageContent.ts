import { Readability } from '@mozilla/readability';

/**
 * Extracts the main content from the document using Readability.js.
 * Falls back to document.body.innerText if extraction fails or returns empty content.
 *
 * @param document The document to extract content from.
 * @returns The extracted text content.
 */
export function getPageContent(document: Document): string {
  try {
    // Clone the document to avoid modifying the actual page
    const documentClone = document.cloneNode(true) as Document;
    const article = new Readability(documentClone).parse();

    if (article && article.textContent) {
      return article.textContent.trim();
    }
  } catch (error) {
    console.error('Readability parsing failed:', error);
  }

  // Fallback to simple text extraction
  return document.body.innerText;
}
