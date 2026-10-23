/**
 * Conversor de Numerais Cardinais para Português Brasileiro por Extenso (numberToWords.ts)
 * Suporta números inteiros de 0 até 999.999.999.999 com concordância natural.
 */

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
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
const CENTENAS = [
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

function parseUnder1000(n: number): string {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;
  const parts: string[] = [];

  if (c > 0) parts.push(CENTENAS[c]);
  if (d === 1) {
    parts.push(ESPECIAIS[u]);
  } else {
    if (d > 1) parts.push(DEZENAS[d]);
    if (u > 0) parts.push(UNIDADES[u]);
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
  return `${parseUnder1000(n)} ${plural}`;
}

export function numberToWordsPtBr(num: number): string {
  if (num === 0) return 'zero';
  if (num < 0) return `menos ${numberToWordsPtBr(Math.abs(num))}`;

  const bilhoes = Math.floor(num / 1000000000);
  const milhoes = Math.floor((num % 1000000000) / 1000000);
  const milhares = Math.floor((num % 1000000) / 1000);
  const resto = num % 1000;

  const result: string[] = [];

  if (bilhoes > 0) result.push(parseChunk(bilhoes, 'bilhão', 'bilhões'));
  if (milhoes > 0) result.push(parseChunk(milhoes, 'milhão', 'milhões'));
  if (milhares > 0) result.push(parseChunk(milhares, 'mil', 'mil'));

  if (resto > 0) {
    const textResto = parseUnder1000(resto);
    if (result.length > 0) {
      result.push(`e ${textResto}`);
    } else {
      result.push(textResto);
    }
  }

  return result.join(' ').replace(/\s+/g, ' ').trim();
}
