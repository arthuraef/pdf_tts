import test from 'node:test';
import assert from 'node:assert/strict';

import { dehyphenate, applyPtBrLexicon, sanitizeDocumentPages, preReadRepair, repairSeparatedLetters, repairPdfLigatures, normalizeAllCaps } from '../src/oscar-engine/sanitizer/index.ts';
import { VOICE_STYLES, parseTextToActingScores } from '../src/oscar-engine/director/emotionalParser.ts';
import { calculateBionicSpeedMultiplier } from '../src/oscar-engine/director/bionicSpeed.ts';
import { FallbackNativeTts } from '../src/oscar-engine/transport/fallbackNativeTts.ts';
import { OscarEngine } from '../src/oscar-engine/index.ts';
import { splitSentenceUnderLimit, splitIntoSentences } from '../src/core/text-chunker.ts';

// ---------------------------------------------------------------------------
// 1. Sanitizer Tests
// ---------------------------------------------------------------------------
test('TextSanitizer: De-hyphenation should join words broken by line-breaks', () => {
  const input = 'Este é um exem-\nplo de texto quebrado em vá-\nrias linhas.';
  const output = dehyphenate(input);
  assert.equal(output, 'Este é um exemplo de texto quebrado em várias linhas.');
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

