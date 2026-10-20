import type { NormalizationMapItem, TokenClass } from '../types';
import { KNOWN_ACRONYMS } from './textErrorRepair';

export interface SanitizationResult {
  spokenText: string;
  normalizationMap: NormalizationMapItem[];
  warnings: string[];
}

const ORDINAIS_MASCULINOS: Record<string, string> = {
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

const ROMANOS_INCISOS: Record<string, string> = {
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

/**
 * Aplica um conjunto ordenado de regras de normalização, mantendo a proveniência exata
 * dos spans UTF-16 em relação ao texto original e ao texto falado gerado.
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
    const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');

    let match: RegExpExecArray | null;
    while ((match = globalRegex.exec(currentText)) !== null) {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;

      // Adiciona o texto entre a última correspondência e o match atual
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

  // Títulos com tracking ("C A P Í T U L O" -> "CAPÍTULO")
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
        return word; // Preserva sigla
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

  // 6. Artigos de Lei (Art. 1º até Art. 10º -> Artigo ordinal, 11+ -> cardinal)
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

  // Abreviações de tratamento (Dr., Dra., Prof., Profa.)
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bDr\.\s+/, () => 'Doutor ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bDra\.\s+/, () => 'Doutora ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bProf\.\s+/, () => 'Professor ');
  text = runRule(text, 'ptbr.lexicon.abbrev.v1', 'abbreviation', /\bProfa\.\s+/, () => 'Professora ');

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

  // Moedas (R$ 10,50 -> 10 reais e 50 centavos; R$ 100 -> 100 reais)
  text = runRule(
    text,
    'ptbr.currency.brl.v1',
    'currency',
    /R\$\s*(\d+),(\d{2})/,
    (m) => `${m[1]} reais e ${m[2]} centavos`
  );
  text = runRule(
    text,
    'ptbr.currency.brl.v1',
    'currency',
    /R\$\s*(\d+)/,
    (m) => `${m[1]} reais`
  );

  return {
    spokenText: text,
    normalizationMap: mapItems,
    warnings,
  };
}
