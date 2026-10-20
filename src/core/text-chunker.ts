import type { PDFPageContent, TextChunk } from '../types';
import type { SourceSpan } from '../oscar-engine/types';

export interface DiscursiveChunkItem {
  text: string;
  level: 'paragraph' | 'sentence' | 'clause';
  sourceStart: number;
  sourceEnd: number;
}

export interface DiscursiveSegmentationOptions {
  maxParagraphChars?: number; // Padrão: 450 caracteres por parágrafo discursivo
  maxSentenceChars?: number;  // Padrão: 180 caracteres para fallback de sentenças
}

/**
 * Fatiador de sentença pura dentro de um bloco, sem inventar pontos finais.
 */
function splitBlockIntoSentences(block: string): string[] {
  const normalized = block
    .replace(/([^\n])\n([^\n])/g, '$1 $2')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (!normalized) return [];

  // Protege pontos de numerais e abreviações
  const DOT = '\uE000';
  const protectedText = normalized
    .replace(/(\d)\.(\d)/g, `$1${DOT}$2`)
    .replace(/\b([A-Z])\.\s+/g, `$1${DOT} `)
    .replace(
      /\b(Dr|Dra|Sr|Sra|Prof|Profa|Art|pág|cap|vol|etc|vs|cia|ltda|apto|núm|nº|al|av)\.\s+/gi,
      (_m, a) => `${a}${DOT} `
    );

  const sentenceRegex = /([^.!?…]+[.!?…]+["'”»)]*)(?:\s+|$)/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  const sentences: string[] = [];

  while ((match = sentenceRegex.exec(protectedText)) !== null) {
    lastIndex = sentenceRegex.lastIndex;
    const clean = match[1].replace(new RegExp(DOT, 'g'), '.').trim();
    if (clean) sentences.push(clean);
  }

  // Restante sem pontuação final (títulos, itens de lista) - SEM PONTO FALSO
  const remainder = protectedText.slice(lastIndex).trim();
  if (remainder) {
    const cleanRem = remainder.replace(new RegExp(DOT, 'g'), '.').trim();
    if (cleanRem) sentences.push(cleanRem);
  }

  return sentences;
}

/**
 * Divide o texto em sentenças naturais.
 * Mantido para compatibilidade e testes diretos de sentenças.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];

  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const chunks: string[] = [];

  for (const block of blocks) {
    const sentences = splitBlockIntoSentences(block);
    chunks.push(...sentences);
  }

  return chunks;
}

/**
 * Utilitário auxiliar para fatiamento de sentença sob limite estrito por cláusulas gramaticais.
 * Divide em pontuação secundária (; : —) e vírgulas, sem decepar palavras no meio.
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
 * Segmentador Discursivo Hierárquico (tts-pdf-segmentation-policy-v0.1)
 *
 * 1. Unidade Contextual Padrão = Parágrafo Semântico (preserva cadência e relações prosódicas).
 * 2. Fallback para Parágrafos Longos = Sentenças naturais (pontuação [.?!…], sem pontos falsos).
 * 3. Fallback para Sentenças Excepcionais = Cláusulas e orações (pontuação secundária ; : —).
 */
export function splitDiscursiveUnits(
  text: string,
  options: DiscursiveSegmentationOptions = {}
): DiscursiveChunkItem[] {
  if (!text || !text.trim()) return [];

  const maxParagraphChars = options.maxParagraphChars ?? 450;
  const maxSentenceChars = options.maxSentenceChars ?? 180;

  const rawBlocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const results: DiscursiveChunkItem[] = [];
  let searchCursor = 0;

  for (const block of rawBlocks) {
    const normalizedBlock = block
      .replace(/([^\n])\n([^\n])/g, '$1 $2')
      .replace(/[ \t]+/g, ' ')
      .trim();

    if (!normalizedBlock) continue;

    // Localiza o bloco no texto original para rastreamento de offset
    const blockIndex = text.indexOf(block, searchCursor);
    const actualStart = blockIndex !== -1 ? blockIndex : searchCursor;
    const actualEnd = actualStart + block.length;
    searchCursor = actualEnd;

    // CASO 1: O parágrafo cabe no limiar de contexto -> emite como unidade discursiva única
    if (normalizedBlock.length <= maxParagraphChars) {
      results.push({
        text: normalizedBlock,
        level: 'paragraph',
        sourceStart: actualStart,
        sourceEnd: actualEnd,
      });
      continue;
    }

    // CASO 2: Parágrafo longo -> fallback para sentenças naturais
    const sentences = splitBlockIntoSentences(block);
    let sentenceCursor = actualStart;

    for (const sent of sentences) {
      const sentIdx = text.indexOf(sent, sentenceCursor);
      const sentStart = sentIdx !== -1 ? sentIdx : sentenceCursor;
      const sentEnd = sentStart + sent.length;
      sentenceCursor = sentEnd;

      // Se a sentença couber no limite, emite como sentença
      if (sent.length <= maxSentenceChars) {
        results.push({
          text: sent,
          level: 'sentence',
          sourceStart: sentStart,
          sourceEnd: sentEnd,
        });
      } else {
        // CASO 3: Sentença excepcionalmente longa -> fallback para cláusulas
        const clauses = splitSentenceUnderLimit(sent, maxSentenceChars);
        let clauseCursor = sentStart;
        for (const clause of clauses) {
          const cIdx = text.indexOf(clause, clauseCursor);
          const cStart = cIdx !== -1 ? cIdx : clauseCursor;
          const cEnd = cStart + clause.length;
          clauseCursor = cEnd;

          results.push({
            text: clause,
            level: 'clause',
            sourceStart: cStart,
            sourceEnd: cEnd,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Constrói chunks com política discursiva e rastreamento de proveniência de offsets UTF-16
 * a partir das páginas extraídas do PDF.
 */
export function buildChunksFromPages(
  pages: PDFPageContent[],
  options?: DiscursiveSegmentationOptions
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkCounter = 0;

  pages.forEach((page, pageIdx) => {
    const rawText = page.text.trim();
    if (!rawText) return;

    // Usa a política de segmentação discursiva
    const units = splitDiscursiveUnits(rawText, options);

    for (const unit of units) {
      const sourceOffsets: SourceSpan[] = [
        {
          page: page.pageNumber ?? pageIdx + 1,
          start: unit.sourceStart,
          end: unit.sourceEnd,
        },
      ];

      chunks.push({
        pageIndex: pageIdx,
        chunkIndex: chunkCounter++,
        text: unit.text,
        rawText: unit.text,
        sourceOffsets,
      });
    }
  });

  return chunks;
}
