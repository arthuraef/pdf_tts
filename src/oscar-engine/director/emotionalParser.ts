/**
 * Diretor de Atuação & Gerador de Partitura Emocional (emotionalParser.ts)
 * Transforma texto higienizado em ActingScoreChunk com metadados de atuação,
 * prosódia SSML, separação de papéis, estilos de narração e velocidade inteligente.
 */

import type {
  ActingScoreChunk,
  SpeakerRole,
  AcousticProfile,
  VoiceStyle,
  VoiceStyleDefinition,
  SourceSpan,
} from '../types';
import { calculateBionicSpeedMultiplier } from './bionicSpeed';
import { castMemory } from './castMemory';
import { buildSSML } from './ssmlBuilder';

export const VOICE_STYLES: Record<VoiceStyle, VoiceStyleDefinition> = {
  classic: {
    id: 'classic',
    label: 'Narrador',
    emoji: '📖',
    description: 'Leitura sóbria, cadenciada e equilibrada no estilo audiolivro tradicional.',
    pitchMultiplier: 1.0,
    pauseMsMultiplier: 1.0,
    rateMultiplier: 1.0,
    breathEnabled: false,
  },
  dramatic: {
    id: 'dramatic',
    label: 'Dramático',
    emoji: '🎭',
    description: 'Atuação expressiva com cadência envolvente.',
    pitchMultiplier: 1.04,
    pauseMsMultiplier: 1.15,
    rateMultiplier: 0.96,
    breathEnabled: false,
  },
  didactic: {
    id: 'didactic',
    label: 'Didático',
    emoji: '🎓',
    description: 'Dicção firme e pausada para estudo.',
    pitchMultiplier: 0.98,
    pauseMsMultiplier: 0.95,
    rateMultiplier: 1.02,
    breathEnabled: false,
  },
  dynamic: {
    id: 'dynamic',
    label: 'Dinâmico',
    emoji: '⚡',
    description: 'Velocidade acelerada e transições ágeis para audição eficiente.',
    pitchMultiplier: 1.02,
    pauseMsMultiplier: 0.8,
    rateMultiplier: 1.12,
    breathEnabled: false,
  },
  calm: {
    id: 'calm',
    label: 'Calmo',
    emoji: '🧘',
    description: 'Ritmo suave e voz macia, agradável para descanso e concentração.',
    pitchMultiplier: 0.96,
    pauseMsMultiplier: 1.15,
    rateMultiplier: 0.95,
    breathEnabled: false,
  },
};

export const USER_VOICE_STYLES: VoiceStyle[] = ['classic', 'dynamic', 'calm'];

/**
 * Cronograma determinístico de pausas para audiolivro (VoiceStudio silence schedule).
 * Padroniza os silêncios de acordo com a hierarquia semântica e pontuação.
 */
export const AUDIOBOOK_PAUSE_SCHEDULE = {
  heading: 900,      // Pausa longa de transição de capítulo / título
  paragraph: 500,    // Término de parágrafo / bloco semântico discursivo
  sentence: 280,     // Ponto final padrão (. ? !)
  clause: 140,       // Cláusula / vírgula / dois-pontos / ponto e vírgula / travessão (; : — ,)
  aside: 250,        // Aparte ou texto entre parênteses
  suspense: 500,     // Reticências (...)
  urgency: 350,      // Exclamação dramática (!)
};

export interface ParseOptions {
  docId: number;
  pageNumber: number;
  voiceStyle?: VoiceStyle;
  primaryVoice?: string;   // Padrão narrador
  secondaryVoice?: string; // Padrão personagem
  bionicEnabled?: boolean;
}

export interface ActingChunkInput {
  text: string;
  rawText?: string;
  pageNumber?: number;
  chunkIndex?: number;
  sourceOffsets?: SourceSpan[];
}

/**
 * Transforma uma lista de descritores de chunks em ActingScoreChunks com metadados
 * de atuação, áudio espacial e cronograma determinístico de pausas.
 */
export function parseChunksToActingScores(
  inputs: ActingChunkInput[],
  options: ParseOptions
): ActingScoreChunk[] {
  const {
    docId,
    pageNumber,
    voiceStyle = 'classic',
    primaryVoice = 'pt-BR-FranciscaNeural',
    secondaryVoice = 'pt-BR-AntonioNeural',
    bionicEnabled = true,
  } = options;

  const currentStyle = VOICE_STYLES[voiceStyle] || VOICE_STYLES.classic;
  let dialogueToggle = false;

  return inputs.map((input, index) => {
    const rawText = input.rawText ?? input.text;
    const cleanText = input.text.trim();
    const chunkIndex = input.chunkIndex ?? index;
    const chunkPage = input.pageNumber ?? pageNumber;
    const id = `${docId}_p${chunkPage}_c${chunkIndex}`;

    // 1. Detecta o papel da fala (role)
    let role: SpeakerRole = 'narrator';
    let voiceId = primaryVoice;
    let spatialPan = 0; // Narrador no centro

    // É título de capítulo?
    if (
      /^(?:Cap[ií]tulo|Se[cç][aã]o|Parte|Livro)\s+[\dIVX]+/i.test(cleanText) ||
      (cleanText === cleanText.toUpperCase() && cleanText.length < 50 && !cleanText.includes('.'))
    ) {
      role = 'heading';
      voiceId = primaryVoice;
      spatialPan = 0;
    }
    // É diálogo (travessão ou aspas)?
    else if (/^[—–\-"]/.test(cleanText) || cleanText.startsWith('“')) {
      const charName = castMemory.detectCharacterName(cleanText);
      if (charName) {
        const profile = castMemory.getOrAssignProfile(charName);
        role = profile.gender === 'female' ? 'character_a' : 'character_b';
        voiceId = profile.voiceId;
        spatialPan = profile.spatialPan;
      } else {
        // Alternância automática de diálogo sem nome explícito
        dialogueToggle = !dialogueToggle;
        role = dialogueToggle ? 'character_a' : 'character_b';
        voiceId = dialogueToggle ? secondaryVoice : primaryVoice;
        spatialPan = dialogueToggle ? -0.25 : 0.25;
      }
    }
    // É texto explicativo entre parênteses?
    else if (cleanText.startsWith('(') && cleanText.endsWith(')')) {
      role = 'aside';
      voiceId = primaryVoice;
      spatialPan = 0;
    }

    // 2. Modulação Emocional de Prosódia & Acústica
    const rawBionic = bionicEnabled ? calculateBionicSpeedMultiplier(cleanText) : 1.0;
    const effectiveBionic = parseFloat(rawBionic.toFixed(2));

    let basePause = AUDIOBOOK_PAUSE_SCHEDULE.sentence;
    let pitchStr = '+0Hz';
    let rateStr = '+0%';
    let shouldBreath = false;

    if (role === 'heading') {
      pitchStr = '-3%';
      rateStr = '-5%';
      basePause = AUDIOBOOK_PAUSE_SCHEDULE.heading;
      shouldBreath = false;
    } else if (role === 'aside') {
      pitchStr = '-2%';
      rateStr = '+5%';
      basePause = AUDIOBOOK_PAUSE_SCHEDULE.aside;
    } else {
      // Reticências ou calmaria / suspense
      if (
        cleanText.endsWith('...') ||
        cleanText.endsWith('…') ||
        /\b(?:sussurrou|silêncio|triste|calma|pensou)\b/i.test(cleanText)
      ) {
        pitchStr = '-3%';
        rateStr = '-5%';
        basePause = AUDIOBOOK_PAUSE_SCHEDULE.suspense;
      }
      // Exclamação ou urgência
      else if (
        cleanText.endsWith('!') ||
        /\b(?:gritou|socorro|correu|depressa|perigo|rápido|fogo)\b/i.test(cleanText)
      ) {
        pitchStr = voiceStyle === 'dramatic' ? '+4%' : '+2%';
        rateStr = '+5%';
        shouldBreath = false;
        basePause = AUDIOBOOK_PAUSE_SCHEDULE.urgency;
      }
      // Fim de oração / cláusula com pontuação secundária (; : — ,)
      else if (/[;:,—–]\s*$/.test(cleanText)) {
        basePause = AUDIOBOOK_PAUSE_SCHEDULE.clause;
      }
      // Sentença com pontuação final (. ?)
      else if (/[.?]["'”»)]*\s*$/.test(cleanText)) {
        // Se a unidade discursiva for longa (> 180 chars), ritmo de parágrafo
        basePause =
          cleanText.length > 180
            ? AUDIOBOOK_PAUSE_SCHEDULE.paragraph
            : AUDIOBOOK_PAUSE_SCHEDULE.sentence;
      }
      // Fragmento sem pontuação terminal
      else {
        basePause = AUDIOBOOK_PAUSE_SCHEDULE.clause;
      }
    }

    const acoustics: AcousticProfile = {
      spatialPan,
      injectBreathBefore: shouldBreath,
      bionicSpeedMultiplier: effectiveBionic,
      pauseAfterMs: Math.round(basePause * currentStyle.pauseMsMultiplier),
      pitchAdjust: pitchStr,
      rateAdjust: rateStr,
    };

    // 3. Monta o payload SSML final
    const ssmlPayload = buildSSML({
      text: cleanText,
      voiceId,
      rate: acoustics.rateAdjust,
      pitch: acoustics.pitchAdjust,
    });

    return {
      id,
      pageNumber: chunkPage,
      chunkIndex,
      rawText,
      cleanText,
      ssmlPayload,
      role,
      voiceId,
      acoustics,
      sourceOffsets: input.sourceOffsets,
    };
  });
}

export function parseTextToActingScores(
  chunksText: string[],
  options: ParseOptions
): ActingScoreChunk[] {
  const inputs: ActingChunkInput[] = chunksText.map((text, idx) => ({
    text,
    rawText: text,
    pageNumber: options.pageNumber,
    chunkIndex: idx,
  }));
  return parseChunksToActingScores(inputs, options);
}
