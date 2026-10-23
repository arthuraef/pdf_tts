/**
 * Ponto de entrada do módulo Sanitizer (Camada 1 do Oscar Engine).
 * Alinhado com a Política de Segmentação e Normalização com Proveniência UTF-16.
 */

import { dehyphenate } from './dehyphenator';
import { applyPtBrLexicon } from './ptBrLexicon';
import { filterHeadersAndFooters } from './headerFooterFilter';
import { preReadRepair } from './textErrorRepair';
import { sanitizeWithProvenance, type SanitizationResult } from './normalizationMap';

export * from './dehyphenator';
export * from './ptBrLexicon';
export * from './headerFooterFilter';
export * from './textErrorRepair';
export * from './normalizationMap';
export * from './numberToWords';

/**
 * Higieniza o texto de uma única página ou bloco de texto:
 * 1. Pré-leitura: repara ligaduras (%00echa -> flecha), letras separadas (B RUXA -> Bruxa),
 *    palavras em maiúsculas soletradas como sigla e termos estrangeiros.
 * 2. De-hifenização de quebras de linha (exem-\nplo -> exemplo).
 * 3. Léxico PT-BR (Artigos, incisos, numerais jurídicos, abreviações).
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  const repaired = preReadRepair(text);
  const unhyphenated = dehyphenate(repaired);
  return applyPtBrLexicon(unhyphenated);
}

/**
 * Higieniza o texto preservando metadados e mapeamento de proveniência por span (UTF-16)
 * conforme especificação OpenAPI 3.2.1 / NormalizationMapItem.
 */
export function sanitizeTextWithProvenance(text: string, pageNumber: number = 1): SanitizationResult {
  return sanitizeWithProvenance(text, pageNumber);
}

/**
 * Higieniza o conjunto completo de páginas de um documento,
 * aplicando remoção de cabeçalhos/rodapés repetidos, pré-leitura, de-hifenização e léxico.
 */
export function sanitizeDocumentPages(pages: string[]): string[] {
  const withoutHeaders = filterHeadersAndFooters(pages);
  return withoutHeaders.map((p) => sanitizeText(p));
}
