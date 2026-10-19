/**
 * Filtro de Cabeçalhos, Rodapés e Numeração de Página (headerFooterFilter.ts)
 * Elimina ruídos de diagramação que quebram o fluxo da leitura.
 */

export interface PageLineMetadata {
  text: string;
  yRatio?: number; // 0 (base) a 1.0 (topo) se extraído geometricamente do PDF.js
}

export function isPageNumberPattern(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Exemplos: "42", "- 42 -", "Página 42", "Pag. 42", "42 / 150", "[ 12 ]", "12 | Capítulo 1"
  return (
    /^(?:[-–—\s]*\d+[-–—\s]*)$/.test(trimmed) ||
    /^(?:Pág(?:ina)?\.?\s*\d+(?:\s*(?:de|\/)\s*\d+)?)$/i.test(trimmed) ||
    /^(?:\[\s*\d+\s*\]|\(\s*\d+\s*\))$/.test(trimmed) ||
    /^\d+\s*[\/|]\s*\d+$/.test(trimmed)
  );
}

/**
 * Remove cabeçalhos e rodapés de uma lista de páginas analisando padrões de repetição e posição.
 */
export function filterHeadersAndFooters(pagesText: string[]): string[] {
  if (pagesText.length === 0) return [];
  if (pagesText.length === 1) {
    // Para página única, apenas remove numeração isolada no início ou fim
    return [cleanSinglePage(pagesText[0])];
  }

  // 1. Extrai a primeira e última linha não vazia de cada página
  const pageLines = pagesText.map((p) =>
    p.split('\n').map((l) => l.trim()).filter(Boolean)
  );

  // 2. Mapeia frequências da primeira linha e da última linha para identificar repetições
  const firstLineFreq = new Map<string, number>();
  const lastLineFreq = new Map<string, number>();

  pageLines.forEach((lines) => {
    if (lines.length > 0) {
      const first = lines[0];
      firstLineFreq.set(first, (firstLineFreq.get(first) || 0) + 1);
    }
    if (lines.length > 1) {
      const last = lines[lines.length - 1];
      lastLineFreq.set(last, (lastLineFreq.get(last) || 0) + 1);
    }
  });

  const threshold = Math.max(2, Math.floor(pagesText.length * 0.25));

  // 3. Processa cada página filtrando cabeçalhos e rodapés repetidos ou numéricos
  return pageLines.map((lines) => {
    if (lines.length === 0) return '';

    let startIndex = 0;
    let endIndex = lines.length;

    // Checa primeira linha
    if (lines.length > 0) {
      const first = lines[0];
      const isRepeated = (firstLineFreq.get(first) || 0) >= threshold;
      const isNum = isPageNumberPattern(first);

      if (isRepeated || isNum) {
        startIndex = 1;
      }
    }

    // Checa última linha
    if (endIndex > startIndex) {
      const last = lines[endIndex - 1];
      const isRepeated = (lastLineFreq.get(last) || 0) >= threshold;
      const isNum = isPageNumberPattern(last);

      if (isRepeated || isNum) {
        endIndex = endIndex - 1;
      }
    }

    return lines.slice(startIndex, endIndex).join('\n');
  });
}

function cleanSinglePage(pageText: string): string {
  const lines = pageText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return pageText;

  let startIndex = 0;
  let endIndex = lines.length;

  if (isPageNumberPattern(lines[0])) {
    startIndex = 1;
  }
  if (endIndex > startIndex && isPageNumberPattern(lines[endIndex - 1])) {
    endIndex = endIndex - 1;
  }

  return lines.slice(startIndex, endIndex).join('\n');
}
