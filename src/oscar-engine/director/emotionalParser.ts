/**
 * Diretor de Atuação & Gerador de Partitura Emocional (emotionalParser.ts)
 * Transforma texto higienizado em ActingScoreChunk com metadados de atuação,
 * prosódia SSML, separação de papéis e velocidade inteligente.
 */

import type { ActingScoreChunk, SpeakerRole, AcousticProfile } from '../types';
import { calculateBionicSpeedMultiplier } from './bionicSpeed';
import { castMemory } from './castMemory';
import { buildSSML } from './ssmlBuilder';

export interface ParseOptions {
  docId: number;
  pageNumber: number;
  primaryVoice?: string;   // Padrão narrador: 'pt-BR-FranciscaNeural'
  secondaryVoice?: string; // Padrão personagem: 'pt-BR-AntonioNeural'
  bionicEnabled?: boolean;
}

export function parseTextToActingScores(
  chunksText: string[],
  options: ParseOptions
): ActingScoreChunk[] {
  const {
    docId,
    pageNumber,
    primaryVoice = 'pt-BR-FranciscaNeural',
    secondaryVoice = 'pt-BR-AntonioNeural',
    bionicEnabled = true,
  } = options;

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
    const acoustics: AcousticProfile = {
      spatialPan,
      injectBreathBefore: false,
      bionicSpeedMultiplier: bionicEnabled ? calculateBionicSpeedMultiplier(cleanText) : 1.0,
      pauseAfterMs: 300,
      pitchAdjust: '+0Hz',
      rateAdjust: '+0%',
    };

    if (role === 'heading') {
      acoustics.pitchAdjust = '-6%';
      acoustics.rateAdjust = '-8%';
      acoustics.pauseAfterMs = 1200;
    } else if (role === 'aside') {
      acoustics.pitchAdjust = '-3%';
      acoustics.rateAdjust = '+10%';
      acoustics.pauseAfterMs = 250;
    } else {
      // Exclamação ou urgência
      if (
        cleanText.endsWith('!') ||
        /\b(?:gritou|socorro|correu|depressa|perigo|rápido|fogo)\b/i.test(cleanText)
      ) {
        acoustics.pitchAdjust = '+6%';
        acoustics.rateAdjust = '+12%';
        acoustics.injectBreathBefore = true;
        acoustics.pauseAfterMs = 350;
      }
      // Reticências ou calmaria
      else if (
        cleanText.endsWith('...') ||
        /\b(?:sussurrou|silêncio|triste|calma|pensou)\b/i.test(cleanText)
      ) {
        acoustics.pitchAdjust = '-4%';
        acoustics.rateAdjust = '-10%';
        acoustics.pauseAfterMs = 650;
      }
    }

    // Se o texto for longo (> 120 caracteres) e for fala dramática, injeta respiração antes
    if (cleanText.length > 120 && role !== 'heading') {
      acoustics.injectBreathBefore = true;
    }

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
