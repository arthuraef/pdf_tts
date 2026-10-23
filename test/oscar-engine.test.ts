import test from 'node:test';
import assert from 'node:assert/strict';

import { dehyphenate, applyPtBrLexicon, sanitizeDocumentPages, preReadRepair, repairSeparatedLetters, repairPdfLigatures, normalizeAllCaps } from '../src/oscar-engine/sanitizer/index.ts';
import { VOICE_STYLES, parseTextToActingScores, AUDIOBOOK_PAUSE_SCHEDULE } from '../src/oscar-engine/director/emotionalParser.ts';
import { calculateBionicSpeedMultiplier } from '../src/oscar-engine/director/bionicSpeed.ts';
import { FallbackNativeTts } from '../src/oscar-engine/transport/fallbackNativeTts.ts';
import { OscarEngine } from '../src/oscar-engine/index.ts';
import { splitSentenceUnderLimit, splitIntoSentences, stitchCrossPageChunks } from '../src/core/text-chunker.ts';
import { WebAudioStage } from '../src/oscar-engine/audio-stage/webAudioStage.ts';

// ---------------------------------------------------------------------------
// 1. Sanitizer Tests
// ---------------------------------------------------------------------------
test('TextSanitizer: De-hyphenation should join words broken by line-breaks', () => {
  const input = 'Este é um exem-\nplo de texto quebrado em vá-\nrias linhas.';
  const output = dehyphenate(input);
  assert.equal(output, 'Este é um exemplo de texto quebrado em várias linhas.');
});

test('TextSanitizer: De-hyphenation should heal broken words with spaces around hyphens', () => {
  // Caso real relatado pelo usuário com print do PDF: "deso - lação"
  const input = 'esperança na deso - lação que surgiu no julga - mento da causa inconsti - tucional.';
  const output = dehyphenate(input);
  assert.equal(
    output,
    'esperança na desolação que surgiu no julgamento da causa inconstitucional.'
  );

  // Deve preservar travessões oracionais legítimos seguidos de conectivos
  const clauseInput = 'O projeto - que foi aprovado ontem - seguiu para sanção.';
  const clauseOutput = dehyphenate(clauseInput);
  assert.equal(clauseOutput, 'O projeto - que foi aprovado ontem - seguiu para sanção.');
});

test('TextSanitizer: PT-BR Lexicon expansion', () => {
  const input = 'O Dr. Silva citou o Art. 5º no Século XXI.';
  const output = applyPtBrLexicon(input);
  assert.ok(output.includes('Doutor Silva'));
  assert.ok(output.includes('Artigo quinto'));
  assert.ok(output.includes('Século vinte e um'));
});

test('TextSanitizer: Full page sanitization pipeline', () => {
  const pages = [
    'Cabeçalho do Livro\nCapítulo 1: O Início.\nEste é o con-\nteúdo da página 1.\n1',
    'Cabeçalho do Livro\nContinuação do texto no Dr. Santos.\n2',
    'Cabeçalho do Livro\nFinalização do primeiro capítulo.\n3',
  ];
  const sanitized = sanitizeDocumentPages(pages);
  assert.equal(sanitized.length, 3);
  // Recurring header should be removed
  assert.ok(!sanitized[0].includes('Cabeçalho do Livro'));
  assert.ok(!sanitized[1].includes('Cabeçalho do Livro'));
  // Hyphen removed
  assert.ok(sanitized[0].includes('conteúdo'));
  // Abbreviation expanded
  assert.ok(sanitized[1].includes('Doutor Santos'));
});

// ---------------------------------------------------------------------------
// 2. Emotional Director & Voice Styles Tests
// ---------------------------------------------------------------------------
test('VoiceStyles: All 5 styles must have distinct acoustic parameters', () => {
  const styles = Object.keys(VOICE_STYLES);
  assert.equal(styles.length, 5);

  const rates = styles.map((s) => VOICE_STYLES[s as keyof typeof VOICE_STYLES].rateMultiplier);
  const pitches = styles.map((s) => VOICE_STYLES[s as keyof typeof VOICE_STYLES].pitchMultiplier);
  const pauses = styles.map((s) => VOICE_STYLES[s as keyof typeof VOICE_STYLES].pauseMsMultiplier);

  // Assert all styles are distinct and non-zero
  rates.forEach((r) => assert.ok(r > 0));
  pitches.forEach((p) => assert.ok(p > 0));
  pauses.forEach((m) => assert.ok(m > 0));

  // Dynamic should be faster than Calm
  assert.ok(VOICE_STYLES.dynamic.rateMultiplier > VOICE_STYLES.calm.rateMultiplier);
  // Dramatic should have higher pitch than Calm
  assert.ok(VOICE_STYLES.dramatic.pitchMultiplier > VOICE_STYLES.calm.pitchMultiplier);
});

test('EmotionalParser: Role detection and SSML generation', () => {
  const sentences = [
    'Capítulo 1: A Jornada',
    'Era uma noite escura e fria no castelo.',
    '— Não vá até lá fora! — gritou Mariana.',
    '— Eu não tenho medo algum — respondeu Pedro com firmeza.',
    '(Ele nunca imaginou o que estava prestes a encontrar.)',
  ];

  const chunks = parseTextToActingScores(sentences, {
    docId: 1,
    pageNumber: 1,
    voiceStyle: 'dramatic',
  });

  assert.equal(chunks.length, 5);
  assert.equal(chunks[0].role, 'heading');
  assert.equal(chunks[1].role, 'narrator');
  assert.equal(chunks[2].role, 'character_a'); // Dialogue Mariana
  assert.equal(chunks[3].role, 'character_b'); // Dialogue Pedro
  assert.equal(chunks[4].role, 'aside'); // Parenthetical thought

  // Chunks should contain valid SSML
  assert.ok(chunks[0].ssmlPayload.includes('<speak'));
  assert.ok(chunks[0].ssmlPayload.includes('</speak>'));
});

test('BionicSpeed: Adapts speed to sentence complexity', () => {
  const simpleSentence = 'O gato subiu no muro alto e miou baixo.';
  const complexSentence =
    'A inconstitucionalidade material do dispositivo retroativo fundamentou-se nos princípios hermenêuticos do parágrafo 4º da Lei 14.133.';

  const simpleMult = calculateBionicSpeedMultiplier(simpleSentence);
  const complexMult = calculateBionicSpeedMultiplier(complexSentence);

  // Complex sentence should be read more slowly than simple sentence
  assert.ok(complexMult < simpleMult);
  assert.ok(complexMult < 1.0);
  assert.ok(simpleMult >= 1.0);
});

// ---------------------------------------------------------------------------
// 3. FallbackNativeTts Synthesis Engine Tests
// ---------------------------------------------------------------------------
test('FallbackNativeTts: Voice ranking and Portuguese selection', () => {
  const mockVoices = [
    { name: 'Alex', lang: 'en-US', localService: true, voiceURI: 'alex-en' },
    { name: 'Joana', lang: 'pt-PT', localService: true, voiceURI: 'joana-pt' },
    { name: 'Luciana', lang: 'pt-BR', localService: false, voiceURI: 'luciana-br' },
    { name: 'Microsoft Francisca Online (Natural) - Portuguese (Brazil)', lang: 'pt-BR', localService: false, voiceURI: 'francisca-br' },
    { name: 'Google português do Brasil', lang: 'pt-BR', localService: false, voiceURI: 'google-pt-br' },
  ] as unknown as SpeechSynthesisVoice[];

  // Mock global window & speechSynthesis
  const originalWindow = global.window;
  const originalSpeechSynthesis = (global as unknown as { speechSynthesis?: unknown }).speechSynthesis;

  let spokenUtterance: { text: string; voice?: { voiceURI: string }; lang: string; rate: number; pitch: number } | null = null;
  let cancelCallCount = 0;

  const mockSynth = {
    getVoices: () => mockVoices,
    speak: (u: unknown) => {
      spokenUtterance = u as typeof spokenUtterance;
    },
    cancel: () => {
      cancelCallCount++;
    },
    pause: () => {},
    resume: () => {},
    speaking: false,
    pending: false,
    paused: false,
  };

  (global as unknown as { window: unknown }).window = {
    speechSynthesis: mockSynth,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    setInterval: global.setInterval,
    clearInterval: global.clearInterval,
  };

  (global as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
    text: string;
    voice: unknown;
    lang: string = '';
    rate: number = 1.0;
    pitch: number = 1.0;
    volume: number = 1.0;
    onstart?: () => void;
    onend?: () => void;
    onerror?: (e: unknown) => void;
    onboundary?: (e: unknown) => void;
    constructor(t: string) {
      this.text = t;
    }
  };

  const tts = new FallbackNativeTts();
  assert.ok(tts.isAvailable());

  const ptVoices = tts.getPortugueseVoices();
  assert.equal(ptVoices.length, 4);

  // Top voice should be Google Brasil (Online) per user preference
  assert.equal(ptVoices[0].voiceURI, 'google-pt-br');
  // Second should be Francisca / Natural
  assert.equal(ptVoices[1].voiceURI, 'francisca-br');

  // Test speaking
  tts.speak({
    text: 'Olá mundo!',
    voiceURI: 'google-pt-br',
    rate: 1.1,
    pitch: 1.05,
  });

  // Wait for 60ms for the micro-delay to resolve
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.ok(spokenUtterance !== null);
      assert.equal(spokenUtterance!.text, 'Olá mundo!');
      assert.equal(spokenUtterance!.voice?.voiceURI, 'google-pt-br');
      assert.equal(spokenUtterance!.lang, 'pt-BR');
      assert.equal(spokenUtterance!.rate, 1.1);
      assert.equal(spokenUtterance!.pitch, 1.05);

      // Restore globals
      (global as unknown as { window: unknown }).window = originalWindow;
      (global as unknown as { speechSynthesis?: unknown }).speechSynthesis = originalSpeechSynthesis;
      resolve();
    }, 80);
  });
});

// ---------------------------------------------------------------------------
// 4. OscarEngine Integration Tests
// ---------------------------------------------------------------------------
test('OscarEngine: Document loading, chunk parsing, and voice style switching', () => {
  const engine = new OscarEngine(
    {},
    {
      voiceStyle: 'classic',
      basePlaybackRate: 1.0,
      bionicPacingEnabled: true,
    }
  );

  const rawPages = [
    'Capítulo 1: O Teste.\nEste é um exemplo clássico de audiolivro.',
    'Segunda página do livro com continuação da leitura.',
  ];

  engine.loadDocument(1, rawPages, 0);

  const chunks = engine.getScoreChunks();
  assert.ok(chunks.length >= 2);
  assert.equal(engine.getCurrentIndex(), 0);

  // Switch to dramatic style
  engine.setVoiceStyle('dramatic');
  const dramaticChunks = engine.getScoreChunks();
  assert.equal(engine.getConfig().voiceStyle, 'dramatic');
  assert.ok(dramaticChunks.length >= 2);

  // Test skipSentence
  engine.skipSentence(1);
  assert.equal(engine.getCurrentIndex(), 1);
  engine.skipSentence(-1);
  assert.equal(engine.getCurrentIndex(), 0);

  // Test rate change
  engine.setBasePlaybackRate(1.5);
  assert.equal(engine.getConfig().basePlaybackRate, 1.5);
});

// ---------------------------------------------------------------------------
// 5. Chrome 15s Freeze Protection: splitSentenceUnderLimit Tests
// ---------------------------------------------------------------------------
test('TextChunker: splitSentenceUnderLimit ensures sentences stay strictly under 160 characters', () => {
  const longLegalSentence =
    'Artigo 5º Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade do direito à vida; à liberdade, à igualdade, à segurança e à propriedade, nos termos seguintes: homens e mulheres são iguais em direitos e obrigações.';

  assert.ok(longLegalSentence.length > 160);

  const subClauses = splitSentenceUnderLimit(longLegalSentence, 160);
  assert.ok(subClauses.length >= 2);

  subClauses.forEach((clause: string) => {
    assert.ok(
      clause.length <= 160,
      `Sub-cláusula excede 160 caracteres (${clause.length}): "${clause}"`
    );
  });
});

test('TextChunker: splitIntoSentences chunks naturally without inventing fake dots', () => {
  const samplePdfPage = `
Capítulo Primeiro

A grande jornada começou quando o navio zarpou
do porto ao entardecer. O passageiro pagou R$ 1.500,50 pela cabine.
Você acredita que chegaremos a tempo? perguntou ele com curiosidade.
Sim! Não há motivos para dúvidas... tudo correrá bem.
Ele disse: "Estaremos seguros aqui."

Conclusão da Introdução
  `;

  const chunks = splitIntoSentences(samplePdfPage);

  assert.ok(chunks.length >= 6);

  // Título inicial NÃO deve ter ponto final inventado
  assert.equal(chunks[0], 'Capítulo Primeiro');

  // Frase seguinte com quebra de linha de coluna unida em uma só
  assert.equal(chunks[1], 'A grande jornada começou quando o navio zarpou do porto ao entardecer.');

  // Número decimal não deve quebrar a frase (está no chunk 2)
  assert.equal(chunks[2], 'O passageiro pagou R$ 1.500,50 pela cabine.');

  // Título final NÃO deve ter ponto final inventado
  assert.equal(chunks[chunks.length - 1], 'Conclusão da Introdução');
});

test('TextSanitizer: Pre-reading repair handles separated letters, PDF ligatures and all-caps words', () => {
  // 1. Letras separadas: B RUXA -> Bruxa
  const separatedLetters = 'A B RUXA atirou na floresta. C A P Í T U L O P R I M E I R O';
  const repairedSpaced = repairSeparatedLetters(separatedLetters);
  assert.ok(repairedSpaced.includes('BRUXA'));
  assert.ok(repairedSpaced.includes('CAPÍTULO'));

  // 2. Ligaduras de PDF: %00echa -> flecha
  const ligatureText = 'O guerreiro disparou uma %00echa no %01m da tarde.';
  const repairedLigatures = repairPdfLigatures(ligatureText);
  assert.equal(repairedLigatures, 'O guerreiro disparou uma flecha no fim da tarde.');

  // 3. Palavras todas em maiúsculas normalizadas para pronúncia fluida (sem soletrar siglas)
  const allCapsText = 'DESIGN E MARKETING PARA O LIVRO DA BRUXA E O STF NO BRASIL';
  const normalized = normalizeAllCaps(allCapsText);
  assert.ok(normalized.includes('Design'));
  assert.ok(normalized.includes('Marketing'));
  assert.ok(normalized.includes('Bruxa'));
  // Siglas reais são mantidas
  assert.ok(normalized.includes('STF'));

  // 4. Pipeline completo de pré-leitura
  const rawInput = 'A B RUXA atirou uma %00echa. Leia o E-BOOK de DESIGN e veja no STF.';
  const output = preReadRepair(rawInput);
  assert.ok(output.includes('Bruxa'));
  assert.ok(output.includes('flecha'));
  assert.ok(output.includes('Ebook'));
  assert.ok(output.includes('Design'));
  assert.ok(output.includes('STF'));
});


// ---------------------------------------------------------------------------
// 7. Normalization Provenance & Discursive Segmentation Tests (v4.0 Specification)
// ---------------------------------------------------------------------------
import { sanitizeWithProvenance } from '../src/oscar-engine/sanitizer/normalizationMap.ts';
import { splitDiscursiveUnits, buildChunksFromPages } from '../src/core/text-chunker.ts';

test('NormalizationMap: sanitizeWithProvenance tracks spans, rule IDs, and token classes', () => {
  const input = 'A B RUXA atirou uma %00echa no Art. 5º por R$ 50.';
  const result = sanitizeWithProvenance(input, 1);

  assert.ok(result.spokenText.length > 0);
  assert.ok(result.normalizationMap.length >= 4);

  // 1. OCR Drop-cap / tracking repair
  const ocrRepair = result.normalizationMap.find((m) => m.rule_id === 'ptbr.repair.ocr_tracking.v1');
  assert.ok(ocrRepair, 'Deve registrar ptbr.repair.ocr_tracking.v1');
  assert.equal(ocrRepair.token_class, 'ocr_repair');
  assert.equal(ocrRepair.source_spans[0].page, 1);

  // 2. Ligature repair
  const ligature = result.normalizationMap.find((m) => m.rule_id === 'ptbr.repair.ligature.v1');
  assert.ok(ligature, 'Deve registrar ptbr.repair.ligature.v1');
  assert.equal(ligature.token_class, 'ligature');

  // 3. Legal article verbalization
  const legalArticle = result.normalizationMap.find((m) => m.rule_id === 'ptbr.legal.artigo.v1');
  assert.ok(legalArticle, 'Deve registrar ptbr.legal.artigo.v1');
  assert.equal(legalArticle.token_class, 'legal_article');

  // 4. Currency verbalization
  const currency = result.normalizationMap.find((m) => m.rule_id === 'ptbr.currency.brl.v1');
  assert.ok(currency, 'Deve registrar ptbr.currency.brl.v1');
  assert.equal(currency.token_class, 'currency');

  // Spoken text verification
  assert.ok(result.spokenText.includes('flecha'));
  assert.ok(result.spokenText.includes('Artigo quinto'));
  assert.ok(result.spokenText.includes('cinquenta reais'));
});

test('DiscursiveSegmentation: preserves paragraph context when within budget, falls back hierarchically', () => {
  // Parágrafo curto/médio (<= 450 chars): deve ser mantido como uma única unidade discursiva
  const coherentParagraph = 'O Direito Civil regula as relações privadas. Suas fontes incluem a lei e os costumes. A jurisprudência também orienta os tribunais.';
  const units = splitDiscursiveUnits(coherentParagraph, { maxParagraphChars: 450 });

  assert.equal(units.length, 1);
  assert.equal(units[0].level, 'paragraph');
  assert.equal(units[0].text, coherentParagraph);
  assert.equal(units[0].sourceStart, 0);
  assert.equal(units[0].sourceEnd, coherentParagraph.length);

  // Parágrafo longo (> 100 chars no teste): deve recorrer ao fallback de sentenças
  const unitsSentenceFallback = splitDiscursiveUnits(coherentParagraph, { maxParagraphChars: 80, maxSentenceChars: 150 });
  assert.equal(unitsSentenceFallback.length, 3);
  unitsSentenceFallback.forEach((u) => {
    assert.equal(u.level, 'sentence');
    assert.ok(u.text.endsWith('.'));
  });

  // Título isolado sem ponto final: NUNCA deve inventar ponto final
  const titleText = 'CAPÍTULO PRIMEIRO\n\nEste é o primeiro parágrafo do livro.';
  const titleUnits = splitDiscursiveUnits(titleText, { maxParagraphChars: 300 });
  assert.equal(titleUnits.length, 2);
  assert.equal(titleUnits[0].text, 'CAPÍTULO PRIMEIRO');
  assert.ok(!titleUnits[0].text.endsWith('.'), 'Título não pode receber ponto final falso!');
});

test('DiscursiveSegmentation: buildChunksFromPages assigns source offsets and chunk indices', () => {
  const pages = [
    {
      pageNumber: 1,
      text: 'Introdução ao estudo do Direito.\n\nO artigo primeiro estabelece a personalidade civil.',
    },
    {
      pageNumber: 2,
      text: 'Capítulo 2: Dos Bens Imóveis e Móveis',
    },
  ];

  const chunks = buildChunksFromPages(pages, { maxParagraphChars: 200 });

  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].pageIndex, 0);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.ok(chunks[0].sourceOffsets && chunks[0].sourceOffsets.length > 0);
  assert.equal(chunks[0].sourceOffsets[0].page, 1);

  assert.equal(chunks[2].pageIndex, 1);
  assert.equal(chunks[2].chunkIndex, 2);
  assert.equal(chunks[2].sourceOffsets![0].page, 2);
});

test('OscarEngine: loadDocument sets source offsets on ActingScoreChunks', () => {
  const engine = new OscarEngine();
  const samplePages = [
    'Primeiro parágrafo de introdução.\n\nSegundo parágrafo explicativo da matéria.',
  ];

  engine.loadDocument(42, samplePages);
  const chunks = engine.getScoreChunks();

  assert.ok(chunks.length >= 2);
  assert.ok(chunks[0].sourceOffsets, 'Deve conter sourceOffsets');
  assert.equal(chunks[0].sourceOffsets![0].page, 1);
  assert.ok(typeof chunks[0].sourceOffsets![0].start === 'number');
  assert.ok(typeof chunks[0].sourceOffsets![0].end === 'number');
});


// ---------------------------------------------------------------------------
// 8. NeMo & TTS-Utils Semiotic Normalization Tests (Bloco 1)
// ---------------------------------------------------------------------------
import { numberToWordsPtBr } from '../src/oscar-engine/sanitizer/numberToWords.ts';

test('numberToWordsPtBr: converts integers up to millions with Brazilian grammar', () => {
  assert.equal(numberToWordsPtBr(0), 'zero');
  assert.equal(numberToWordsPtBr(1), 'um');
  assert.equal(numberToWordsPtBr(14), 'quatorze');
  assert.equal(numberToWordsPtBr(21), 'vinte e um');
  assert.equal(numberToWordsPtBr(100), 'cem');
  assert.equal(numberToWordsPtBr(105), 'cento e cinco');
  assert.equal(numberToWordsPtBr(200), 'duzentos');
  assert.equal(numberToWordsPtBr(1000), 'mil');
  assert.equal(numberToWordsPtBr(1500), 'mil e quinhentos');
  assert.equal(numberToWordsPtBr(3200), 'três mil e duzentos');
  assert.equal(numberToWordsPtBr(1000000), 'um milhão');
});

test('Lexicon: converts complex Brazilian currency with thousand separators and cents', () => {
  // TTS-Utils pattern
  const input = 'O valor total foi R$ 3.200,75 com entrada de R$ 1.500,00 e taxa de USD 100.';
  const output = applyPtBrLexicon(input);

  assert.ok(output.includes('três mil e duzentos reais e setenta e cinco centavos'));
  assert.ok(output.includes('mil e quinhentos reais'));
  assert.ok(output.includes('cem dólares'));
});

test('Lexicon: converts dates and times into fluid Portuguese', () => {
  // NeMo + TTS-Utils pattern
  const input = 'Audiência em 23/10/2026 às 14:30 e reunião às 10h.';
  const output = applyPtBrLexicon(input);

  assert.ok(output.includes('vinte e três de outubro de dois mil e vinte e seis'));
  assert.ok(output.includes('quatorze horas e trinta minutos'));
  assert.ok(output.includes('dez horas'));
});

test('Lexicon: converts measures, percentages, and unglues numbers from units', () => {
  // NeMo pattern
  const input = 'Velocidade máxima de 50km/h com carga de 10kg em área de 100m² a 25ºC com taxa de 12,5%.';
  const output = applyPtBrLexicon(input);

  assert.ok(output.includes('cinquenta quilômetros por hora'));
  assert.ok(output.includes('dez quilos'));
  assert.ok(output.includes('cem metros quadrados'));
  assert.ok(output.includes('vinte e cinco graus celsius'));
  assert.ok(output.includes('doze vírgula cinco por cento'));
});

test('Lexicon: expands addresses, Brazilian UFs in context, and Latin abbreviations', () => {
  // TTS-Utils pattern
  const input = 'Escritório na Av. Paulista, nº 1000 - SP. Julgamento vs. réu, etc. Fundado em 500 a.C.';
  const output = applyPtBrLexicon(input);

  assert.ok(output.includes('Avenida Paulista'));
  assert.ok(output.includes('número 1000'));
  assert.ok(output.includes('São Paulo'));
  assert.ok(output.includes('versus'));
  assert.ok(output.includes('êti cétera'));
  assert.ok(output.includes('antes de Cristo'));
});

test('NormalizationMap: tracks provenance for new semiotic classes (currency, measure, datetime, address, geo)', () => {
  const input = 'Processo em 23/10/2026 na Av. Brasil, nº 50 - RJ por R$ 3.200,75 a 80km/h.';
  const result = sanitizeWithProvenance(input, 1);

  assert.ok(result.spokenText.length > 0);

  // Check currency rule
  const currencyItem = result.normalizationMap.find((m) => m.rule_id === 'ptbr.currency.brl.v1');
  assert.ok(currencyItem, 'Deve rastrear ptbr.currency.brl.v1');
  assert.equal(currencyItem.token_class, 'currency');

  // Check datetime rule
  const dateItem = result.normalizationMap.find((m) => m.rule_id === 'ptbr.datetime.date.v1');
  assert.ok(dateItem, 'Deve rastrear ptbr.datetime.date.v1');
  assert.equal(dateItem.token_class, 'datetime');

  // Check measure rule
  const measureItem = result.normalizationMap.find((m) => m.rule_id === 'ptbr.measure.unit.v1');
  assert.ok(measureItem, 'Deve rastrear ptbr.measure.unit.v1');
  assert.equal(measureItem.token_class, 'measure');

  // Check address rule
  const addressItem = result.normalizationMap.find((m) => m.rule_id === 'ptbr.address.logradouro.v1');
  assert.ok(addressItem, 'Deve rastrear ptbr.address.logradouro.v1');
  assert.equal(addressItem.token_class, 'address');

  // Check geo UF rule
  const geoItem = result.normalizationMap.find((m) => m.rule_id === 'ptbr.geo.uf.v1');
  assert.ok(geoItem, 'Deve rastrear ptbr.geo.uf.v1');
  assert.equal(geoItem.token_class, 'geo');
});

// ---------------------------------------------------------------------------
// 9. VoiceStudio Engineering Patterns: Script Stitching & Audiobook Pauses
// ---------------------------------------------------------------------------
test('ScriptStitching: stitchCrossPageChunks heals broken sentences across page boundaries', () => {
  const pages = [
    {
      pageNumber: 1,
      text: 'O magistrado de primeira instância decidiu que',
    },
    {
      pageNumber: 2,
      text: 'o réu deveria cumprir a pena em regime aberto.',
    },
  ];

  const chunks = buildChunksFromPages(pages);

  assert.equal(chunks.length, 1, 'Deve unir em um único chunk');
  assert.equal(
    chunks[0].text,
    'O magistrado de primeira instância decidiu que o réu deveria cumprir a pena em regime aberto.'
  );
  assert.equal(chunks[0].sourceOffsets?.length, 2, 'Deve registrar proveniência de ambas as páginas');
  assert.equal(chunks[0].sourceOffsets![0].page, 1);
  assert.equal(chunks[0].sourceOffsets![1].page, 2);
});

test('ScriptStitching: heals hyphenated words across page boundaries', () => {
  const pages = [
    {
      pageNumber: 1,
      text: 'Durante o processo de homologa-',
    },
    {
      pageNumber: 2,
      text: 'ção do acordo judicial entre as partes.',
    },
  ];

  const chunks = buildChunksFromPages(pages);

  assert.equal(chunks.length, 1);
  assert.ok(chunks[0].text.includes('homologação'));
  assert.equal(chunks[0].sourceOffsets?.length, 2);
});

test('ScriptStitching: stitches only first sentence when page 2 has multiple sentences', () => {
  const pages = [
    {
      pageNumber: 1,
      text: 'A testemunha afirmou sob juramento que',
    },
    {
      pageNumber: 2,
      text: 'não presenciou o ocorrido. O depoimento foi encerrado em seguida.',
    },
  ];

  const chunks = buildChunksFromPages(pages);

  assert.equal(chunks.length, 2, 'Primeira frase costurada + segunda frase independente');
  assert.equal(chunks[0].text, 'A testemunha afirmou sob juramento que não presenciou o ocorrido.');
  assert.equal(chunks[1].text, 'O depoimento foi encerrado em seguida.');
  assert.equal(chunks[0].sourceOffsets?.length, 2);
  assert.equal(chunks[1].sourceOffsets?.length, 1);
  assert.equal(chunks[1].sourceOffsets![0].page, 2);
});

test('ScriptStitching: does NOT stitch when page 1 ends with terminal punctuation or page 2 is heading', () => {
  const pagesPunct = [
    { pageNumber: 1, text: 'A decisão transitou em julgado.' },
    { pageNumber: 2, text: 'A execução terá início na próxima semana.' },
  ];
  const chunksPunct = buildChunksFromPages(pagesPunct);
  assert.equal(chunksPunct.length, 2, 'Não deve costurar se termina com ponto final');

  const pagesHeading = [
    { pageNumber: 1, text: 'Disposições preliminares sobre o tema' },
    { pageNumber: 2, text: 'CAPÍTULO II - DOS PRAZOS' },
  ];
  const chunksHeading = buildChunksFromPages(pagesHeading);
  assert.equal(chunksHeading.length, 2, 'Não deve costurar se a próxima página começa com capítulo');
});

test('AudiobookPauses: deterministic pause schedule applies by role, length and punctuation', () => {
  assert.equal(AUDIOBOOK_PAUSE_SCHEDULE.heading, 900);
  assert.equal(AUDIOBOOK_PAUSE_SCHEDULE.paragraph, 500);
  assert.equal(AUDIOBOOK_PAUSE_SCHEDULE.sentence, 280);
  assert.equal(AUDIOBOOK_PAUSE_SCHEDULE.clause, 140);
  assert.equal(AUDIOBOOK_PAUSE_SCHEDULE.aside, 250);
  assert.equal(AUDIOBOOK_PAUSE_SCHEDULE.suspense, 500);
  assert.equal(AUDIOBOOK_PAUSE_SCHEDULE.urgency, 350);

  const testPhrases = [
    'CAPÍTULO PRIMEIRO', // heading -> 900ms
    'O recurso foi julgado improcedente.', // short sentence -> 280ms
    '— Cuidado, atenção e perigo!', // urgency -> 350ms
    'Pensou em silêncio por um longo instante...', // suspense -> 500ms
    'considerando os termos do relatório,', // clause -> 140ms
    '(observação entre parênteses)', // aside -> 250ms
    'Este parágrafo possui um texto suficientemente extenso para ultrapassar o limite discursivo padrão de cento e oitenta caracteres e, portanto, ao receber o ponto final deve adotar o tempo de pausa característico de parágrafos completos em audiolivros.', // long paragraph -> 500ms
  ];

  const scores = parseTextToActingScores(testPhrases, {
    docId: 10,
    pageNumber: 1,
    voiceStyle: 'classic', // pauseMsMultiplier = 1.0
  });

  assert.equal(scores[0].acoustics.pauseAfterMs, 900);
  assert.equal(scores[1].acoustics.pauseAfterMs, 280);
  assert.equal(scores[2].acoustics.pauseAfterMs, 350);
  assert.equal(scores[3].acoustics.pauseAfterMs, 500);
  assert.equal(scores[4].acoustics.pauseAfterMs, 140);
  assert.equal(scores[5].acoustics.pauseAfterMs, 250);
  assert.equal(scores[6].acoustics.pauseAfterMs, 500);
});

test('WebAudioStage: unlockAudio executes silent buffer to wake mobile hardware', async () => {
  const originalWindow = global.window;
  let bufferCreated = false;
  let sourceStarted = false;

  class MockAudioContext {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    async resume() {
      this.state = 'running';
    }
    createBuffer() {
      bufferCreated = true;
      return {};
    }
    createBufferSource() {
      return {
        buffer: null,
        connect: () => {},
        start: () => {
          sourceStarted = true;
        },
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime: () => {} },
        connect: () => {},
      };
    }
  }

  (global as unknown as { window: unknown }).window = {
    AudioContext: MockAudioContext,
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const stage = new WebAudioStage();
  const result = await stage.unlockAudio();

  assert.equal(result, true);
  assert.equal(bufferCreated, true);
  assert.equal(sourceStarted, true);

  global.window = originalWindow;
});

// ---------------------------------------------------------------------------
// 10. Bloco 4: Metrics & Goldset Benchmark Qualification (NeMo + TTS-Utils)
// ---------------------------------------------------------------------------
import {
  levenshteinDistance,
  calculateCER,
  calculateWER,
  evaluateGoldset,
  PTBR_TTS_GOLDSET,
} from '../src/oscar-engine/evaluation/index.ts';

test('Metrics: levenshteinDistance calculates precise insertion, deletion and substitution cost', () => {
  assert.equal(levenshteinDistance('', ''), 0);
  assert.equal(levenshteinDistance('gato', 'gato'), 0);
  assert.equal(levenshteinDistance('gato', 'jato'), 1); // 1 substituição
  assert.equal(levenshteinDistance('gato', 'gatos'), 1); // 1 inserção
  assert.equal(levenshteinDistance('gato', 'ato'), 1); // 1 remoção
  assert.equal(levenshteinDistance(['o', 'gato'], ['o', 'gato']), 0);
  assert.equal(levenshteinDistance(['o', 'gato'], ['o', 'cachorro']), 1);
});

test('Metrics: calculateCER and calculateWER return 0 on acoustic match and positive on errors', () => {
  // Equivalência fonética ignorando pontuação
  assert.equal(calculateCER('Dez reais.', 'dez reais'), 0);
  assert.equal(calculateWER('Dez reais.', 'dez reais'), 0);

  // Erro de caractere em uma palavra
  const cer = calculateCER('dez reai', 'dez reais');
  assert.ok(cer > 0 && cer < 0.2);

  // Erro de palavra inteira
  const wer = calculateWER('dez dólares', 'dez reais');
  assert.equal(wer, 0.5); // 1 palavra errada de 2
});

test('Goldset: executes full NeMo and TTS-Utils benchmark with 100% accuracy and 0% WER', () => {
  assert.ok(PTBR_TTS_GOLDSET.length >= 20, 'Goldset deve conter pelo menos 20 casos canônicos');

  const report = evaluateGoldset(PTBR_TTS_GOLDSET);

  if (report.failures.length > 0) {
    console.error('Falhas no Goldset:', JSON.stringify(report.failures, null, 2));
  }

  assert.equal(
    report.failedCases,
    0,
    `Todos os casos do goldset devem passar (Falhas: ${report.failures.map((f) => f.id).join(', ')})`
  );
  assert.equal(report.accuracyPct, 100.0);
  assert.equal(report.meanCER, 0);
  assert.equal(report.meanWER, 0);
});

// ---------------------------------------------------------------------------
// 9. VoiceStudio Enhancer Tests
// ---------------------------------------------------------------------------
import { VOICESTUDIO_PRESETS } from '../src/oscar-engine/types.ts';

test('VoiceStudio: Presets are correctly defined with acoustic sweet-spots', () => {
  const warm = VOICESTUDIO_PRESETS.warm_audiobook;
  assert.ok(warm);
  assert.equal(warm.config.pitchShift, -0.03);
  assert.equal(warm.config.pacingMultiplier, 1.05);
  assert.equal(warm.config.breathInjection, true);

  const broadcast = VOICESTUDIO_PRESETS.broadcast_hd;
  assert.ok(broadcast);
  assert.equal(broadcast.config.pitchShift, 0.0);
  assert.equal(broadcast.config.pacingMultiplier, 0.9);

  const soft = VOICESTUDIO_PRESETS.soft_intimate;
  assert.ok(soft);
  assert.equal(soft.config.pitchShift, -0.04);
  assert.equal(soft.config.pacingMultiplier, 1.2);

  const crisp = VOICESTUDIO_PRESETS.crisp_fast;
  assert.ok(crisp);
  assert.equal(crisp.config.pitchShift, 0.02);
  assert.equal(crisp.config.pacingMultiplier, 0.75);
});

test('VoiceStudio: OscarEngine manages VoiceStudioConfig state and live preview without error', () => {
  const engine = new OscarEngine();
  const initialConfig = engine.getVoiceStudioConfig();
  assert.equal(initialConfig.preset, 'warm_audiobook');
  assert.equal(initialConfig.enabled, true);

  engine.setVoiceStudioConfig({
    preset: 'broadcast_hd',
    pitchShift: 0.0,
    pacingMultiplier: 0.9,
    breathInjection: false,
  });

  const updatedConfig = engine.getVoiceStudioConfig();
  assert.equal(updatedConfig.preset, 'broadcast_hd');
  assert.equal(updatedConfig.breathInjection, false);

  // Preview should run safely even in Node / test environment (fallback mock)
  assert.doesNotThrow(() => {
    engine.previewVoiceStudio('Teste de voz em estúdio');
  });
});

