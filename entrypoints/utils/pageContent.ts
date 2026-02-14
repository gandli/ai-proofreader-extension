import { Readability } from '@mozilla/readability';

export const extractPageContent = (doc: Document): string => {
  try {
    const documentClone = doc.cloneNode(true) as Document;
    const article = new Readability(documentClone).parse();

    if (article && article.textContent) {
      return article.textContent;
    }
  } catch (e) {
    console.error('Readability failed:', e);
  }

  return doc.body.innerText;
};
