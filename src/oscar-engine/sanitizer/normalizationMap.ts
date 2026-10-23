import type { NormalizationMapItem, TokenClass } from '../types';
import { KNOWN_ACRONYMS } from './textErrorRepair';
import { numberToWordsPtBr } from './numberToWords';
import {
  ORDINAIS_MASCULINOS,
  ROMANOS_INCISOS,
  SECULOS_ROMANOS,
  ESTADOS_BRASILEIROS,
  MESES_PTBR,
} from './ptBrLexicon';

export interface SanitizationResult {
  spokenText: string;
  normalizationMap: NormalizationMapItem[];
  warnings: string[];
}

/**
 * Aplica um conjunto ordenado de regras de normalização semiótica, mantendo a proveniência exata
 * dos spans UTF-16 em relação ao texto original e ao texto falado gerado.
 * Alinhado às gramáticas do NVIDIA NeMo-text-processing e do Grupo RAIA (TTS-Utils).
 */
export function sanitizeWithProvenance(
  rawText: string,
  pageNumber: number = 1
): SanitizationResult {
  if (!rawText) {
    return { spokenText: '', normalizationMap: [], warnings: [] };
  }

  const mapItems: NormalizationMapItem[] = [];
  const warnings: string[] = [];

  // Helper para aplicar regras preservando proveniência
  function runRule(
    currentText: string,
    ruleId: string,
    tokenClass: TokenClass,
    regex: RegExp,
    replaceFn: (match: RegExpExecArray) => string,
    confidence = 1.0
  ): string {
    let result = '';
    let lastIndex = 0;
    const globalRegex = new RegExp(
      regex.source,
      regex.flags.includes('g') ? regex.flags : regex.flags + 'g'
    );

    let match: RegExpExecArray | null;
    while ((match = globalRegex.exec(currentText)) !== null) {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;

      result += currentText.slice(lastIndex, matchStart);

      const replacement = replaceFn(match);
      const spokenStart = result.length;
      result += replacement;
      const spokenEnd = result.length;

      if (match[0] !== replacement) {
        mapItems.push({
          spoken_start: spokenStart,
          spoken_end: spokenEnd,
          token_class: tokenClass,
          rule_id: ruleId,
          confidence,
          decision: 'normalized',
          source_spans: [
            {
              page: pageNumber,
              start: matchStart,
              end: matchEnd,
            },
          ],
        });
      }

      lastIndex = matchEnd;
    }

    result += currentText.slice(lastIndex);
    return result;
  }

  let text = rawText;

  // 1. Reparo de caracteres nulos e ligaduras tipográficas de PDF
  text = runRule(text, 'ptbr.repair.unicode_ligature.v1', 'ligature', /\uFB00/g, () => 'ff');
  text = runRule(text, 'ptbr.repair.unicode_ligature.v1', 'ligature', /\uFB01/g, () => 'fi');
  text = runRule(text, 'ptbr.repair.unicode_ligature.v1', 'ligature', /\uFB02/g, () => 'fl');
  text = runRule(text, 'ptbr.repair.unicode_ligature.v1', 'ligature', /\uFB03/g, () => 'ffi');
  text = runRule(text, 'ptbr.repair.unicode_ligature.v1', 'ligature', /\uFB04/g, () => 'ffl');
  text = runRule(text, 'ptbr.repair.null_char.v1', 'ocr_repair', /[\u0000\x00]/g, () => '');
  text = runRule(text, 'ptbr.repair.ligature.v1', 'ligature', /%00echa/g, () => 'flecha');

  // 2. Drop-caps e letras separadas de início de parágrafo (A B RUXA -> A bruxa)
  text = runRule(
    text,
    'ptbr.repair.ocr_tracking.v1',
    'ocr_repair',
    /\b([A-Za-zÀ-ÖØ-öø-ÿ])\s+([A-ZÀ-ÖØ-ß]{3,})\b/,
    (m) => {
      const rest = m[2].toLowerCase();
      return `${m[1]}${rest}`;
    }
  );

  // 3. Estrangeirismos comuns com hífen desnecessário
  text = runRule(text, 'ptbr.lexicon.loanword.v1', 'loanword', /\bwi-fi\b/gi, () => 'wifi');
  text = runRule(text, 'ptbr.lexicon.loanword.v1', 'loanword', /\be-book\b/gi, () => 'ebook');
  text = runRule(text, 'ptbr.lexicon.loanword.v1', 'loanword', /\be-books\b/gi, () => 'ebooks');
  text = runRule(text, 'ptbr.lexicon.loanword.v1', 'loanword', /\bcheck-in\b/gi, () => 'checkin');
  text = runRule(text, 'ptbr.lexicon.loanword.v1', 'loanword', /\bcheck-out\b/gi, () => 'checkout');

  // 4. De-hifenização de quebras de linha e palavras partidas com espaços ("deso - lação" -> "desolação")
  text = runRule(
    text,
    'ptbr.layout.dehyphenate.v1',
    'ocr_repair',
    /([a-zA-ZÀ-ÿ]+)\s*[-–—\u00AD\u2010\u2011\u2012\u2212]\s*[\r\n]+\s*([a-zA-ZÀ-ÿ]+)/,
    (m) => `${m[1]}${m[2]}`
  );

  text = runRule(
    text,
    'ptbr.layout.dehyphenate.v1',
    'ocr_repair',
    /([a-zA-ZÀ-ÿ]{2,})\s*[-–—\u00AD\u2010\u2011\u2012\u2212]\s*([a-zA-ZÀ-ÿ]{2,})/,
    (m) => {
      const p1 = m[1];
      const p2 = m[2];
      const p2Lower = p2.toLowerCase();
      const p1Lower = p1.toLowerCase();

      const CLAUSE_CONNECTORS = new Set([
        'que', 'mas', 'porém', 'contudo', 'todavia', 'e', 'ou', 'se', 'quando',
        'onde', 'como', 'porque', 'porquanto', 'pois', 'já', 'ainda', 'não', 'sim',
        'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'este', 'esta', 'esse',
        'essa', 'aquele', 'aquela', 'isto', 'isso', 'aquilo', 'de', 'em', 'para',
        'por', 'com', 'sem', 'sob', 'sobre', 'após', 'desde', 'até', 'entre',
        'disse', 'falou', 'respondeu', 'gritou', 'perguntou', 'afirmou', 'exclamou'
      ]);

      if (CLAUSE_CONNECTORS.has(p2Lower) || (p2[0] === p2[0].toUpperCase() && p2[0] !== p2Lower[0])) {
        return m[0];
      }

      if (
        /^(?:ção|ções|mento|mentos|dade|dades|mente|tucional|tucionais|tório|tórios|tória|tórias|tiva|tivas|tivo|tivos|gência|gências|cedente|cedentes|nizado|nizada|ficação|ficações|prudência|laç)/.test(p2Lower) ||
        /^(?:deso|inconsti|estabele|transfe|juris|homologa|auto|admi|dispo|pará|sen|proce|recor|apre|deter|compa|signi|recon|obri|impor|inter|subor|neces|repre|traba|conhe|cons|gover|presi)$/i.test(p1Lower) ||
        (p1.length <= 4 && p2.length <= 4)
      ) {
        return p1 + p2;
      }

      return m[0];
    }
  );

  // 5. Moeda brasileira com pontuação real (TTS-Utils) - NÃO engole espaços precedentes
  text = runRule(
    text,
    'ptbr.currency.brl.v1',
    'currency',
    /(?:(-)\s*)?R\$\s*(-)?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/,
    (m) => {
      const isNegative = Boolean(m[1] || m[2]);
      const rawNum = m[3];
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
    }
  );

  // Moeda USD
  text = runRule(
    text,
    'ptbr.currency.usd.v1',
    'currency',
    /(?:(-)\s*)?(?:USD|US\$|U\$)\s*(-)?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/i,
    (m) => {
      const isNegative = Boolean(m[1] || m[2]);
      const rawNum = m[3];
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
        parts.push(`${wordInt} ${inteiro === 1 ? 'dólar' : 'dólares'}`);
      }
      if (centavos > 0) {
        const wordCent = numberToWordsPtBr(centavos);
        const centWord = centavos === 1 ? 'centavo de dólar' : 'centavos de dólar';
        if (inteiro > 0) parts.push(`e ${wordCent} ${centWord}`);
        else parts.push(`${wordCent} ${centWord}`);
      }
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }
  );

  // 6. Datas completas (NeMo & TTS-Utils)
  text = runRule(
    text,
    'ptbr.datetime.date.v1',
    'datetime',
    /\b([0-2]?\d|3[01])[\/\.-](0?[1-9]|1[0-2])[\/\.-](\d{4})\b/,
    (m) => {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const year = parseInt(m[3], 10);

      const daySpoken = day === 1 ? 'primeiro' : numberToWordsPtBr(day);
      const monthSpoken = MESES_PTBR[month] || '';
      const yearSpoken = numberToWordsPtBr(year);

      return `${daySpoken} de ${monthSpoken} de ${yearSpoken}`;
    }
  );

  // 7. Horários Naturais (NeMo & TTS-Utils)
  text = runRule(
    text,
    'ptbr.datetime.time.v1',
    'datetime',
    /(?:\b|(?<=\s))(?:às|as)\s+(?:00:30|00h30)\b/i,
    () => 'à meia-noite e meia'
  );
  text = runRule(
    text,
    'ptbr.datetime.time.v1',
    'datetime',
    /(?:\b|(?<=\s))(?:às|as)\s+(?:00:00|00h(?:00)?|0h)\b/i,
    () => 'à meia-noite'
  );
  text = runRule(
    text,
    'ptbr.datetime.time.v1',
    'datetime',
    /(?:\b|(?<=\s))(?:às|as)\s+(?:12:30|12h30)\b/i,
    () => 'ao meio-dia e meia'
  );
  text = runRule(
    text,
    'ptbr.datetime.time.v1',
    'datetime',
    /(?:\b|(?<=\s))(?:às|as)\s+(?:12:00|12h(?:00)?)\b/i,
    () => 'ao meio-dia'
  );

  function formatHourMin(hour: number, min: number | undefined): string {
    if (hour === 0) {
      if (min === undefined || min === 0) return 'meia-noite';
      if (min === 30) return 'meia-noite e meia';
      if (min === 1) return 'meia-noite e um minuto';
      return `meia-noite e ${numberToWordsPtBr(min)} minutos`;
    }
    if (hour === 12) {
      if (min === undefined || min === 0) return 'meio-dia';
      if (min === 30) return 'meio-dia e meia';
      if (min === 1) return 'meio-dia e um minuto';
      return `meio-dia e ${numberToWordsPtBr(min)} minutos`;
    }
    let hourWord: string;
    if (hour === 1) hourWord = 'uma hora';
    else if (hour === 2) hourWord = 'duas horas';
    else if (hour === 21) hourWord = 'vinte e uma horas';
    else if (hour === 22) hourWord = 'vinte e duas horas';
    else hourWord = `${numberToWordsPtBr(hour)} horas`;

    if (min === undefined || min === 0) return hourWord;
    if (min === 30) {
      if (hour === 1) return 'uma hora e meia';
      if (hour === 2) return 'duas horas e meia';
      return `${hourWord} e trinta minutos`;
    }
    if (min === 1) return `${hourWord} e um minuto`;
    return `${hourWord} e ${numberToWordsPtBr(min)} minutos`;
  }

  text = runRule(
    text,
    'ptbr.datetime.time.v1',
    'datetime',
    /\b([0-1]?\d|2[0-3])[hH]([0-5]\d)?(?:min)?\b/,
    (m) => {
      const hour = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : undefined;
      return formatHourMin(hour, min);
    }
  );

  text = runRule(
    text,
    'ptbr.datetime.time.v1',
    'datetime',
    /\b([0-1]?\d|2[0-3]):([0-5]\d)\b/,
    (m) => {
      const hour = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      return formatHourMin(hour, min);
    }
  );

  // 8. Medidas e Grandezas Descoladas (NeMo + TTS-Utils)
  function formatMeasNum(nStr: string): string {
    if (nStr.includes(',')) {
      const [iPart, dPart] = nStr.split(',');
      return `${numberToWordsPtBr(parseInt(iPart, 10))} vírgula ${numberToWordsPtBr(parseInt(dPart, 10))}`;
    }
    return numberToWordsPtBr(parseInt(nStr, 10));
  }

  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*(?:km\/h|Km\/h|kmh)\b/i,
    (m) => `${formatMeasNum(m[1])} quilômetros por hora`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*m\/s\b/i,
    (m) => `${formatMeasNum(m[1])} metros por segundo`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*(?:m²|m2)(?!\w)/i,
    (m) => `${formatMeasNum(m[1])} metros quadrados`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*(?:km²|km2)(?!\w)/i,
    (m) => `${formatMeasNum(m[1])} quilômetros quadrados`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*(?:m³|m3)(?!\w)/i,
    (m) => `${formatMeasNum(m[1])} metros cúbicos`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /(-?\d+(?:,\d+)?)\s*(?:°C|ºC)(?!\w)/i,
    (m) => `${formatMeasNum(m[1])} graus celsius`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /(-?\d+(?:,\d+)?)\s*(?:°F|ºF)(?!\w)/i,
    (m) => `${formatMeasNum(m[1])} graus fahrenheit`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+),(\d+)\s*%/i,
    (m) => `${numberToWordsPtBr(parseInt(m[1], 10))} vírgula ${numberToWordsPtBr(parseInt(m[2], 10))} por cento`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+)\s*%/i,
    (m) => `${numberToWordsPtBr(parseInt(m[1], 10))} por cento`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*(?:kg|Kg|KG)\b/,
    (m) => (m[1] === '1' ? 'um quilo' : `${formatMeasNum(m[1])} quilos`)
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+)\s*g\b(?![²³23a-zA-Z])/,
    (m) => (m[1] === '1' ? 'um grama' : `${numberToWordsPtBr(parseInt(m[1], 10))} gramas`)
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*mg\b/i,
    (m) => (m[1] === '1' ? 'um miligrama' : `${formatMeasNum(m[1])} miligramas`)
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*km\b/i,
    (m) => (m[1] === '1' ? 'um quilômetro' : `${formatMeasNum(m[1])} quilômetros`)
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*cm\b/i,
    (m) => (m[1] === '1' ? 'um centímetro' : `${formatMeasNum(m[1])} centímetros`)
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*mm\b/i,
    (m) => (m[1] === '1' ? 'um milímetro' : `${formatMeasNum(m[1])} milímetros`)
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+)\s*m\b(?![²³23a-zA-Z])/,
    (m) => (m[1] === '1' ? 'um metro' : `${numberToWordsPtBr(parseInt(m[1], 10))} metros`)
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*(?:ml|mL)\b/,
    (m) => (m[1] === '1' ? 'um mililitro' : `${formatMeasNum(m[1])} mililitros`)
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*(?:l|L)\b(?![²³23a-zA-Z])/,
    (m) => (m[1] === '1' ? 'um litro' : `${formatMeasNum(m[1])} litros`)
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+)\s*(?:min|mins)\b/i,
    (m) => (m[1] === '1' ? 'um minuto' : `${numberToWordsPtBr(parseInt(m[1], 10))} minutos`)
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+)\s*(?:seg|segs|s)\b(?![²³23a-zA-Z])/i,
    (m) => (m[1] === '1' ? 'um segundo' : `${numberToWordsPtBr(parseInt(m[1], 10))} segundos`)
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+)\s*dB\b/,
    (m) => `${numberToWordsPtBr(parseInt(m[1], 10))} decibéis`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+)\s*(?:V|v)\b(?![²³23a-zA-Z])/,
    (m) => `${numberToWordsPtBr(parseInt(m[1], 10))} volts`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+)\s*(?:W|w)\b(?![²³23a-zA-Z])/,
    (m) => `${numberToWordsPtBr(parseInt(m[1], 10))} watts`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*(?:GB|Gb|gb)\b/,
    (m) => `${formatMeasNum(m[1])} gigabytes`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+(?:,\d+)?)\s*(?:MB|Mb|mb)\b/,
    (m) => `${formatMeasNum(m[1])} megabytes`
  );

  // 9. Dicionário das 27 UFs Brasileiras em Contexto Geográfico e Institucional (TTS-Utils)
  text = runRule(
    text,
    'ptbr.geo.uf.v1',
    'geo',
    /\bTJ-?([A-Z]{2})\b/,
    (m) => (ESTADOS_BRASILEIROS[m[1]] ? `Tribunal de Justiça de ${ESTADOS_BRASILEIROS[m[1]]}` : m[0])
  );
  text = runRule(
    text,
    'ptbr.geo.uf.v1',
    'geo',
    /\bOAB[\/-]?\s*([A-Z]{2})\b/,
    (m) => (ESTADOS_BRASILEIROS[m[1]] ? `O A B ${ESTADOS_BRASILEIROS[m[1]]}` : m[0])
  );
  text = runRule(
    text,
    'ptbr.geo.uf.v1',
    'geo',
    /([A-ZÀ-Úa-zà-ú\d]+)\s*[\/-]\s*([A-Z]{2})\b/,
    (m) => (ESTADOS_BRASILEIROS[m[2]] ? `${m[1]} - ${ESTADOS_BRASILEIROS[m[2]]}` : m[0])
  );
  text = runRule(
    text,
    'ptbr.geo.uf.v1',
    'geo',
    /\b(em|no|na|de|do|da|para|pelo|pela)\s+([A-Z]{2})\b/,
    (m) => (ESTADOS_BRASILEIROS[m[2]] ? `${m[1]} ${ESTADOS_BRASILEIROS[m[2]]}` : m[0])
  );
  text = runRule(
    text,
    'ptbr.geo.uf.v1',
    'geo',
    /\b(Estado|Governo|governo|capital|interior|comarca)\s+(?:de|do|da)\s+([A-Z]{2})\b/,
    (m) => (ESTADOS_BRASILEIROS[m[2]] ? `${m[1]} de ${ESTADOS_BRASILEIROS[m[2]]}` : m[0])
  );

  // 10. Endereços urbanos e logradouros (TTS-Utils)
  text = runRule(text, 'ptbr.address.logradouro.v1', 'address', /\bAv\.\s+/gi, () => 'Avenida ');
  text = runRule(text, 'ptbr.address.logradouro.v1', 'address', /\bRod\.\s+/gi, () => 'Rodovia ');
  text = runRule(text, 'ptbr.address.logradouro.v1', 'address', /\bEst\.\s+([A-ZÀ-Ú])/g, (m) => `Estrada ${m[1]}`);
  text = runRule(text, 'ptbr.address.logradouro.v1', 'address', /\bAl\.\s+/gi, () => 'Alameda ');
  text = runRule(text, 'ptbr.address.logradouro.v1', 'address', /\b(?:Trav\.|Tv\.)\s+/gi, () => 'Travessa ');
  text = runRule(text, 'ptbr.address.logradouro.v1', 'address', /\b(?:Pça\.|Pc\.)\s+/gi, () => 'Praça ');
  text = runRule(text, 'ptbr.address.logradouro.v1', 'address', /\bCEP\b/, () => 'C E P');
  text = runRule(
    text,
    'ptbr.address.logradouro.v1',
    'address',
    /\b(?:no\.|nº|Nº|num\.)\s*(\d+)/i,
    (m) => `número ${m[1]}`
  );
  text = runRule(
    text,
    'ptbr.address.logradouro.v1',
    'address',
    /\b(?:apto\.|ap\.|apt\.)\s*(\d+)/i,
    (m) => `apartamento ${m[1]}`
  );

  // 11. Artigos de Lei e Parágrafos
  text = runRule(
    text,
    'ptbr.legal.artigo.v1',
    'legal_article',
    /\bArt\.\s*(\d+)(?:[º°ª])?/i,
    (m) => {
      const num = parseInt(m[1], 10);
      if (num <= 10 && ORDINAIS_MASCULINOS[m[1]]) {
        return `Artigo ${ORDINAIS_MASCULINOS[m[1]]}`;
      }
      return `Artigo ${num}`;
    }
  );

  text = runRule(
    text,
    'ptbr.legal.paragraph.v1',
    'legal_article',
    /§\s*único\b/i,
    () => 'Parágrafo único'
  );

  text = runRule(
    text,
    'ptbr.legal.paragraph.v1',
    'legal_article',
    /§\s*(\d+)(?:[º°ª])?/,
    (m) => {
      const num = parseInt(m[1], 10);
      if (num <= 10 && ORDINAIS_MASCULINOS[m[1]]) {
        return `Parágrafo ${ORDINAIS_MASCULINOS[m[1]]}`;
      }
      return `Parágrafo ${num}`;
    }
  );

  // 12. Incisos e Séculos em Algarismos Romanos
  text = runRule(
    text,
    'ptbr.legal.inciso.v1',
    'roman_numeral',
    /\b(?:Inc\.|Inciso)\s*([IVX]+)\b/i,
    (m) => {
      const roman = m[1].toUpperCase();
      return `Inciso ${ROMANOS_INCISOS[roman] || roman}`;
    }
  );

  text = runRule(
    text,
    'ptbr.roman.seculo.v1',
    'roman_numeral',
    /\b(?:Século|Séc\.)\s+([IVX]+)\b/i,
    (m) => {
      const roman = m[1].toUpperCase();
      const spoken = SECULOS_ROMANOS[roman];
      return spoken ? `Século ${spoken}` : m[0];
    }
  );

  text = runRule(
    text,
    'ptbr.history.monarch.v1',
    'roman_numeral',
    /\bD\.\s+Pedro\s+II\b/,
    () => 'Dom Pedro segundo'
  );
  text = runRule(
    text,
    'ptbr.history.monarch.v1',
    'roman_numeral',
    /\bD\.\s+Pedro\s+I\b/,
    () => 'Dom Pedro primeiro'
  );

  // 13. Dicionário de Abreviações: Tratamentos, Corporativas, Jurídicas e Latinas
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bDr\.\s+/, () => 'Doutor ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:Dra\.|Drª)\s+/, () => 'Doutora ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bProf\.\s+/, () => 'Professor ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:Profa\.|Profª)\s+/, () => 'Professora ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bSr\.\s+/, () => 'Senhor ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:Sra\.|Srª)\s+/, () => 'Senhora ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:V\.\s*Sa\.|V\.\s*S\.ª)\s*/gi, () => 'Vossa Senhoria ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:V\.\s*Exa\.|V\.\s*Ex\.ª)\s*/gi, () => 'Vossa Excelência ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:Exmo\.|Exmº)\s+/gi, () => 'Excelentíssimo ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:Exma\.|Exmª)\s+/gi, () => 'Excelentíssima ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:Ilmo\.|Ilmº)\s+/gi, () => 'Ilustríssimo ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:Ilma\.|Ilmª)\s+/gi, () => 'Ilustríssima ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:Eng\.|Engº)\s+/g, () => 'Engenheiro ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bEngª\s+/g, () => 'Engenheira ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:Ltda\.|LTDA)(?!\w)/gi, () => 'Limitada');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:S\/A|S\.A\.)(?!\w)/gi, () => 'Sociedade Anônima');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bCNPJ\b/, () => 'C N P J');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bCPF\b/, () => 'C P F');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bOAB\b/, () => 'O A B');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bSTF\b/, () => 'éssi tê éfe');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bSTJ\b/, () => 'éssi tê jota');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bCLT\b/, () => 'C L T');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bCDC\b/, () => 'Código de Defesa do Consumidor');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bCPC\b/, () => 'Código de Processo Civil');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bCF\/88\b/, () => 'Constituição Federal');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:da|na)\s+CF\b/, (m) => m[0].replace('CF', 'Constituição Federal'));

  // Latinismos e abreviações cotidianas
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\ba\.C\.(?!\w)/gi, () => 'antes de Cristo');
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\bd\.C\.(?!\w)/gi, () => 'depois de Cristo');
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\betc\.(?!\w)/gi, () => 'êti cétera');
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\be\.g\.(?!\w)/gi, () => 'por exemplo');
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\bi\.e\.(?!\w)/gi, () => 'isto é');
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\bvs\.(?!\w)/gi, () => 'versus');
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\bet\s+al\.(?!\w)/gi, () => 'et alii');
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\bp\.\s*ex\./gi, () => 'por exemplo');

  // Siglas gerais fonéticas
  for (const [acronym, phonetic] of Object.entries(KNOWN_ACRONYMS)) {
    const acRegex = new RegExp(`\\b${acronym}\\b`, 'g');
    text = runRule(text, `ptbr.acronym.${acronym.toLowerCase()}.v1`, 'acronym', acRegex, () => phonetic);
  }

  // 14. Decimais numéricos avulsos (ex.: 2,5 -> dois vírgula cinco)
  text = runRule(
    text,
    'ptbr.decimal.v1',
    'decimal',
    /\b(\d+),(\d+)\b/,
    (m) => `${numberToWordsPtBr(parseInt(m[1], 10))} vírgula ${numberToWordsPtBr(parseInt(m[2], 10))}`
  );

  return {
    spokenText: text,
    normalizationMap: mapItems,
    warnings,
  };
}
