/**
 * Ponto de entrada do módulo Sanitizer (Camada 1 do Oscar Engine).
 */

import { dehyphenate } from './dehyphenator';
import { applyPtBrLexicon } from './ptBrLexicon';
import { filterHeadersAndFooters } from './headerFooterFilter';

export * from './dehyphenator';
export * from './ptBrLexicon';
export * from './headerFooterFilter';

/**
 * Higieniza o texto de uma única página ou bloco de texto.
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  const unhyphenated = dehyphenate(text);
  return applyPtBrLexicon(unhyphenated);
}

/**
 * Higieniza o conjunto completo de páginas de um documento,
 * aplicando remoção de cabeçalhos/rodapés repetidos, de-hifenização e léxico.
 */
export function sanitizeDocumentPages(pages: string[]): string[] {
  const withoutHeaders = filterHeadersAndFooters(pages);
  return withoutHeaders.map((p) => sanitizeText(p));
}
