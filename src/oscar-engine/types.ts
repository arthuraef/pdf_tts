/**
 * Contratos de dados obrigatórios do OscarVoice Engine (v3.0)
 * Isolado de qualquer dependência de React ou UI.
 */

export type SpeakerRole = 'narrator' | 'character_a' | 'character_b' | 'heading' | 'aside';

export interface AcousticProfile {
  spatialPan: number;            // -1.0 (Esquerda) a +1.0 (Direita). Padrão narrador: 0
  injectBreathBefore: boolean;   // Toca sample de respiração antes da fala
  bionicSpeedMultiplier: number; // Multiplicador automático de complexidade (0.90 a 1.35)
  pauseAfterMs: number;          // Pausa dramática após o fim do áudio
  pitchAdjust?: string;          // Ex: '+6%', '-4%'
  rateAdjust?: string;           // Ex: '+12%', '-10%'
}

export interface ActingScoreChunk {
  id: string;                    // Hash único: `${docId}_p${page}_c${index}`
  pageNumber: number;
  chunkIndex: number;
  rawText: string;               // Texto original extraído do PDF
  cleanText: string;             // Texto higienizado para exibição na UI
  ssmlPayload: string;           // SSML completo para envio ao motor Neural
  role: SpeakerRole;
  voiceId: string;               // Ex: 'pt-BR-FranciscaNeural' | 'pt-BR-AntonioNeural'
  acoustics: AcousticProfile;
}

export interface EngineStateEvents {
  onChunkStart?: (chunk: ActingScoreChunk) => void;
  onWordBoundary?: (charIndex: number, charLength: number) => void;
  onNetworkFallback?: (isOfflineMode: boolean) => void;
  onPageComplete?: (pageNumber: number) => void;
  onEnd?: () => void;
  onError?: (error: Error, recoverable: boolean) => void;
  onPlaybackStateChange?: (isPlaying: boolean, isPaused: boolean) => void;
}

export interface EngineConfig {
  bionicPacingEnabled: boolean;
  spatialAudioEnabled: boolean;
  breathInjectionEnabled: boolean;
  basePlaybackRate: number;
  primaryVoice: string;   // Ex: 'pt-BR-FranciscaNeural'
  secondaryVoice: string; // Ex: 'pt-BR-AntonioNeural'
}
