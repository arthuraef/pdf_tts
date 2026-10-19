import type { PDFPageContent, TextChunk } from '../types';

/**
 * Divide o texto em chunks naturais correspondentes a sentenças completas ou títulos.
 * O texto é preservado EXATAMENTE como está no PDF:
 * - NENHUM ponto final é inventado ou forçado onde não existe.
 * - Sentenças são fatiadas pela pontuação final REAL (. ! ? ... …) existente no texto.
 * - Títulos e parágrafos sem ponto final mantêm sua grafia autêntica.
 * - Quebras de linha simples decorrentes da largura de coluna do PDF são unidas com espaço
 *   para evitar frases decepadas.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];

  // 1. Divide em blocos/parágrafos naturais por quebra dupla de linha (\n\n+)
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const chunks: string[] = [];

  for (const block of blocks) {
    // 2. Une quebras de linha simples dentro do mesmo parágrafo (quebras de coluna do PDF)
    const normalized = block
      .replace(/([^\n])\n([^\n])/g, '$1 $2')
      .replace(/[ \t]+/g, ' ')
      .trim();

    if (!normalized) continue;

    // 3. Protege pontos que não são finais de frase
    const DOT = '\uE000';
    const protectedText = normalized
      .replace(/(\d)\.(\d)/g, `$1${DOT}$2`)
      .replace(/\b([A-Z])\.\s+/g, `$1${DOT} `)
      .replace(
        /\b(Dr|Dra|Sr|Sra|Prof|Profa|Art|pág|cap|vol|etc|vs|cia|ltda|apto|núm|nº|al|av)\.\s+/gi,
        (_m, a) => `${a}${DOT} `
      );

    // 4. Fatiamento pela pontuação final (. ! ? ... ou …) que REALMENTE existe no texto
    // seguido opcionalmente por aspas ou parênteses e espaço/fim de string
    const sentenceRegex = /([^.!?…]+[.!?…]+["'”»)]*)(?:\s+|$)/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = sentenceRegex.exec(protectedText)) !== null) {
      lastIndex = sentenceRegex.lastIndex;
      const clean = match[1].replace(new RegExp(DOT, 'g'), '.').trim();
      if (clean) chunks.push(clean);
    }

    // 5. Se sobrou texto sem pontuação no fim do parágrafo (ex: título de capítulo ou item de lista)
    // Preserva o texto AUTÊNTICO — NÃO adiciona ponto final falso!
    const remainder = protectedText.slice(lastIndex).trim();
    if (remainder) {
      const cleanRem = remainder.replace(new RegExp(DOT, 'g'), '.').trim();
      if (cleanRem) chunks.push(cleanRem);
    }
  }

  return chunks;
}

/**
 * Utilitário auxiliar para fatiamento sob limite estrito se solicitado explicitamente.
 */
export function splitSentenceUnderLimit(sentence: string, maxChars: number = 160): string[] {
  const trimmed = sentence.trim();
  if (trimmed.length <= maxChars) {
    return [trimmed];
  }

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
 * Constrói chunks atômicos por sentenças naturais a partir de páginas de PDF.
 */
export function buildChunksFromPages(pages: PDFPageContent[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkCounter = 0;

  pages.forEach((page, pageIdx) => {
    const rawText = page.text.trim();
    if (!rawText) return;

    const sentences = splitIntoSentences(rawText);
    for (const s of sentences) {
      chunks.push({
        pageIndex: pageIdx,
        chunkIndex: chunkCounter++,
        text: s,
      });
    }
  });

  return chunks;
}
