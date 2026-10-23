/**
 * Dicionário Fonético Brasileiro & Normalizador Semiótico (ptBrLexicon.ts)
 * 
 * Incorpora regras de produção do NVIDIA NeMo-text-processing e do Grupo RAIA (TTS-Utils):
 * - Numerais jurídicos (Artigos, incisos, parágrafos)
 * - Algarismos romanos e séculos
 * - Moedas complexas com separador de milhar brasileiro (R$ 3.200,75 -> três mil e duzentos reais...)
 * - Unidades de medida e grandezas descoladas (10kg -> dez quilos, 50km/h)
 * - Datas completas (23/10/2026 -> vinte e três de outubro de...)
 * - Horários cotidianos (14:30 -> quatorze horas e trinta minutos, 10h)
 * - UFs brasileiras em contexto geográfico (SP -> São Paulo, RJ -> Rio de Janeiro)
 * - Endereços, tratamentos e latinismos (Av., Rod., Dr., Dra., etc., a.C., d.C.)
 */

import { numberToWordsPtBr } from './numberToWords';

// Mapeamento de numerais ordinais comuns no Direito (1º ao 10º)
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

// Mapeamento de algarismos romanos para leitura falada natural
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
};

// Meses em português
const MESES_PTBR = [
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

// UFs brasileiras
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
 * Converte valores monetários brasileiros (R$ 3.200,75 ou USD 100).
 */
export function convertCurrency(text: string): string {
  const currencies = [
    { regex: /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)/g, singular: 'real', plural: 'reais' },
    { regex: /(?:USD|U\$)\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)/g, singular: 'dólar', plural: 'dólares' },
  ];

  let result = text;
  currencies.forEach(({ regex, singular, plural }) => {
    result = result.replace(regex, (_match, rawNum: string) => {
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
      if (inteiro > 0) {
        const wordInt = numberToWordsPtBr(inteiro);
        const currWord = inteiro === 1 ? singular : plural;
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
      return parts.join(' ') || `zero ${plural}`;
    });
  });

  return result;
}

/**
 * Converte datas completas no formato DD/MM/AAAA ou DD-MM-AAAA.
 */
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

/**
 * Converte horários (14:30, 14h, 14h30, 08:00).
 */
export function convertTimes(text: string): string {
  let res = text;

  // Horários tipo "14h30", "14h30min", "14h"
  res = res.replace(
    /\b([0-1]?\d|2[0-3])h([0-5]\d)?(?:min)?\b/gi,
    (_m, hourStr: string, minStr: string) => {
      const hour = parseInt(hourStr, 10);
      const hourWord = hour === 1 ? 'uma hora' : `${numberToWordsPtBr(hour)} horas`;

      if (minStr) {
        const min = parseInt(minStr, 10);
        if (min > 0) {
          const minWord = min === 1 ? 'um minuto' : `${numberToWordsPtBr(min)} minutos`;
          return `${hourWord} e ${minWord}`;
        }
      }
      return hourWord;
    }
  );

  // Horários tipo "14:30", "08:00"
  res = res.replace(
    /\b([0-1]?\d|2[0-3]):([0-5]\d)\b/g,
    (_m, hourStr: string, minStr: string) => {
      const hour = parseInt(hourStr, 10);
      const min = parseInt(minStr, 10);
      const hourWord = hour === 1 ? 'uma hora' : `${numberToWordsPtBr(hour)} horas`;

      if (min === 0) {
        return hourWord;
      }
      return `${hourWord} e ${numberToWordsPtBr(min)} minutos`;
    }
  );

  return res;
}

/**
 * Converte grandezas e unidades de medida, descolando números colados (10kg -> 10 quilos).
 */
export function convertMeasures(text: string): string {
  let res = text;

  // 1. Unidades compostas e com barra
  res = res.replace(/\b(\d+)\s*(?:km\/h|Km\/h)\b/gi, (_m, num) => {
    return `${numberToWordsPtBr(parseInt(num, 10))} quilômetros por hora`;
  });

  // 2. Área e Volume (m², m³)
  res = res.replace(/\b(\d+)\s*m²(?!\w)/gi, (_m, num) => {
    return `${numberToWordsPtBr(parseInt(num, 10))} metros quadrados`;
  });
  res = res.replace(/\b(\d+)\s*m³(?!\w)/gi, (_m, num) => {
    return `${numberToWordsPtBr(parseInt(num, 10))} metros cúbicos`;
  });

  // 3. Temperatura
  res = res.replace(/\b(\d+)\s*(?:°C|ºC)(?!\w)/gi, (_m, num) => {
    return `${numberToWordsPtBr(parseInt(num, 10))} graus celsius`;
  });

  // 4. Porcentagem (inteira e decimal)
  res = res.replace(/\b(\d+),(\d+)\s*%/g, (_m, intStr, decStr) => {
    return `${numberToWordsPtBr(parseInt(intStr, 10))} vírgula ${numberToWordsPtBr(parseInt(decStr, 10))} por cento`;
  });
  res = res.replace(/\b(\d+)\s*%/g, (_m, num) => {
    return `${numberToWordsPtBr(parseInt(num, 10))} por cento`;
  });

  // 5. Peso e Comprimento padrão
  res = res.replace(/\b(\d+)\s*kg\b/gi, (_m, num) => {
    return `${numberToWordsPtBr(parseInt(num, 10))} quilos`;
  });
  res = res.replace(/\b(\d+)\s*km\b/gi, (_m, num) => {
    return `${numberToWordsPtBr(parseInt(num, 10))} quilômetros`;
  });
  res = res.replace(/\b(\d+)\s*cm\b/gi, (_m, num) => {
    return `${numberToWordsPtBr(parseInt(num, 10))} centímetros`;
  });
  res = res.replace(/\b(\d+)\s*mm\b/gi, (_m, num) => {
    return `${numberToWordsPtBr(parseInt(num, 10))} milímetros`;
  });
  res = res.replace(/\b(\d+)\s*ml\b/gi, (_m, num) => {
    return `${numberToWordsPtBr(parseInt(num, 10))} mililitros`;
  });
  res = res.replace(/\b(\d+)\s*mg\b/gi, (_m, num) => {
    return `${numberToWordsPtBr(parseInt(num, 10))} miligramas`;
  });

  return res;
}

/**
 * Converte UFs brasileiras quando encontradas em contexto geográfico claro:
 * ex: "São Paulo - SP", "Curitiba/PR", "nº 1000 - SP", "em MG", "no RJ".
 */
export function convertBrazilianUfs(text: string): string {
  let res = text;

  // Cidades, números de endereço ou siglas com hífen ou barra: "1000 - SP", "Campinas - SP", "Londrina/PR"
  res = res.replace(
    /([A-ZÀ-Úa-zà-ú\d]+)\s*[\/-]\s*([A-Z]{2})\b/g,
    (match, prefix, uf) => {
      if (ESTADOS_BRASILEIROS[uf]) {
        return `${prefix}, ${ESTADOS_BRASILEIROS[uf]}`;
      }
      return match;
    }
  );

  // Preposições geográficas: "em SP", "no RJ", "de MG", "para BA"
  res = res.replace(
    /\b(em|no|na|de|do|da|para)\s+([A-Z]{2})\b/g,
    (match, prep, uf) => {
      if (ESTADOS_BRASILEIROS[uf]) {
        return `${prep} ${ESTADOS_BRASILEIROS[uf]}`;
      }
      return match;
    }
  );

  return res;
}

/**
 * Pipeline mestre de expansão do léxico e normalização semiótica em PT-BR.
 */
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

  // 8. Séculos com algarismos romanos
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XXI\b/gi, 'Século vinte e um');
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XX\b/gi, 'Século vinte');
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XIX\b/gi, 'Século dezenove');
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XVIII\b/gi, 'Século dezoito');
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XVII\b/gi, 'Século dezessete');
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XVI\b/gi, 'Século dezesseis');
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XV\b/gi, 'Século quinze');

  // 9. Reis e Papas (D. Pedro II, João Paulo II)
  processed = processed.replace(/\bD\.\s+Pedro\s+II\b/g, 'Dom Pedro segundo');
  processed = processed.replace(/\bD\.\s+Pedro\s+I\b/g, 'Dom Pedro primeiro');

  // 10. Endereços urbanos (TTS-Utils)
  processed = processed.replace(/\bAv\.\s+/gi, 'Avenida ');
  processed = processed.replace(/\bRod\.\s+/gi, 'Rodovia ');
  processed = processed.replace(/\bEst\.\s+/gi, 'Estrada ');
  processed = processed.replace(/\bTrav\.\s+/gi, 'Travessa ');
  processed = processed.replace(/\bAl\.\s+/gi, 'Alameda ');
  processed = processed.replace(/\bLgo\.\s+/gi, 'Largo ');
  processed = processed.replace(/\b(?:no\.|nº|Nº)\s*(\d+)/gi, (_m, n) => `número ${n}`);
  processed = processed.replace(/\bapto\.?\s*(\d+)/gi, (_m, n) => `apartamento ${n}`);

  // 11. Abreviações comuns de títulos e tratamentos (TTS-Utils)
  processed = processed.replace(/\bDr\.\s+/g, 'Doutor ');
  processed = processed.replace(/\bDra\.\s+/g, 'Doutora ');
  processed = processed.replace(/\bProf\.\s+/g, 'Professor ');
  processed = processed.replace(/\b(?:Profa\.|Profª)\s+/g, 'Professora ');
  processed = processed.replace(/\bSr\.\s+/g, 'Senhor ');
  processed = processed.replace(/\b(?:Sra\.|Srª)\s+/g, 'Senhora ');

  // 12. Abreviações acadêmicas e bibliográficas
  processed = processed.replace(/\bpágs?\.\s*(\d+)/gi, (_match, num) => `página ${num}`);
  processed = processed.replace(/\bcap\.\s*(\d+)/gi, (_match, num) => `capítulo ${num}`);
  processed = processed.replace(/\bvol\.\s*(\d+)/gi, (_match, num) => `volume ${num}`);
  processed = processed.replace(/\bex\.:?\s+/gi, 'por exemplo, ');
  processed = processed.replace(/\bobs\.:?\s+/gi, 'observação: ');

  // 13. Latinismos e expressões cronológicas (TTS-Utils)
  processed = processed.replace(/\ba\.C\.(?!\w)/gi, 'antes de Cristo');
  processed = processed.replace(/\bd\.C\.(?!\w)/gi, 'depois de Cristo');
  processed = processed.replace(/\betc\.(?!\w)/gi, 'êti cétera');
  processed = processed.replace(/\be\.g\.(?!\w)/gi, 'por exemplo');
  processed = processed.replace(/\bi\.e\.(?!\w)/gi, 'isto é');
  processed = processed.replace(/\bvs\.(?!\w)/gi, 'versus');

  // 14. Decimais avulsos (ex: 2,5 -> dois vírgula cinco)
  processed = processed.replace(/\b(\d+),(\d+)\b/g, (_m, intStr, decStr) => {
    return `${numberToWordsPtBr(parseInt(intStr, 10))} vírgula ${numberToWordsPtBr(parseInt(decStr, 10))}`;
  });

  return processed;
}
