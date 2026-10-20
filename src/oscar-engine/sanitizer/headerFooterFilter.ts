/**
 * Filtro de Cabeçalhos, Rodapés e Numeração de Página (headerFooterFilter.ts)
 * Elimina ruídos de diagramação que quebram o fluxo da leitura,
 * preservando estritamente quebras de parágrafos duplas (\n\n).
 */

export interface PageLineMetadata {
  text: string;
  yRatio?: number; // 0 (base) a 1.0 (topo) se extraído geometricamente do PDF.js
}

export function isPageNumberPattern(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Exemplos: "42", "- 42 -", "Página 42", "Pag. 42", "42 / 150", "[ 12 ]", "12 | Capítulo 1", "1", "2", "3"
  return (
    /^(?:[-–—\s]*\d+[-–—\s]*)$/.test(trimmed) ||
    /^(?:Pág(?:ina)?\.?\s*\d+(?:\s*(?:de|\/)\s*\d+)?)$/i.test(trimmed) ||
    /^(?:\[\s*\d+\s*\]|\(\s*\d+\s*\))$/.test(trimmed) ||
    /^\d+\s*[\/|]\s*\d+$/.test(trimmed)
  );
}

/**
 * Remove cabeçalhos e rodapés de uma lista de páginas analisando padrões de repetição e posição,
 * preservando a separação natural de parágrafos (\n\n).
 */
export function filterHeadersAndFooters(pagesText: string[]): string[] {
  if (pagesText.length === 0) return [];
  if (pagesText.length === 1) {
    return [cleanSinglePage(pagesText[0])];
  }

  // 1. Identifica a primeira e última linha não-vazia de cada página
  const firstNonEmptyLines = pagesText.map((p) => {
    const lines = p.split(/\r?\n/).map((l) => l.trim());
    return lines.find((l) => l.length > 0) || '';
  });

  const lastNonEmptyLines = pagesText.map((p) => {
    const lines = p.split(/\r?\n/).map((l) => l.trim());
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].length > 0) return lines[i];
    }
    return '';
  });

  const firstLineFreq = new Map<string, number>();
  const lastLineFreq = new Map<string, number>();

  firstNonEmptyLines.forEach((l) => {
    if (l) firstLineFreq.set(l, (firstLineFreq.get(l) || 0) + 1);
  });
  lastNonEmptyLines.forEach((l) => {
    if (l) lastLineFreq.set(l, (lastLineFreq.get(l) || 0) + 1);
  });

  const threshold = Math.max(2, Math.floor(pagesText.length * 0.25));

  // 2. Processa cada página filtrando cabeçalhos e rodapés repetidos ou numéricos
  return pagesText.map((pageStr) => {
    const lines = pageStr.split(/\r?\n/).map((l) => l.trim());
    if (lines.length === 0) return '';

    let startIndex = 0;
    let endIndex = lines.length;

    // Localiza primeiro índice não-vazio
    while (startIndex < endIndex && lines[startIndex] === '') {
      startIndex++;
    }
    if (startIndex < endIndex) {
      const first = lines[startIndex];
      const isRepeated = (firstLineFreq.get(first) || 0) >= threshold;
      const isNum = isPageNumberPattern(first);
      if (isRepeated || isNum) {
        startIndex++;
      }
    }

    // Localiza último índice não-vazio
    while (endIndex > startIndex && lines[endIndex - 1] === '') {
      endIndex--;
    }
    if (endIndex > startIndex) {
      const last = lines[endIndex - 1];
      const isRepeated = (lastLineFreq.get(last) || 0) >= threshold;
      const isNum = isPageNumberPattern(last);
      if (isRepeated || isNum) {
        endIndex--;
      }
    }

    return lines.slice(startIndex, endIndex).join('\n');
  });
}

function cleanSinglePage(pageText: string): string {
  const lines = pageText.split(/\r?\n/).map((l) => l.trim());
  if (lines.length <= 1) return pageText;

  let startIndex = 0;
  let endIndex = lines.length;

  while (startIndex < endIndex && lines[startIndex] === '') {
    startIndex++;
  }
  if (startIndex < endIndex && isPageNumberPattern(lines[startIndex])) {
    startIndex++;
  }

  while (endIndex > startIndex && lines[endIndex - 1] === '') {
    endIndex--;
  }
  if (endIndex > startIndex && isPageNumberPattern(lines[endIndex - 1])) {
    endIndex--;
  }

  return lines.slice(startIndex, endIndex).join('\n');
}
