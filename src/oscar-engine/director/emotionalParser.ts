/**
 * Diretor de Atuação & Gerador de Partitura Emocional (emotionalParser.ts)
 * Transforma texto higienizado em ActingScoreChunk com metadados de atuação,
 * prosódia SSML, separação de papéis, estilos de narração e velocidade inteligente.
 */

import type { ActingScoreChunk, SpeakerRole, AcousticProfile, VoiceStyle, VoiceStyleDefinition } from '../types';
import { calculateBionicSpeedMultiplier } from './bionicSpeed';
import { castMemory } from './castMemory';
import { buildSSML } from './ssmlBuilder';

export const VOICE_STYLES: Record<VoiceStyle, VoiceStyleDefinition> = {
  classic: {
    id: 'classic',
    label: 'Narrador Clássico',
    emoji: '📖',
    description: 'Leitura sóbria, cadenciada e equilibrada no estilo audiolivro tradicional.',
    pitchMultiplier: 1.0,
    pauseMsMultiplier: 1.0,
    rateMultiplier: 1.0,
    breathEnabled: false,
  },
  dramatic: {
    id: 'dramatic',
    label: 'Dramático & Expressivo',
    emoji: '🎭',
    description: 'Atuação teatral expressiva com cadência envolvente sem distorção.',
    pitchMultiplier: 1.04,
    pauseMsMultiplier: 1.15,
    rateMultiplier: 0.96,
    breathEnabled: false,
  },
  didactic: {
    id: 'didactic',
    label: 'Concurso & Didático',
    emoji: '🎓',
    description: 'Dicção firme, pausada e focada para memorização de leis e apostilas.',
    pitchMultiplier: 0.98,
    pauseMsMultiplier: 0.95,
    rateMultiplier: 1.02,
    breathEnabled: false,
  },
  dynamic: {
    id: 'dynamic',
    label: 'Dinâmico & Bionic Flow',
    emoji: '⚡',
    description: 'Velocidade acelerada e transições ágeis para audição eficiente.',
    pitchMultiplier: 1.02,
    pauseMsMultiplier: 0.8,
    rateMultiplier: 1.12,
    breathEnabled: false,
  },
  calm: {
    id: 'calm',
    label: 'Calmo & Noturno',
    emoji: '🧘',
    description: 'Ritmo suave e voz macia, agradável para descanso e concentração.',
    pitchMultiplier: 0.96,
    pauseMsMultiplier: 1.15,
    rateMultiplier: 0.95,
    breathEnabled: false,
  },
};

export interface ParseOptions {
  docId: number;
  pageNumber: number;
  voiceStyle?: VoiceStyle;
  primaryVoice?: string;   // Padrão narrador
  secondaryVoice?: string; // Padrão personagem
  bionicEnabled?: boolean;
}

export function parseTextToActingScores(
  chunksText: string[],
  options: ParseOptions
): ActingScoreChunk[] {
  const {
    docId,
    pageNumber,
    voiceStyle = 'dramatic',
    primaryVoice = 'pt-BR-FranciscaNeural',
    secondaryVoice = 'pt-BR-AntonioNeural',
    bionicEnabled = true,
  } = options;

  const currentStyle = VOICE_STYLES[voiceStyle] || VOICE_STYLES.classic;
  let dialogueToggle = false;

  return chunksText.map((rawText, chunkIndex) => {
    const cleanText = rawText.trim();
    const id = `${docId}_p${pageNumber}_c${chunkIndex}`;

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

    let basePause = 300;
    let pitchStr = '+0Hz';
    let rateStr = '+0%';
    let shouldBreath = false;

    if (role === 'heading') {
      pitchStr = '-3%';
      rateStr = '-5%';
      basePause = 800;
      shouldBreath = false;
    } else if (role === 'aside') {
      pitchStr = '-2%';
      rateStr = '+5%';
      basePause = 250;
    } else {
      // Exclamação ou urgência
      if (
        cleanText.endsWith('!') ||
        /\b(?:gritou|socorro|correu|depressa|perigo|rápido|fogo)\b/i.test(cleanText)
      ) {
        pitchStr = voiceStyle === 'dramatic' ? '+4%' : '+2%';
        rateStr = '+5%';
        shouldBreath = false;
        basePause = 350;
      }
      // Reticências ou calmaria
      else if (
        cleanText.endsWith('...') ||
        /\b(?:sussurrou|silêncio|triste|calma|pensou)\b/i.test(cleanText)
      ) {
        pitchStr = '-3%';
        rateStr = '-5%';
        basePause = 500;
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
      pageNumber,
      chunkIndex,
      rawText,
      cleanText,
      ssmlPayload,
      role,
      voiceId,
      acoustics,
    };
  });
}
