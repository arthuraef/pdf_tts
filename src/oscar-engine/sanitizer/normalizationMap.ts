import type { NormalizationMapItem, TokenClass } from '../types';
import { KNOWN_ACRONYMS } from './textErrorRepair';
import { numberToWordsPtBr } from './numberToWords';
import {
  ORDINAIS_MASCULINOS,
  ROMANOS_INCISOS,
  ESTADOS_BRASILEIROS,
} from './ptBrLexicon';

export interface SanitizationResult {
  spokenText: string;
  normalizationMap: NormalizationMapItem[];
  warnings: string[];
}

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

  // 1. Reparo de ligaduras de PDF corrompidas (%00echa -> flecha)
  text = runRule(
    text,
    'ptbr.repair.ligature.v1',
    'ligature',
    /%00echa\b/gi,
    (m) => (m[0] === m[0].toUpperCase() ? 'FLECHA' : 'flecha')
  );

  text = runRule(
    text,
    'ptbr.repair.ligature.v1',
    'ligature',
    /%00([a-zà-ú]+)/gi,
    (m) => {
      const rest = m[1];
      const isUpper = rest === rest.toUpperCase();
      const isTitle = rest[0] === rest[0].toUpperCase();
      const prefix = isUpper ? 'FL' : isTitle ? 'Fl' : 'fl';
      return prefix + rest;
    }
  );

  text = runRule(
    text,
    'ptbr.repair.ligature.v1',
    'ligature',
    /%01([a-zà-ú]+)/gi,
    (m) => {
      const rest = m[1];
      const isUpper = rest === rest.toUpperCase();
      const isTitle = rest[0] === rest[0].toUpperCase();
      const prefix = isUpper ? 'FI' : isTitle ? 'Fi' : 'fi';
      return prefix + rest;
    }
  );

  // Ligaduras Unicode padrão (\uFB00..\uFB04)
  text = runRule(text, 'ptbr.repair.unicode_ligature.v1', 'ligature', /\uFB00/g, () => 'ff');
  text = runRule(text, 'ptbr.repair.unicode_ligature.v1', 'ligature', /\uFB01/g, () => 'fi');
  text = runRule(text, 'ptbr.repair.unicode_ligature.v1', 'ligature', /\uFB02/g, () => 'fl');
  text = runRule(text, 'ptbr.repair.unicode_ligature.v1', 'ligature', /\uFB03/g, () => 'ffi');
  text = runRule(text, 'ptbr.repair.unicode_ligature.v1', 'ligature', /\uFB04/g, () => 'ffl');

  // Caracteres nulos
  text = runRule(text, 'ptbr.repair.null_char.v1', 'ocr_repair', /[\u0000\x00]/g, () => '');

  // 2. Reparo de letras separadas (Drop-caps descoladas e tracking: "B RUXA" -> "BRUXA")
  const NON_WORD_LETTERS = '[BCDFGHJKLMNPQRSTVWXYZ]';
  text = runRule(
    text,
    'ptbr.repair.ocr_tracking.v1',
    'ocr_repair',
    new RegExp(`\\b(${NON_WORD_LETTERS})\\s+([A-ZÀ-Úa-zà-ú]{2,})\\b`),
    (m) => `${m[1]}${m[2]}`
  );

  text = runRule(
    text,
    'ptbr.repair.ocr_tracking.v1',
    'ocr_repair',
    /\b([A-ZÀ-Ú](?:\s[A-ZÀ-Ú]){2,})\b/,
    (m) => m[0].replace(/\s+/g, '')
  );

  // 3. Normalização de estrangeirismos compostos com hífen
  text = runRule(
    text,
    'ptbr.lexicon.loanword.v1',
    'loanword',
    /\be-books?\b/gi,
    (m) => (m[0][0] === 'E' ? 'Ebook' : 'ebook')
  );
  text = runRule(
    text,
    'ptbr.lexicon.loanword.v1',
    'loanword',
    /\be-mails?\b/gi,
    (m) => (m[0][0] === 'E' ? 'Email' : 'email')
  );
  text = runRule(text, 'ptbr.lexicon.loanword.v1', 'loanword', /\bwi-fi\b/gi, () => 'wifi');
  text = runRule(text, 'ptbr.lexicon.loanword.v1', 'loanword', /\bcheck-in\b/gi, () => 'checkin');
  text = runRule(text, 'ptbr.lexicon.loanword.v1', 'loanword', /\bcheck-out\b/gi, () => 'checkout');

  // 4. Normalização de palavras inteiras em maiúsculas (evita soletração como sigla)
  text = runRule(
    text,
    'ptbr.casing.all_caps.v1',
    'all_caps',
    /\b[A-ZÀ-Ú]{2,}\b/,
    (m) => {
      const word = m[0];
      if (KNOWN_ACRONYMS.has(word)) {
        return word; // Preserva sigla legítima
      }
      return word.charAt(0) + word.slice(1).toLowerCase();
    }
  );

  // 5. De-hifenização de quebras de linha
  text = runRule(
    text,
    'ptbr.layout.dehyphenate.v1',
    'ocr_repair',
    /(?<=[a-zA-ZÀ-ÿ])-[\r\n\s]+(?=[a-zA-ZÀ-ÿ])/,
    () => ''
  );

  // 6. Moeda brasileira com separador de milhar e centavos (TTS-Utils)
  text = runRule(
    text,
    'ptbr.currency.brl.v1',
    'currency',
    /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)/,
    (m) => {
      const rawNum = m[1];
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
        const currWord = inteiro === 1 ? 'real' : 'reais';
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
      return parts.join(' ') || 'zero reais';
    }
  );

  // Moeda USD
  text = runRule(
    text,
    'ptbr.currency.usd.v1',
    'currency',
    /(?:USD|U\$)\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)/,
    (m) => {
      const rawNum = m[1];
      const inteiro = parseInt(rawNum.replace(/\./g, '').split(',')[0], 10) || 0;
      const wordInt = numberToWordsPtBr(inteiro);
      return `${wordInt} dólares`;
    }
  );

  // 7. Datas completas (NeMo & TTS-Utils)
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

  // 8. Horários (NeMo & TTS-Utils)
  text = runRule(
    text,
    'ptbr.datetime.time.v1',
    'datetime',
    /\b([0-1]?\d|2[0-3])h([0-5]\d)?(?:min)?\b/i,
    (m) => {
      const hour = parseInt(m[1], 10);
      const hourWord = hour === 1 ? 'uma hora' : `${numberToWordsPtBr(hour)} horas`;
      if (m[2]) {
        const min = parseInt(m[2], 10);
        if (min > 0) {
          const minWord = min === 1 ? 'um minuto' : `${numberToWordsPtBr(min)} minutos`;
          return `${hourWord} e ${minWord}`;
        }
      }
      return hourWord;
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
      const hourWord = hour === 1 ? 'uma hora' : `${numberToWordsPtBr(hour)} horas`;
      if (min === 0) {
        return hourWord;
      }
      return `${hourWord} e ${numberToWordsPtBr(min)} minutos`;
    }
  );

  // 9. Medidas e Grandezas (NeMo + TTS-Utils)
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+)\s*(?:km\/h|Km\/h)\b/i,
    (m) => `${numberToWordsPtBr(parseInt(m[1], 10))} quilômetros por hora`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+)\s*m²(?!\w)/i,
    (m) => `${numberToWordsPtBr(parseInt(m[1], 10))} metros quadrados`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+)\s*(?:°C|ºC)(?!\w)/i,
    (m) => `${numberToWordsPtBr(parseInt(m[1], 10))} graus celsius`
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
    /\b(\d+)\s*kg\b/i,
    (m) => `${numberToWordsPtBr(parseInt(m[1], 10))} quilos`
  );
  text = runRule(
    text,
    'ptbr.measure.unit.v1',
    'measure',
    /\b(\d+)\s*km\b/i,
    (m) => `${numberToWordsPtBr(parseInt(m[1], 10))} quilômetros`
  );

  // 10. UFs brasileiras em contexto geográfico (TTS-Utils)
  text = runRule(
    text,
    'ptbr.geo.uf.v1',
    'geo',
    /([A-ZÀ-Úa-zà-ú\d]+)\s*[\/-]\s*([A-Z]{2})\b/,
    (m) => {
      const prefix = m[1];
      const uf = m[2];
      if (ESTADOS_BRASILEIROS[uf]) {
        return `${prefix}, ${ESTADOS_BRASILEIROS[uf]}`;
      }
      return m[0];
    }
  );

  text = runRule(
    text,
    'ptbr.geo.uf.v1',
    'geo',
    /\b(em|no|na|de|do|da|para)\s+([A-Z]{2})\b/,
    (m) => {
      const prep = m[1];
      const uf = m[2];
      if (ESTADOS_BRASILEIROS[uf]) {
        return `${prep} ${ESTADOS_BRASILEIROS[uf]}`;
      }
      return m[0];
    }
  );

  // 11. Endereços urbanos (TTS-Utils)
  text = runRule(text, 'ptbr.address.logradouro.v1', 'address', /\bAv\.\s+/gi, () => 'Avenida ');
  text = runRule(text, 'ptbr.address.logradouro.v1', 'address', /\bRod\.\s+/gi, () => 'Rodovia ');
  text = runRule(text, 'ptbr.address.logradouro.v1', 'address', /\bAl\.\s+/gi, () => 'Alameda ');
  text = runRule(text, 'ptbr.address.logradouro.v1', 'address', /\bTrav\.\s+/gi, () => 'Travessa ');
  text = runRule(
    text,
    'ptbr.address.logradouro.v1',
    'address',
    /\b(?:no\.|nº|Nº)\s*(\d+)/gi,
    (m) => `número ${m[1]}`
  );

  // 12. Artigos de Lei (Art. 1º até Art. 10º -> Artigo ordinal, 11+ -> cardinal)
  text = runRule(
    text,
    'ptbr.legal.artigo.v1',
    'legal_article',
    /\bArt\.\s*(\d+)(?:[º°ª])?/gi,
    (m) => {
      const numStr = m[1];
      const num = parseInt(numStr, 10);
      if (num <= 10 && ORDINAIS_MASCULINOS[numStr]) {
        return `Artigo ${ORDINAIS_MASCULINOS[numStr]}`;
      }
      return `Artigo ${num}`;
    }
  );

  // Parágrafos Legais (§ 1º, § único)
  text = runRule(
    text,
    'ptbr.legal.paragrafo.v1',
    'legal_article',
    /§\s*único\b/gi,
    () => 'Parágrafo único'
  );
  text = runRule(
    text,
    'ptbr.legal.paragrafo.v1',
    'legal_article',
    /§\s*(\d+)(?:[º°ª])?/,
    (m) => {
      const numStr = m[1];
      const num = parseInt(numStr, 10);
      if (num <= 10 && ORDINAIS_MASCULINOS[numStr]) {
        return `Parágrafo ${ORDINAIS_MASCULINOS[numStr]}`;
      }
      return `Parágrafo ${num}`;
    }
  );

  // Incisos com algarismos romanos: Inc. IV ou Inciso IV
  text = runRule(
    text,
    'ptbr.legal.inciso.v1',
    'legal_article',
    /\b(?:Inc\.|Inciso)\s*([IVX]+)\b/gi,
    (m) => {
      const roman = m[1].toUpperCase();
      const spoken = ROMANOS_INCISOS[roman] || roman;
      return `Inciso ${spoken}`;
    }
  );

  // Séculos com algarismos romanos
  text = runRule(
    text,
    'ptbr.roman.seculo.v1',
    'roman_numeral',
    /\b(?:Século|Séc\.)\s+XXI\b/gi,
    () => 'Século vinte e um'
  );
  text = runRule(
    text,
    'ptbr.roman.seculo.v1',
    'roman_numeral',
    /\b(?:Século|Séc\.)\s+XX\b/gi,
    () => 'Século vinte'
  );
  text = runRule(
    text,
    'ptbr.roman.seculo.v1',
    'roman_numeral',
    /\b(?:Século|Séc\.)\s+XIX\b/gi,
    () => 'Século dezenove'
  );

  // Reis e Papas (D. Pedro II)
  text = runRule(
    text,
    'ptbr.roman.monarch.v1',
    'roman_numeral',
    /\bD\.\s+Pedro\s+II\b/,
    () => 'Dom Pedro segundo'
  );
  text = runRule(
    text,
    'ptbr.roman.monarch.v1',
    'roman_numeral',
    /\bD\.\s+Pedro\s+I\b/,
    () => 'Dom Pedro primeiro'
  );

  // Abreviações de tratamento (Dr., Dra., Prof., Profa., Srª)
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bDr\.\s+/, () => 'Doutor ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bDra\.\s+/, () => 'Doutora ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bProf\.\s+/, () => 'Professor ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:Profa\.|Profª)\s+/g, () => 'Professora ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bSr\.\s+/, () => 'Senhor ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\b(?:Sra\.|Srª)\s+/g, () => 'Senhora ');

  // Latinismos e expressões cronológicas
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\ba\.C\.(?!\w)/gi, () => 'antes de Cristo');
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\bd\.C\.(?!\w)/gi, () => 'depois de Cristo');
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\betc\.(?!\w)/gi, () => 'êti cétera');
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\be\.g\.(?!\w)/gi, () => 'por exemplo');
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\bi\.e\.(?!\w)/gi, () => 'isto é');
  text = runRule(text, 'ptbr.lexicon.latin.v1', 'abbreviation', /\bvs\.(?!\w)/gi, () => 'versus');

  // Abreviações bibliográficas
  text = runRule(
    text,
    'ptbr.lexicon.citation.v1',
    'abbreviation',
    /\bpágs?\.\s*(\d+)/gi,
    (m) => `página ${m[1]}`
  );
  text = runRule(
    text,
    'ptbr.lexicon.citation.v1',
    'abbreviation',
    /\bcap\.\s*(\d+)/gi,
    (m) => `capítulo ${m[1]}`
  );

  // Decimais avulsos (ex: 2,5 -> dois vírgula cinco)
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
