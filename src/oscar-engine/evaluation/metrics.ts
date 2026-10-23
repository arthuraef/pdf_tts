/**
 * 📊 Métricas de Qualidade e Avaliação Fonética TTS (metrics.ts)
 * Implementação pura em TypeScript (zero dependências) inspirada no módulo
 * `metrics.py` do TTS-Utils (Grupo RAIA) e nas diretrizes do plano de qualificação
 * de motores TTS pt-BR (tts-engine-qualification-plan-v0.1).
 */

import { sanitizeWithProvenance } from '../sanitizer/normalizationMap';

export interface TestCaseResult {
  id: string;
  category: string;
  originalText: string;
  expectedSpoken: string;
  actualSpoken: string;
  cer: number;
  wer: number;
  passed: boolean;
}

export interface GoldsetReport {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  accuracyPct: number;
  meanCER: number;
  meanWER: number;
  results: TestCaseResult[];
  failures: TestCaseResult[];
}

export interface GoldsetItem {
  id: string;
  category: string;
  original: string;
  expectedSpoken: string;
  description?: string;
}

/**
 * Calcula a distância de edição de Levenshtein entre duas sequências.
 * Complexidade de espaço otimizada: O(min(N, M)).
 */
export function levenshteinDistance<T>(a: ArrayLike<T>, b: ArrayLike<T>): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,       // inserção
        prev[j] + 1,           // remoção
        prev[j - 1] + cost     // substituição
      );
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }

  return prev[b.length];
}

/**
 * Normaliza pontuação e espaçamentos para avaliação fonética equitativa.
 */
export function normalizeForAcousticComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'”»«]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula o Character Error Rate (CER).
 * CER = Levenshtein(hipótese, referência) / max(1, length(referência))
 */
export function calculateCER(hypothesis: string, reference: string): number {
  const normHyp = normalizeForAcousticComparison(hypothesis);
  const normRef = normalizeForAcousticComparison(reference);

  if (normHyp === normRef) return 0;
  if (normRef.length === 0) return normHyp.length;

  const dist = levenshteinDistance(normHyp.split(''), normRef.split(''));
  return parseFloat((dist / normRef.length).toFixed(4));
}

/**
 * Calcula o Word Error Rate (WER).
 * WER = Levenshtein_palavras(hipótese, referência) / max(1, count_palavras(referência))
 */
export function calculateWER(hypothesis: string, reference: string): number {
  const normHyp = normalizeForAcousticComparison(hypothesis);
  const normRef = normalizeForAcousticComparison(reference);

  if (normHyp === normRef) return 0;

  const wordsHyp = normHyp ? normHyp.split(/\s+/) : [];
  const wordsRef = normRef ? normRef.split(/\s+/) : [];

  if (wordsRef.length === 0) return wordsHyp.length;

  const dist = levenshteinDistance(wordsHyp, wordsRef);
  return parseFloat((dist / wordsRef.length).toFixed(4));
}

/**
 * Avalia um caso de teste isolado através da pipeline de higienização fonética do OscarEngine.
 */
export function evaluateTestCase(item: GoldsetItem): TestCaseResult {
  const { spokenText } = sanitizeWithProvenance(item.original, 1);
  const cer = calculateCER(spokenText, item.expectedSpoken);
  const wer = calculateWER(spokenText, item.expectedSpoken);
  const passed = cer === 0 && wer === 0;

  return {
    id: item.id,
    category: item.category,
    originalText: item.original,
    expectedSpoken: item.expectedSpoken,
    actualSpoken: spokenText,
    cer,
    wer,
    passed,
  };
}

/**
 * Executa uma bateria completa de avaliação contra o Goldset e sumariza estatísticas objetivas.
 */
export function evaluateGoldset(items: GoldsetItem[]): GoldsetReport {
  const results = items.map(evaluateTestCase);
  const passedCases = results.filter((r) => r.passed).length;
  const failedCases = results.length - passedCases;
  const accuracyPct = parseFloat(((passedCases / results.length) * 100).toFixed(2));

  const totalCER = results.reduce((acc, r) => acc + r.cer, 0);
  const totalWER = results.reduce((acc, r) => acc + r.wer, 0);
  const meanCER = parseFloat((totalCER / results.length).toFixed(4));
  const meanWER = parseFloat((totalWER / results.length).toFixed(4));

  const failures = results.filter((r) => !r.passed);

  return {
    totalCases: items.length,
    passedCases,
    failedCases,
    accuracyPct,
    meanCER,
    meanWER,
    results,
    failures,
  };
}
