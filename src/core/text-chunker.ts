import type { PDFPageContent, TextChunk } from '../types';

/**
 * Breaks sentences/paragraphs into digestible speech units.
 * Targets roughly 120-200 characters per chunk to prevent Chrome Web Speech API timeouts
 * and enable granular navigation (forward/rewind).
 */
export function buildChunksFromPages(pages: PDFPageContent[]): TextChunk[] {
  const chunks: TextChunk[] = [];

  pages.forEach((page, pageIdx) => {
    const rawText = page.text.trim();
    if (!rawText) return;

    // Split text by sentence endings (., !, ?, \n)
    const sentences = rawText.match(/[^.!?\n]+[.!?\n]*/g) || [rawText];
    let currentBuffer = '';
    let chunkCounter = 0;

    for (const sentence of sentences) {
      const cleanSentence = sentence.trim();
      if (!cleanSentence) continue;

      if ((currentBuffer + ' ' + cleanSentence).trim().length > 180 && currentBuffer.length > 0) {
        chunks.push({
          pageIndex: pageIdx,
          chunkIndex: chunkCounter++,
          text: currentBuffer.trim(),
        });
        currentBuffer = cleanSentence;
      } else {
        currentBuffer = currentBuffer ? `${currentBuffer} ${cleanSentence}` : cleanSentence;
      }
    }

    if (currentBuffer.trim()) {
      chunks.push({
        pageIndex: pageIdx,
        chunkIndex: chunkCounter++,
        text: currentBuffer.trim(),
      });
    }
  });

  return chunks;
}
