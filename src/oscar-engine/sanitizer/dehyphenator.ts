/**
 * Reconecta palavras quebradas por hífen no fim da linha em PDFs.
 * Exemplo: "cons-" na linha 1 e "titucional" na linha 2 -> "constitucional".
 * Preserva palavras compostas legítimas que não estão quebradas por quebra de linha.
 */

export function dehyphenate(text: string): string {
  if (!text) return '';

  // 1. Remove quebras de linha com hífen entre letras (incluindo acentuadas em pt-BR)
  // Ex: "cons-\n titucional" ou "cons-\r\n titucional" -> "constitucional"
  let cleaned = text.replace(
    /(?<=[a-zA-ZÀ-ÿ])-[\r\n\s]+(?=[a-zA-ZÀ-ÿ])/g,
    ''
  );

  // 2. Normaliza quebras de linha suaves simples em espaços, preservando parágrafos (\n\n)
  cleaned = cleaned.replace(/([^\n])\n([^\n])/g, '$1 $2');

  // 3. Normaliza espaços múltiplos
  cleaned = cleaned.replace(/[ \t]+/g, ' ');

  return cleaned.trim();
}
