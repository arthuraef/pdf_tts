import type { PDFPageContent, TextChunk } from '../types';

/**
 * Divide sentenças longas em sub-cláusulas seguras (<= 160 caracteres),
 * fatiando em ponto e vírgula (;), dois pontos (:), travessões (—) ou vírgulas (,)
 * para prevenir o infame "Bug do Desmaio de 15 Segundos" do Google Chrome.
 */
export function splitSentenceUnderLimit(sentence: string, maxChars: number = 160): string[] {
  const trimmed = sentence.trim();
  if (trimmed.length <= maxChars) {
    return [trimmed];
  }

  // 1. Fatiamento em pontuação secundária: ; : — –
  const secondaryParts = trimmed.split(/([;:—–]+)/);
  const pass1: string[] = [];
  let buffer = '';

  for (let i = 0; i < secondaryParts.length; i++) {
    const part = secondaryParts[i];
    if ((buffer + part).length > maxChars && buffer.trim().length > 0) {
      pass1.push(buffer.trim());
      buffer = part;
    } else {
      buffer += part;
    }
  }
  if (buffer.trim()) {
    pass1.push(buffer.trim());
  }

  // 2. Se alguma sub-frase ainda passar de 160 chars, fatia em vírgulas
  const finalResult: string[] = [];
  for (const part of pass1) {
    if (part.length <= maxChars) {
      finalResult.push(part);
      continue;
    }

    const commaParts = part.split(/(,[ \t]+)/);
    let commaBuffer = '';
    for (const c of commaParts) {
      if ((commaBuffer + c).length > maxChars && commaBuffer.trim().length > 0) {
        finalResult.push(commaBuffer.trim());
        commaBuffer = c;
      } else {
        commaBuffer += c;
      }
    }
    if (commaBuffer.trim()) {
      finalResult.push(commaBuffer.trim());
    }
  }

  return finalResult.length > 0 ? finalResult : [trimmed];
}

/**
 * Constrói unidades de fala atômicas respeitando o teto de 160 caracteres.
 */
export function buildChunksFromPages(pages: PDFPageContent[]): TextChunk[] {
  const chunks: TextChunk[] = [];

  pages.forEach((page, pageIdx) => {
    const rawText = page.text.trim();
    if (!rawText) return;

    // Fatiamento primário por ponto final, exclamação, interrogação ou quebra de linha
    const rawSentences = rawText.match(/[^.!?\n]+[.!?\n]*/g) || [rawText];
    let chunkCounter = 0;

    for (const rawSentence of rawSentences) {
      const clean = rawSentence.trim();
      if (!clean) continue;

      const safeSentences = splitSentenceUnderLimit(clean, 160);
      for (const s of safeSentences) {
        if (s.trim()) {
          chunks.push({
            pageIndex: pageIdx,
            chunkIndex: chunkCounter++,
            text: s.trim(),
          });
        }
      }
    }
  });

  return chunks;
}
