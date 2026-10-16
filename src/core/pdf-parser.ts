import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFPageContent } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ExtractionResult {
  pages: PDFPageContent[];
  totalCharacters: number;
}

export async function extractTextFromPDF(file: File): Promise<ExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDocument = await loadingTask.promise;
  const pages: PDFPageContent[] = [];
  let totalCharacters = 0;

  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();

    const strings: string[] = [];
    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string') {
        const text = item.str.trim();
        if (text) {
          strings.push(text);
        }
      }
    }

    const pageText = strings.join(' ').replace(/\s+/g, ' ').trim();
    totalCharacters += pageText.length;

    pages.push({
      pageNumber: pageNum,
      text: pageText,
    });
  }

  return {
    pages,
    totalCharacters,
  };
}
