/**
 * Conversor de Numerais Cardinais para Português Brasileiro por Extenso (numberToWords.ts)
 * Suporta números inteiros de 0 até 999.999.999.999 com concordância natural e de gênero.
 */

const UNIDADES_MASC = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const UNIDADES_FEM = ['', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];

const ESPECIAIS = [
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
];

const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
];

const CENTENAS_MASC = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
];

const CENTENAS_FEM = [
  '',
  'cento',
  'duzentas',
  'trezentas',
  'quatrocentas',
  'quinhentas',
  'seiscentas',
  'setecentas',
  'oitocentas',
  'novecentas',
];

function parseUnder1000(n: number, gender: 'm' | 'f' = 'm'): string {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;
  const parts: string[] = [];

  const centenas = gender === 'f' ? CENTENAS_FEM : CENTENAS_MASC;
  const unidades = gender === 'f' ? UNIDADES_FEM : UNIDADES_MASC;

  if (c > 0) parts.push(centenas[c]);
  if (d === 1) {
    parts.push(ESPECIAIS[u]);
  } else {
    if (d > 1) parts.push(DEZENAS[d]);
    if (u > 0) parts.push(unidades[u]);
  }

  return parts.join(' e ');
}

function parseChunk(n: number, singular: string, plural: string): string {
  if (n === 0) return '';
  if (n === 1) {
    if (!singular) return 'um';
    if (singular === 'mil') return 'mil';
    return `um ${singular}`;
  }
  return `${parseUnder1000(n, 'm')} ${plural}`;
}

export function numberToWordsPtBr(num: number, gender: 'm' | 'f' = 'm'): string {
  if (num === 0) return 'zero';
  if (num < 0) return `menos ${numberToWordsPtBr(Math.abs(num), gender)}`;

  const bilhoes = Math.floor(num / 1000000000);
  const milhoes = Math.floor((num % 1000000000) / 1000000);
  const milhares = Math.floor((num % 1000000) / 1000);
  const resto = num % 1000;

  const result: string[] = [];

  if (bilhoes > 0) result.push(parseChunk(bilhoes, 'bilhão', 'bilhões'));
  if (milhoes > 0) {
    const textMilhoes = parseChunk(milhoes, 'milhão', 'milhões');
    if (result.length > 0 && milhares === 0 && resto === 0) {
      result.push(`e ${textMilhoes}`);
    } else {
      result.push(textMilhoes);
    }
  }
  if (milhares > 0) {
    const textMilhares = parseChunk(milhares, 'mil', 'mil');
    if (result.length > 0 && resto === 0) {
      result.push(`e ${textMilhares}`);
    } else {
      result.push(textMilhares);
    }
  }

  if (resto > 0) {
    const textResto = parseUnder1000(resto, gender);
    if (result.length > 0) {
      result.push(`e ${textResto}`);
    } else {
      result.push(textResto);
    }
  }

  return result.join(' ').replace(/\s+/g, ' ').trim();
}
