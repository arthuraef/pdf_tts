/**
 * Motor Bionic Audio (bionicSpeed.ts)
 * Calcula a densidade cognitiva e léxica da sentença para modular dinamicamente
 * o ritmo acústico (desacelera em partes densas, acelera suavemente em partes fluidas).
 */

export function calculateBionicSpeedMultiplier(text: string): number {
  if (!text || text.trim().length === 0) return 1.0;

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1.0;

  // 1. Comprimento médio das palavras
  const totalChars = words.reduce((acc, w) => acc + w.length, 0);
  const avgWordLength = totalChars / words.length;

  // 2. Contagem de números e termos técnicos longos (> 10 caracteres)
  const numbersCount = (text.match(/\b\d+(?:[.,]\d+)?\b/g) || []).length;
  const longWordsCount = words.filter((w) => w.length >= 10).length;

  // 3. Densidade de pontuação complexa (dois pontos, ponto e vírgula, parênteses)
  const punctuationDensity = (text.match(/[:;()\[\]{}]/g) || []).length / words.length;

  // Pontuação de complexidade (0 a 10)
  let complexity = 0;

  // Palavras longas adicionam complexidade
  if (avgWordLength > 6.5) complexity += 3;
  else if (avgWordLength > 5.5) complexity += 1.5;
  else if (avgWordLength < 4.2) complexity -= 2;

  // Presença de números (datas, leis, porcentagens, valores)
  if (numbersCount > 2) complexity += 2.5;
  else if (numbersCount > 0) complexity += 1.5;

  // Palavras muito longas
  if (longWordsCount >= 3) complexity += 2;
  else if (longWordsCount >= 1) complexity += 1;

  if (punctuationDensity > 0.15) complexity += 1.5;

  // Mapeia complexidade (-2 a +10) para o multiplicador Bionic (0.90x a 1.30x)
  // Complexidade alta -> mais lento (0.90x a 0.98x)
  // Complexidade baixa -> mais rápido (1.15x a 1.30x)
  if (complexity >= 6) {
    return 0.92; // Trecho muito denso/técnico
  } else if (complexity >= 3) {
    return 0.98; // Trecho de média-alta densidade
  } else if (complexity <= -1) {
    return 1.25; // Trecho muito simples e fluido
  } else if (complexity === 0) {
    return 1.15; // Trecho ligeiramente fluido
  }

  return 1.05; // Padrão equilibrado
}
