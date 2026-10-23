/**
 * Dicionário Fonético Brasileiro & Normalizador Semiótico Completo (ptBrLexicon.ts)
 * 
 * Incorpora a totalidade das regras do TTS-Utils (Grupo RAIA) e NVIDIA NeMo-text-processing:
 * 1. Dicionário Completo de Abreviações e UFs Brasileiras (27 UFs em contexto, tratamentos, logradouros, jurídicas, latinismos)
 * 2. Conversão de Moeda Brasileira com Pontuação Real (R$ 0,01 a R$ 1.500.000,00 com "de reais", centavos e decimais)
 * 3. Separação de Números Colados a Grandezas (kg, g, mg, km, m, cm, mm, m², m³, km/h, °C, ml, l, min, s, dB, V, W, GB)
 * 4. Horários Falados Naturais (meia-noite, meio-dia e meia, 1h -> uma hora, 2h -> duas horas, 21h, 8:05, 14:30)
 * 5. Numerais jurídicos (Artigos ordinais/cardinais, incisos com algarismos romanos, parágrafos)
 */

import { numberToWordsPtBr } from './numberToWords';

// ---------------------------------------------------------------------------
// 1. Numerais Ordinais & Romanos (Direito e Séculos)
// ---------------------------------------------------------------------------
export const ORDINAIS_MASCULINOS: Record<string, string> = {
  '1': 'primeiro',
  '2': 'segundo',
  '3': 'terceiro',
  '4': 'quarto',
  '5': 'quinto',
  '6': 'sexto',
  '7': 'sétimo',
  '8': 'oitavo',
  '9': 'nono',
  '10': 'décimo',
};

export const ROMANOS_INCISOS: Record<string, string> = {
  I: 'primeiro',
  II: 'segundo',
  III: 'terceiro',
  IV: 'quarto',
  V: 'quinto',
  VI: 'sexto',
  VII: 'sétimo',
  VIII: 'oitavo',
  IX: 'nono',
  X: 'décimo',
  XI: 'onze',
  XII: 'doze',
  XIII: 'treze',
  XIV: 'quatorze',
  XV: 'quinze',
  XVI: 'dezesseis',
  XVII: 'dezessete',
  XVIII: 'dezoito',
  XIX: 'dezenove',
  XX: 'vinte',
  XXI: 'vinte e um',
};

export const SECULOS_ROMANOS: Record<string, string> = {
  I: 'primeiro',
  II: 'segundo',
  III: 'terceiro',
  IV: 'quarto',
  V: 'quinto',
  VI: 'sexto',
  VII: 'sétimo',
  VIII: 'oitavo',
  IX: 'nono',
  X: 'décimo',
  XI: 'onze',
  XII: 'doze',
  XIII: 'treze',
  XIV: 'quatorze',
  XV: 'quinze',
  XVI: 'dezesseis',
  XVII: 'dezessete',
  XVIII: 'dezoito',
  XIX: 'dezenove',
  XX: 'vinte',
  XXI: 'vinte e um',
};

// Meses em português brasileiro
export const MESES_PTBR = [
  '',
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

// ---------------------------------------------------------------------------
// 2. Dicionário Completo das 27 UFs Brasileiras
// ---------------------------------------------------------------------------
export const ESTADOS_BRASILEIROS: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};

/**
 * Converte UFs brasileiras em contexto geográfico, institucional e administrativo.
 * ex.: "São Paulo - SP", "Curitiba/PR", "em MG", "governo de SP", "TJSP", "OAB/SP".
 */
export function convertBrazilianUfs(text: string): string {
  let res = text;

  // 1. Tribunais de Justiça Estaduais: TJSP, TJRJ, TJMG, TJ-RS...
  res = res.replace(/\bTJ-?([A-Z]{2})\b/g, (match, uf) => {
    if (ESTADOS_BRASILEIROS[uf]) {
      return `Tribunal de Justiça de ${ESTADOS_BRASILEIROS[uf]}`;
    }
    return match;
  });

  // 2. Seccionais da OAB: OAB/SP, OAB-RJ, OAB MG...
  res = res.replace(/\bOAB[\/-]?\s*([A-Z]{2})\b/g, (match, uf) => {
    if (ESTADOS_BRASILEIROS[uf]) {
      return `O A B ${ESTADOS_BRASILEIROS[uf]}`;
    }
    return match;
  });

  // 3. Cidades, endereços ou siglas com hífen ou barra: "1000 - SP", "Campinas - SP", "Londrina/PR"
  res = res.replace(
    /([A-ZÀ-Úa-zà-ú\d]+)\s*[\/-]\s*([A-Z]{2})\b/g,
    (match, prefix, uf) => {
      if (ESTADOS_BRASILEIROS[uf]) {
        return `${prefix} - ${ESTADOS_BRASILEIROS[uf]}`;
      }
      return match;
    }
  );

  // 4. Preposições geográficas: "em SP", "no RJ", "de MG", "para a BA", "pelo RS"
  res = res.replace(
    /\b(em|no|na|de|do|da|para|pelo|pela)\s+([A-Z]{2})\b/g,
    (match, prep, uf) => {
      if (ESTADOS_BRASILEIROS[uf]) {
        return `${prep} ${ESTADOS_BRASILEIROS[uf]}`;
      }
      return match;
    }
  );

  // 5. Contexto político-administrativo: "Estado de SP", "governo de MG", "capital de SC"
  res = res.replace(
    /\b(Estado|Governo|governo|capital|interior|comarca)\s+(?:de|do|da)\s+([A-Z]{2})\b/g,
    (match, tipo, uf) => {
      if (ESTADOS_BRASILEIROS[uf]) {
        return `${tipo} de ${ESTADOS_BRASILEIROS[uf]}`;
      }
      return match;
    }
  );

  return res;
}

// ---------------------------------------------------------------------------
// 3. Conversão de Moeda Brasileira com Pontuação Real
// ---------------------------------------------------------------------------
/**
 * Formata valores monetários com regras gramaticais estritas brasileiras:
 * - R$ 1,00 -> "um real"
 * - R$ 0,50 -> "cinquenta centavos"
 * - R$ 0,01 -> "um centavo"
 * - R$ 1,50 -> "um real e cinquenta centavos"
 * - R$ 1.000.000,00 -> "um milhão de reais" (partícula 'de' em milhões/bilhões redondos)
 * - R$ 1.500.000,00 -> "um milhão e quinhentos mil reais"
 * - R$ 50 -> "cinquenta reais"
 * - -R$ 10,00 / R$ -10,00 -> "menos dez reais"
 */
export function convertCurrency(text: string): string {
  // 1. Real Brasileiro (R$) - não consome espaço à esquerda
  const brlRegex = /(?:(-)\s*)?R\$\s*(-)?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g;
  let result = text.replace(brlRegex, (_match, neg1, neg2, rawNum: string) => {
    const isNegative = Boolean(neg1 || neg2);
    let inteiro = 0;
    let centavos = 0;

    if (rawNum.includes(',')) {
      const [inteiroStr, decStr] = rawNum.replace(/\./g, '').split(',');
      inteiro = parseInt(inteiroStr, 10) || 0;
      const paddedDec = (decStr + '00').slice(0, 2);
      centavos = parseInt(paddedDec, 10) || 0;
    } else {
      inteiro = parseInt(rawNum.replace(/\./g, ''), 10) || 0;
    }

    const parts: string[] = [];
    if (isNegative) parts.push('menos');

    if (inteiro > 0) {
      const wordInt = numberToWordsPtBr(inteiro);
      let currWord: string;
      if (inteiro === 1) {
        currWord = 'real';
      } else if (inteiro >= 1000000 && inteiro % 1000000 === 0) {
        currWord = 'de reais';
      } else {
        currWord = 'reais';
      }
      parts.push(`${wordInt} ${currWord}`);
    }

    if (centavos > 0) {
      const wordCent = numberToWordsPtBr(centavos);
      const centWord = centavos === 1 ? 'centavo' : 'centavos';
      if (inteiro > 0) {
        parts.push(`e ${wordCent} ${centWord}`);
      } else {
        parts.push(`${wordCent} ${centWord}`);
      }
    }

    if (inteiro === 0 && centavos === 0) {
      parts.push('zero reais');
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  });

  // 2. Dólar Americano (USD, US$, U$)
  const usdRegex = /(?:(-)\s*)?(?:USD|US\$|U\$)\s*(-)?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/gi;
  result = result.replace(usdRegex, (_match, neg1, neg2, rawNum: string) => {
    const isNegative = Boolean(neg1 || neg2);
    let inteiro = 0;
    let centavos = 0;

    if (rawNum.includes(',')) {
      const [inteiroStr, decStr] = rawNum.replace(/\./g, '').split(',');
      inteiro = parseInt(inteiroStr, 10) || 0;
      const paddedDec = (decStr + '00').slice(0, 2);
      centavos = parseInt(paddedDec, 10) || 0;
    } else {
      inteiro = parseInt(rawNum.replace(/\./g, ''), 10) || 0;
    }

    const parts: string[] = [];
    if (isNegative) parts.push('menos');

    if (inteiro > 0) {
      const wordInt = numberToWordsPtBr(inteiro);
      const currWord = inteiro === 1 ? 'dólar' : 'dólares';
      parts.push(`${wordInt} ${currWord}`);
    }

    if (centavos > 0) {
      const wordCent = numberToWordsPtBr(centavos);
      const centWord = centavos === 1 ? 'centavo de dólar' : 'centavos de dólar';
      if (inteiro > 0) {
        parts.push(`e ${wordCent} ${centWord}`);
      } else {
        parts.push(`${wordCent} ${centWord}`);
      }
    }

    if (inteiro === 0 && centavos === 0) {
      parts.push('zero dólares');
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  });

  // 3. Euro (€ ou EUR)
  const eurRegex = /(?:(-)\s*)?(?:EUR|€)\s*(-)?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/gi;
  result = result.replace(eurRegex, (_match, neg1, neg2, rawNum: string) => {
    const isNegative = Boolean(neg1 || neg2);
    let inteiro = 0;
    let centavos = 0;

    if (rawNum.includes(',')) {
      const [inteiroStr, decStr] = rawNum.replace(/\./g, '').split(',');
      inteiro = parseInt(inteiroStr, 10) || 0;
      const paddedDec = (decStr + '00').slice(0, 2);
      centavos = parseInt(paddedDec, 10) || 0;
    } else {
      inteiro = parseInt(rawNum.replace(/\./g, ''), 10) || 0;
    }

    const parts: string[] = [];
    if (isNegative) parts.push('menos');

    if (inteiro > 0) {
      const wordInt = numberToWordsPtBr(inteiro);
      const currWord = inteiro === 1 ? 'euro' : 'euros';
      parts.push(`${wordInt} ${currWord}`);
    }

    if (centavos > 0) {
      const wordCent = numberToWordsPtBr(centavos);
      const centWord = centavos === 1 ? 'centavo de euro' : 'centavos de euro';
      if (inteiro > 0) {
        parts.push(`e ${wordCent} ${centWord}`);
      } else {
        parts.push(`${wordCent} ${centWord}`);
      }
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  });

  return result;
}

// ---------------------------------------------------------------------------
// 4. Separação de Números Colados a Grandezas e Medidas (SI + Cotidianas)
// ---------------------------------------------------------------------------
/**
 * Converte grandezas físicas descolando números colados às unidades métricas.
 */
export function convertMeasures(text: string): string {
  let res = text;

  // 1. Velocidade Composta (km/h, m/s)
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:km\/h|Km\/h|kmh)\b/gi, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} quilômetros por hora`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*m\/s\b/gi, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} metros por segundo`;
  });

  // 2. Área e Volume (m², km², cm², m³, cm³)
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:m²|m2)(?!\w)/gi, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} metros quadrados`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:km²|km2)(?!\w)/gi, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} quilômetros quadrados`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:cm²|cm2)(?!\w)/gi, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} centímetros quadrados`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:m³|m3)(?!\w)/gi, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} metros cúbicos`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:cm³|cm3)(?!\w)/gi, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} centímetros cúbicos`;
  });

  // 3. Temperatura (°C, ºC, °F)
  res = res.replace(/(-?\d+(?:,\d+)?)\s*(?:°C|ºC)(?!\w)/gi, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} graus celsius`;
  });
  res = res.replace(/(-?\d+(?:,\d+)?)\s*(?:°F|ºF)(?!\w)/gi, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} graus fahrenheit`;
  });

  // 4. Porcentagem (inteira e decimal)
  res = res.replace(/\b(\d+),(\d+)\s*%/g, (_m, intStr, decStr) => {
    return `${numberToWordsPtBr(parseInt(intStr, 10))} vírgula ${numberToWordsPtBr(parseInt(decStr, 10))} por cento`;
  });
  res = res.replace(/\b(\d+)\s*%/g, (_m, num) => {
    return `${numberToWordsPtBr(parseInt(num, 10))} por cento`;
  });

  // 5. Massa e Peso (kg, g, mg, ton)
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:kg|Kg|KG)\b/g, (_m, numStr: string) => {
    if (numStr === '1') return 'um quilo';
    return `${formatMeasureNumber(numStr)} quilos`;
  });
  res = res.replace(/\b(\d+)\s*g\b(?![²³23a-zA-Z])/g, (_m, numStr: string) => {
    if (numStr === '1') return 'um grama';
    return `${numberToWordsPtBr(parseInt(numStr, 10))} gramas`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*mg\b/gi, (_m, numStr: string) => {
    if (numStr === '1') return 'um miligrama';
    return `${formatMeasureNumber(numStr)} miligramas`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:ton|t)\b(?![²³23a-zA-Z])/gi, (_m, numStr: string) => {
    if (numStr === '1') return 'uma tonelada';
    return `${formatMeasureNumber(numStr)} toneladas`;
  });

  // 6. Distância e Comprimento (km, cm, mm, m)
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:km|Km|KM)\b/g, (_m, numStr: string) => {
    if (numStr === '1') return 'um quilômetro';
    return `${formatMeasureNumber(numStr)} quilômetros`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*cm\b/gi, (_m, numStr: string) => {
    if (numStr === '1') return 'um centímetro';
    return `${formatMeasureNumber(numStr)} centímetros`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*mm\b/gi, (_m, numStr: string) => {
    if (numStr === '1') return 'um milímetro';
    return `${formatMeasureNumber(numStr)} milímetros`;
  });
  res = res.replace(/\b(\d+)\s*m\b(?![²³23a-zA-Z])/g, (_m, numStr: string) => {
    if (numStr === '1') return 'um metro';
    return `${numberToWordsPtBr(parseInt(numStr, 10))} metros`;
  });

  // 7. Líquidos e Volume (ml, l)
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:ml|mL)\b/g, (_m, numStr: string) => {
    if (numStr === '1') return 'um mililitro';
    return `${formatMeasureNumber(numStr)} mililitros`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:l|L)\b(?![²³23a-zA-Z])/g, (_m, numStr: string) => {
    if (numStr === '1') return 'um litro';
    return `${formatMeasureNumber(numStr)} litros`;
  });

  // 8. Tempo e Duração (min, s, seg)
  res = res.replace(/\b(\d+)\s*(?:min|mins)\b/gi, (_m, numStr: string) => {
    if (numStr === '1') return 'um minuto';
    return `${numberToWordsPtBr(parseInt(numStr, 10))} minutos`;
  });
  res = res.replace(/\b(\d+)\s*(?:seg|segs|s)\b(?![²³23a-zA-Z])/gi, (_m, numStr: string) => {
    if (numStr === '1') return 'um segundo';
    return `${numberToWordsPtBr(parseInt(numStr, 10))} segundos`;
  });

  // 9. Eletricidade, Potência e Som (V, W, kW, kWh, dB, Hz)
  res = res.replace(/\b(\d+)\s*(?:V|v)\b(?![²³23a-zA-Z])/g, (_m, numStr: string) => {
    return `${numberToWordsPtBr(parseInt(numStr, 10))} volts`;
  });
  res = res.replace(/\b(\d+)\s*A\b(?![²³23a-zA-Z])/g, (_m, numStr: string) => {
    if (numStr === '1') return 'um ampere';
    return `${numberToWordsPtBr(parseInt(numStr, 10))} amperes`;
  });
  res = res.replace(/\b(\d+)\s*(?:W|w)\b(?![²³23a-zA-Z])/g, (_m, numStr: string) => {
    return `${numberToWordsPtBr(parseInt(numStr, 10))} watts`;
  });
  res = res.replace(/\b(\d+)\s*(?:kW|kw)\b/gi, (_m, numStr: string) => {
    return `${numberToWordsPtBr(parseInt(numStr, 10))} quilowatts`;
  });
  res = res.replace(/\b(\d+)\s*(?:kWh|kwh)\b/gi, (_m, numStr: string) => {
    return `${numberToWordsPtBr(parseInt(numStr, 10))} quilowatts-hora`;
  });
  res = res.replace(/\b(\d+)\s*dB\b/g, (_m, numStr: string) => {
    return `${numberToWordsPtBr(parseInt(numStr, 10))} decibéis`;
  });
  res = res.replace(/\b(\d+)\s*(?:Hz|hz)\b/gi, (_m, numStr: string) => {
    return `${numberToWordsPtBr(parseInt(numStr, 10))} hertz`;
  });
  res = res.replace(/\b(\d+)\s*(?:kHz|khz)\b/gi, (_m, numStr: string) => {
    return `${numberToWordsPtBr(parseInt(numStr, 10))} quilo-hertz`;
  });
  res = res.replace(/\b(\d+)\s*(?:MHz|mhz)\b/gi, (_m, numStr: string) => {
    return `${numberToWordsPtBr(parseInt(numStr, 10))} mega-hertz`;
  });
  res = res.replace(/\b(\d+)\s*(?:GHz|ghz)\b/gi, (_m, numStr: string) => {
    return `${numberToWordsPtBr(parseInt(numStr, 10))} giga-hertz`;
  });

  // 10. Dados e Armazenamento (GB, MB, KB, TB, Mbps)
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:GB|Gb|gb)\b/g, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} gigabytes`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:MB|Mb|mb)\b/g, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} megabytes`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:KB|Kb|kb)\b/g, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} quilobytes`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:TB|Tb|tb)\b/g, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} terabytes`;
  });
  res = res.replace(/\b(\d+(?:,\d+)?)\s*(?:Mbps|mbps)\b/gi, (_m, numStr: string) => {
    return `${formatMeasureNumber(numStr)} megabits por segundo`;
  });

  return res;
}

function formatMeasureNumber(numStr: string): string {
  if (numStr.includes(',')) {
    const [intPart, decPart] = numStr.split(',');
    return `${numberToWordsPtBr(parseInt(intPart, 10))} vírgula ${numberToWordsPtBr(parseInt(decPart, 10))}`;
  }
  return numberToWordsPtBr(parseInt(numStr, 10));
}

// ---------------------------------------------------------------------------
// 5. Horários Falados Naturais
// ---------------------------------------------------------------------------
/**
 * Converte horários cotidianos para a fala natural brasileira:
 * - 00:00 / 0h -> "meia-noite"
 * - 00:30 / 00h30 -> "meia-noite e meia"
 * - 12:00 / 12h -> "meio-dia"
 * - 12:30 / 12h30 -> "meio-dia e meia"
 * - 01:00 / 1h -> "uma hora"
 * - 02:00 / 2h -> "duas horas"
 * - 08:05 / 8:05 -> "oito horas e cinco minutos"
 * - 14:30 / 14h30 -> "quatorze horas e trinta minutos"
 * - 21:00 / 21h -> "vinte e uma horas"
 * - 22:00 / 22h -> "vinte e duas horas"
 * - 23:59 -> "vinte e três horas e cinquenta e nove minutos"
 */
export function convertTimes(text: string): string {
  let res = text;

  // Ajustes de crase e preposição temporal com meia-noite e meio-dia
  res = res.replace(/(?:\b|(?<=\s))(?:às|as)\s+(?:00:30|00h30)\b/gi, 'à meia-noite e meia');
  res = res.replace(/(?:\b|(?<=\s))(?:às|as)\s+(?:00:00|00h(?:00)?|0h)\b/gi, 'à meia-noite');
  res = res.replace(/(?:\b|(?<=\s))(?:às|as)\s+(?:12:30|12h30)\b/gi, 'ao meio-dia e meia');
  res = res.replace(/(?:\b|(?<=\s))(?:às|as)\s+(?:12:00|12h(?:00)?)\b/gi, 'ao meio-dia');

  // 1. Formato "14h30", "14h", "08h05", "12h30min", "0h"
  res = res.replace(
    /\b([0-1]?\d|2[0-3])[hH]([0-5]\d)?(?:min)?\b/g,
    (_m, hourStr: string, minStr: string) => {
      const hour = parseInt(hourStr, 10);
      const min = minStr ? parseInt(minStr, 10) : undefined;
      return formatHourAndMin(hour, min);
    }
  );

  // 2. Formato "14:30", "08:00", "00:00", "12:00", "08:05"
  res = res.replace(
    /\b([0-1]?\d|2[0-3]):([0-5]\d)\b/g,
    (_m, hourStr: string, minStr: string) => {
      const hour = parseInt(hourStr, 10);
      const min = parseInt(minStr, 10);
      return formatHourAndMin(hour, min);
    }
  );

  return res;
}

function formatHourAndMin(hour: number, min: number | undefined): string {
  // Meia-noite
  if (hour === 0) {
    if (min === undefined || min === 0) return 'meia-noite';
    if (min === 30) return 'meia-noite e meia';
    if (min === 1) return 'meia-noite e um minuto';
    return `meia-noite e ${numberToWordsPtBr(min)} minutos`;
  }

  // Meio-dia
  if (hour === 12) {
    if (min === undefined || min === 0) return 'meio-dia';
    if (min === 30) return 'meio-dia e meia';
    if (min === 1) return 'meio-dia e um minuto';
    return `meio-dia e ${numberToWordsPtBr(min)} minutos`;
  }

  // Horas normais (concordância feminina para 1, 2, 21, 22)
  let hourWord: string;
  if (hour === 1) hourWord = 'uma hora';
  else if (hour === 2) hourWord = 'duas horas';
  else if (hour === 21) hourWord = 'vinte e uma horas';
  else if (hour === 22) hourWord = 'vinte e duas horas';
  else hourWord = `${numberToWordsPtBr(hour)} horas`;

  if (min === undefined || min === 0) {
    return hourWord;
  }

  if (min === 30) {
    if (hour === 1) return 'uma hora e meia';
    if (hour === 2) return 'duas horas e meia';
    return `${hourWord} e trinta minutos`;
  }

  if (min === 1) {
    return `${hourWord} e um minuto`;
  }

  return `${hourWord} e ${numberToWordsPtBr(min)} minutos`;
}

// ---------------------------------------------------------------------------
// 6. Datas Completas (DD/MM/AAAA ou DD-MM-AAAA)
// ---------------------------------------------------------------------------
export function convertDates(text: string): string {
  return text.replace(
    /\b([0-2]?\d|3[01])[\/\.-](0?[1-9]|1[0-2])[\/\.-](\d{4})\b/g,
    (_m, dayStr: string, monthStr: string, yearStr: string) => {
      const day = parseInt(dayStr, 10);
      const month = parseInt(monthStr, 10);
      const year = parseInt(yearStr, 10);

      const daySpoken = day === 1 ? 'primeiro' : numberToWordsPtBr(day);
      const monthSpoken = MESES_PTBR[month] || '';
      const yearSpoken = numberToWordsPtBr(year);

      return `${daySpoken} de ${monthSpoken} de ${yearSpoken}`;
    }
  );
}

// ---------------------------------------------------------------------------
// 7. Dicionário Completo de Abreviações Brasileiras (TTS-Utils)
// ---------------------------------------------------------------------------
export function applyBrazilianAbbreviations(text: string): string {
  let res = text;

  // 1. Títulos e Formas de Tratamento
  res = res.replace(/\bDr\.\s+/g, 'Doutor ');
  res = res.replace(/\b(?:Dra\.|Drª)\s+/g, 'Doutora ');
  res = res.replace(/\bProf\.\s+/g, 'Professor ');
  res = res.replace(/\b(?:Profa\.|Profª)\s+/g, 'Professora ');
  res = res.replace(/\bSr\.\s+/g, 'Senhor ');
  res = res.replace(/\b(?:Sra\.|Srª)\s+/g, 'Senhora ');
  res = res.replace(/\b(?:V\.\s*Sa\.|V\.\s*S\.ª|V\.Sa\.)\s*/gi, 'Vossa Senhoria ');
  res = res.replace(/\b(?:V\.\s*Exa\.|V\.\s*Ex\.ª|V\.Exa\.)\s*/gi, 'Vossa Excelência ');
  res = res.replace(/\b(?:V\.\s*Maga\.|V\.\s*Mag\.ª)\s*/gi, 'Vossa Magnificência ');
  res = res.replace(/\b(?:Exmo\.|Exmº)\s+/gi, 'Excelentíssimo ');
  res = res.replace(/\b(?:Exma\.|Exmª)\s+/gi, 'Excelentíssima ');
  res = res.replace(/\b(?:Ilmo\.|Ilmº)\s+/gi, 'Ilustríssimo ');
  res = res.replace(/\b(?:Ilma\.|Ilmª)\s+/gi, 'Ilustríssima ');
  res = res.replace(/\bRevmo\.\s+/gi, 'Reverendíssimo ');
  res = res.replace(/\bRevma\.\s+/gi, 'Reverendíssima ');
  res = res.replace(/\b(?:Eng\.|Engº)\s+/g, 'Engenheiro ');
  res = res.replace(/\bEngª\s+/g, 'Engenheira ');
  res = res.replace(/\bArq\.\s+/g, 'Arquiteto ');
  res = res.replace(/\bArqª\s+/g, 'Arquiteta ');
  res = res.replace(/\bBel\.\s+/g, 'Bacharel ');
  res = res.replace(/\bPe\.\s+/g, 'Padre ');
  res = res.replace(/\bCel\.\s+/g, 'Coronel ');
  res = res.replace(/\bMaj\.\s+/g, 'Major ');
  res = res.replace(/\bCap\.\s+/g, 'Capitão ');
  res = res.replace(/\bTen\.\s+/g, 'Tenente ');
  res = res.replace(/\bSgt\.\s+/g, 'Sargento ');

  // 2. Logradouros e Endereços
  res = res.replace(/\bAv\.\s+/gi, 'Avenida ');
  res = res.replace(/\bRod\.\s+/gi, 'Rodovia ');
  res = res.replace(/\bEst\.\s+([A-ZÀ-Ú])/g, 'Estrada $1');
  res = res.replace(/\b(?:Trav\.|Tv\.)\s+/gi, 'Travessa ');
  res = res.replace(/\bAl\.\s+/gi, 'Alameda ');
  res = res.replace(/\bLgo\.\s+/gi, 'Largo ');
  res = res.replace(/\b(?:Pça\.|Pc\.)\s+/gi, 'Praça ');
  res = res.replace(/\bVd\.\s+/gi, 'Viaduto ');
  res = res.replace(/\bBl\.\s+/gi, 'Bloco ');
  res = res.replace(/\bEd\.\s+/gi, 'Edifício ');
  res = res.replace(/\bCond\.\s+/gi, 'Condomínio ');
  res = res.replace(/\bQd\.\s+/gi, 'Quadra ');
  res = res.replace(/\bLt\.\s+/gi, 'Lote ');
  res = res.replace(/\b(?:apto\.|ap\.|apt\.)\s*(\d+)/gi, (_m, n) => `apartamento ${n}`);
  res = res.replace(/\bcj\.\s*(\d+)/gi, (_m, n) => `conjunto ${n}`);
  res = res.replace(/\bsl\.\s*(\d+)/gi, (_m, n) => `sala ${n}`);
  res = res.replace(/\b(?:no\.|nº|Nº|num\.)\s*(\d+)/gi, (_m, n) => `número ${n}`);
  res = res.replace(/\bCEP\b/g, 'C E P');
  res = res.replace(/\b(?:Cx\.\s*Postal|Cx\.\s*postal|C\.P\.)\s*(\d+)/gi, (_m, n) => `Caixa Postal ${n}`);

  // 3. Empresas e Documentos
  res = res.replace(/\b(?:Ltda\.|LTDA)(?!\w)/gi, 'Limitada');
  res = res.replace(/\b(?:S\/A|S\.A\.)(?!\w)/gi, 'Sociedade Anônima');
  res = res.replace(/\bMEI\b/g, 'M E I');
  res = res.replace(/\bEIRELI\b/g, 'Eireli');
  res = res.replace(/\bCNPJ\b/g, 'C N P J');
  res = res.replace(/\bCPF\b/g, 'C P F');
  res = res.replace(/\bRG\b/g, 'R G');
  res = res.replace(/\bPIS\/PASEP\b/gi, 'PIS Pasep');

  // 4. Jurídico e Forense
  res = res.replace(/\bSTF\b/g, 'éssi tê éfe');
  res = res.replace(/\bSTJ\b/g, 'éssi tê jota');
  res = res.replace(/\bTST\b/g, 'tê ésse tê');
  res = res.replace(/\bTSE\b/g, 'tê ésse é');
  res = res.replace(/\bTRT\b/g, 'tê érre tê');
  res = res.replace(/\bTRF\b/g, 'tê érre éfe');
  res = res.replace(/\bOAB\b/g, 'O A B');
  res = res.replace(/\bCLT\b/g, 'C L T');
  res = res.replace(/\bCDC\b/g, 'Código de Defesa do Consumidor');
  res = res.replace(/\bCPC\b/g, 'Código de Processo Civil');
  res = res.replace(/\bCPP\b/g, 'Código de Processo Penal');
  res = res.replace(/\bCF\/88\b/g, 'Constituição Federal');
  res = res.replace(/\b(?:da|na)\s+CF\b/g, (match) => match.replace('CF', 'Constituição Federal'));
  res = res.replace(/\b(?:do|no)\s+CC\b/g, (match) => match.replace('CC', 'Código Civil'));
  res = res.replace(/\b(?:DJ|DOU|DOE)\b/g, 'Diário Oficial');
  res = res.replace(/\bProc\.\s*(\d+)/gi, (_m, n) => `Processo ${n}`);
  res = res.replace(/\bfls?\.\s*(\d+)/gi, (_m, n) => `folhas ${n}`);
  res = res.replace(/\bdocs?\.\s*(\d+)/gi, (_m, n) => `documento ${n}`);
  res = res.replace(/\bp\.\s*ex\./gi, 'por exemplo');
  res = res.replace(/\bv\.\s*g\./gi, 'por exemplo');

  // 5. Acadêmico, Bibliográfico e Comum
  res = res.replace(/\b(?:págs?\.|pp\.)\s*(\d+)/gi, (_match, num) => `página ${num}`);
  res = res.replace(/\bcaps?\.\s*(\d+)/gi, (_match, num) => `capítulo ${num}`);
  res = res.replace(/\bvols?\.\s*(\d+)/gi, (_match, num) => `volume ${num}`);
  res = res.replace(/\bex\.:?\s+/gi, 'por exemplo, ');
  res = res.replace(/\bobs\.:?\s+/gi, 'observação: ');
  res = res.replace(/\bref\.:?\s+/gi, 'referência: ');

  // 6. Latinismos e Cronologia
  res = res.replace(/\ba\.C\.(?!\w)/gi, 'antes de Cristo');
  res = res.replace(/\bd\.C\.(?!\w)/gi, 'depois de Cristo');
  res = res.replace(/\betc\.(?!\w)/gi, 'êti cétera');
  res = res.replace(/\be\.g\.(?!\w)/gi, 'por exemplo');
  res = res.replace(/\bi\.e\.(?!\w)/gi, 'isto é');
  res = res.replace(/\bvs\.(?!\w)/gi, 'versus');
  res = res.replace(/\bet\s+al\.(?!\w)/gi, 'et alii');
  res = res.replace(/\bid\.(?!\w)/gi, 'idem');
  res = res.replace(/\bibid\.(?!\w)/gi, 'ibidem');
  res = res.replace(/\bop\.\s*cit\.(?!\w)/gi, 'obra citada');

  return res;
}

// ---------------------------------------------------------------------------
// 8. Pipeline Geral de Aplicação do Léxico
// ---------------------------------------------------------------------------
export function applyPtBrLexicon(text: string): string {
  if (!text) return '';

  let processed = text;

  // 1. Moedas brasileiras e internacionais
  processed = convertCurrency(processed);

  // 2. Datas e Horários
  processed = convertDates(processed);
  processed = convertTimes(processed);

  // 3. Medidas e grandezas
  processed = convertMeasures(processed);

  // 4. UFs brasileiras em contexto
  processed = convertBrazilianUfs(processed);

  // 5. Artigos de Lei (Art. 1º até Art. 9º ordinais; 10+ cardinais)
  processed = processed.replace(/\bArt\.\s*(\d+)(?:[º°ª])?/gi, (_match, numStr: string) => {
    const num = parseInt(numStr, 10);
    if (num <= 10 && ORDINAIS_MASCULINOS[numStr]) {
      return `Artigo ${ORDINAIS_MASCULINOS[numStr]}`;
    }
    return `Artigo ${num}`;
  });

  // 6. Parágrafos Legais (§ 1º, § 2º, § único)
  processed = processed.replace(/§\s*único\b/gi, 'Parágrafo único');
  processed = processed.replace(/§\s*(\d+)(?:[º°ª])?/g, (_match, numStr: string) => {
    const num = parseInt(numStr, 10);
    if (num <= 10 && ORDINAIS_MASCULINOS[numStr]) {
      return `Parágrafo ${ORDINAIS_MASCULINOS[numStr]}`;
    }
    return `Parágrafo ${num}`;
  });

  // 7. Incisos com algarismos romanos: Inc. IV ou Inciso IV
  processed = processed.replace(/\b(?:Inc\.|Inciso)\s*([IVX]+)\b/gi, (_match, roman: string) => {
    const upperRoman = roman.toUpperCase();
    const spoken = ROMANOS_INCISOS[upperRoman] || upperRoman;
    return `Inciso ${spoken}`;
  });

  // 8. Séculos com algarismos romanos (I a XXI)
  processed = processed.replace(/\b(?:Século|Séc\.)\s+([IVX]+)\b/gi, (_match, roman: string) => {
    const spoken = SECULOS_ROMANOS[roman.toUpperCase()];
    return spoken ? `Século ${spoken}` : _match;
  });

  // 9. Reis e Papas (D. Pedro II, João Paulo II)
  processed = processed.replace(/\bD\.\s+Pedro\s+II\b/g, 'Dom Pedro segundo');
  processed = processed.replace(/\bD\.\s+Pedro\s+I\b/g, 'Dom Pedro primeiro');

  // 10. Dicionário Completo de Abreviações Brasileiras
  processed = applyBrazilianAbbreviations(processed);

  // 11. Decimais avulsos (ex.: 2,5 -> dois vírgula cinco)
  processed = processed.replace(/\b(\d+),(\d+)\b/g, (_m, intStr, decStr) => {
    return `${numberToWordsPtBr(parseInt(intStr, 10))} vírgula ${numberToWordsPtBr(parseInt(decStr, 10))}`;
  });

  return processed;
}
