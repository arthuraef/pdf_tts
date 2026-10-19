import type { PDFPageContent, TextChunk } from '../types';

/**
 * Divide o texto estritamente em sentenças completas que começam e terminam
 * entre pontos finais (pontuação de término de frase: . ! ? ...).
 * Garante integridade sintática e cadência natural, sem fatiamentos artificiais
 * em vírgulas ou quebras de linha acidentais de PDFs.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];

  // 1. Normaliza quebras de linha e parágrafos do PDF
  let normalized = text.replace(/\r\n/g, '\n');

  // Adiciona ponto final em linhas que são títulos ou parágrafos sem pontuação final
  normalized = normalized.replace(/([^\s.!?…:;—–])\n\s*\n+/g, '$1.\n\n');

  // Quebras de linha simples dentro de parágrafos são unidas com espaço
  normalized = normalized.replace(/([^\n])\n([^\n])/g, '$1 $2');

  // Colapsa múltiplos espaços em branco
  normalized = normalized.replace(/[ \t]+/g, ' ').trim();

  if (!normalized) return [];

  // 2. Protege pontos que não são terminação de frase
  const PLACEHOLDER_DOT = '\uE000';

  // a) Decimais e separadores de milhar (ex: 1.500 ou 3.14)
  normalized = normalized.replace(/(\d)\.(\d)/g, `$1${PLACEHOLDER_DOT}$2`);

  // b) Iniciais de nomes com letra maiúscula única (ex: J. K. Rowling)
  normalized = normalized.replace(/\b([A-Z])\.\s+/g, `$1${PLACEHOLDER_DOT} `);

  // c) Abreviações comuns que terminam em ponto
  const abbrevRegex = /\b(Dr|Dra|Sr|Sra|Prof|Profa|Art|pág|cap|vol|etc|vs|cia|ltda|apto|núm|nº|al|av)\.\s+/gi;
  normalized = normalized.replace(abbrevRegex, (_m, abbr) => `${abbr}${PLACEHOLDER_DOT} `);

  // 3. Fatiamento por pontuação final (. ! ? ... ou reticências …)
  // seguido opcionalmente por aspas ou parênteses de fechamento
  const sentenceRegex = /([^.!?…]+[.!?…]+["'”»)]*)/g;
  const matches = normalized.match(sentenceRegex);
  const sentences: string[] = [];

  if (matches && matches.length > 0) {
    let lastIndex = 0;
    for (const match of matches) {
      lastIndex = normalized.indexOf(match, lastIndex) + match.length;
      const restored = match.replace(new RegExp(PLACEHOLDER_DOT, 'g'), '.').trim();
      if (restored) {
        // Garante que todo chunk termine com pontuação final
        const withFinalPunct = /[.!?…]["'”»)]*$/.test(restored) ? restored : `${restored}.`;
        sentences.push(withFinalPunct);
      }
    }

    const remaining = normalized.slice(lastIndex).trim();
    if (remaining) {
      const restoredRem = remaining.replace(new RegExp(PLACEHOLDER_DOT, 'g'), '.');
      const withFinalPunct = /[.!?…]["'”»)]*$/.test(restoredRem) ? restoredRem : `${restoredRem}.`;
      sentences.push(withFinalPunct);
    }
  } else {
    const restored = normalized.replace(new RegExp(PLACEHOLDER_DOT, 'g'), '.').trim();
    if (restored) {
      const withFinalPunct = /[.!?…]["'”»)]*$/.test(restored) ? restored : `${restored}.`;
      sentences.push(withFinalPunct);
    }
  }

  return sentences;
}

/**
 * Utilitário auxiliar para fatiamento sob limite estrito se solicitado externamente.
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
 * Constrói chunks atômicos por sentenças completas que começam e terminam entre pontos finais.
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
