/**
 * Contratos de dados obrigatórios do OscarVoice Engine (v4.0)
 * Alinhado com a Especificação OpenAPI 3.2.1 (openapi-tts-reader-v1.yaml),
 * a Política de Segmentação Discursiva (tts-pdf-segmentation-policy-v0.1)
 * e o Protocolo de Qualificação Bake-Off.
 * Isolado de qualquer dependência de React ou DOM.
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

export type TokenClass =
  | 'legal_article'
  | 'roman_numeral'
  | 'acronym'
  | 'ocr_repair'
  | 'ligature'
  | 'all_caps'
  | 'loanword'
  | 'abbreviation'
  | 'currency'
  | 'number'
  | 'measure'
  | 'datetime'
  | 'address'
  | 'geo'
  | 'decimal'
  | 'other';

export type NormalizationDecision = 'normalized' | 'preserved' | 'needs_review' | 'intentionally_silent';

export interface SourceSpan {
  page: number;
  start: number; // Offset inclusivo no texto extraído da página (UTF-16)
  end: number;   // Offset exclusivo no texto extraído da página (UTF-16)
}

export interface NormalizationMapItem {
  spoken_start: number;       // Offset inclusivo em spoken_text (UTF-16)
  spoken_end: number;         // Offset exclusivo em spoken_text (UTF-16)
  token_class: TokenClass | string;
  rule_id: string;            // Ex: 'ptbr.legal.artigo.v1', 'ptbr.repair.ocr_tracking.v1'
  confidence?: number;        // 0.0 a 1.0
  decision: NormalizationDecision;
  source_spans: SourceSpan[];
}

export interface PageBoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  coordinate_space: 'pdf_points_top_left' | 'normalized_0_1';
}

export type SourceBlockType =
  | 'paragraph'
  | 'heading'
  | 'list_item'
  | 'table'
  | 'formula'
  | 'figure'
  | 'caption'
  | 'footnote'
  | 'header'
  | 'footer'
  | 'reference'
  | 'unknown';

export interface SourceBlock {
  block_id: string;
  block_type: SourceBlockType;
  page: number;
  reading_order: number;
  source_start: number;
  source_end: number;
  bbox?: PageBoundingBox;
  continues_block_id?: string;
  extraction_method?: 'pdf_text_layer' | 'tagged_structure' | 'layout_parser' | 'ocr' | 'user_corrected';
  confidence?: number;
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
  sourceOffsets?: SourceSpan[];  // Offsets UTF-16 apontando para o texto original
  normalizationMap?: NormalizationMapItem[]; // Rastreabilidade fonética
}

export interface WordTimestamp {
  word: string;
  start_ms: number;
  end_ms: number;
  spoken_start: number;
  spoken_end: number;
}

export type ReadingSessionState =
  | 'receiving'
  | 'synthesizing'
  | 'completed'
  | 'cancelling'
  | 'cancelled'
  | 'failed';

export interface ReadingSession {
  session_id: string;
  state: ReadingSessionState;
  input_closed: boolean;
  segment_count: number;
  ready_count: number;
  created_at: string;
  next_sequence: number;
}

export interface PutSegmentRequest {
  page_start: number;
  page_end: number;
  source_text: string;
  source_hash?: string;
  source_offsets?: SourceSpan[];
  source_blocks?: SourceBlock[];
}

export interface SegmentAccepted {
  sequence: number;
  state: 'queued' | 'synthesizing' | 'ready' | 'failed';
  spoken_text: string;
  normalization_map: NormalizationMapItem[];
  normalization_warnings: string[];
  audio_url?: string;
}

export interface SessionEvent {
  session_id: string;
  occurred_at: string;
  sequence?: number;
  segment_count?: number;
  input_closed?: boolean;
  state?: string;
  word_timestamps?: WordTimestamp[];
  normalization_map?: NormalizationMapItem[];
  audio_url?: string;
}

export interface EngineStateEvents {
  onChunkStart?: (chunk: ActingScoreChunk) => void;
  onWordBoundary?: (charIndex: number, charLength: number) => void;
  onNetworkFallback?: (isOfflineMode: boolean) => void;
  onPageComplete?: (pageNumber: number) => void;
  onEnd?: () => void;
  onError?: (error: Error, recoverable: boolean) => void;
  onPlaybackStateChange?: (isPlaying: boolean, isPaused: boolean) => void;
  onSessionEvent?: (event: SessionEvent) => void;
}

export type VoiceStyle = 'dramatic' | 'didactic' | 'classic' | 'dynamic' | 'calm';

export interface VoiceStyleDefinition {
  id: VoiceStyle;
  label: string;
  emoji: string;
  description: string;
  pitchMultiplier: number;
  pauseMsMultiplier: number;
  rateMultiplier: number;
  breathEnabled: boolean;
}

export interface EngineConfig {
  bionicPacingEnabled: boolean;
  spatialAudioEnabled: boolean;
  breathInjectionEnabled: boolean;
  basePlaybackRate: number;
  voiceStyle: VoiceStyle;
  primaryVoice: string;   // Ex: 'pt-BR-FranciscaNeural' ou voiceURI
  secondaryVoice: string; // Ex: 'pt-BR-AntonioNeural' ou voiceURI
  voiceStudio?: VoiceStudioEnhancerConfig;
  selectedModelId?: VoiceStudioModelId;
}

export type VoiceStudioPresetId =
  | 'warm_audiobook'
  | 'broadcast_hd'
  | 'soft_intimate'
  | 'crisp_fast'
  | 'custom';

export interface VoiceStudioEnhancerConfig {
  enabled: boolean;
  preset: VoiceStudioPresetId;
  pitchShift: number; // -0.10 a +0.10 (ex: -0.03 = voz 3% mais encorpada e aveludada)
  pacingMultiplier: number; // 0.7x a 1.4x (calibração do cronograma determinístico de pausas)
  breathInjection: boolean; // Injeção de micro-respirações orgânicas humanas
}

export const VOICESTUDIO_PRESETS: Record<
  VoiceStudioPresetId,
  {
    label: string;
    emoji: string;
    description: string;
    config: Omit<VoiceStudioEnhancerConfig, 'enabled' | 'preset'>;
  }
> = {
  warm_audiobook: {
    label: 'Audiolivro Aveludado',
    emoji: '🎙️',
    description: 'Voz encorpada e aveludada, eliminando o tom metálico de robô. Perfeito para a voz Google Brasil HD.',
    config: {
      pitchShift: -0.03,
      pacingMultiplier: 1.05,
      breathInjection: true,
    },
  },
  broadcast_hd: {
    label: 'Podcast Broadcast FM',
    emoji: '📻',
    description: 'Voz projetada com máxima inteligibilidade de consoantes, excelente para fones de ouvido.',
    config: {
      pitchShift: 0.0,
      pacingMultiplier: 0.9,
      breathInjection: false,
    },
  },
  soft_intimate: {
    label: 'Leitura Noturna & Suave',
    emoji: '🧘',
    description: 'Ritmo compassado, pausas estendidas e pitch aveludado, ideal para concentração e relaxamento.',
    config: {
      pitchShift: -0.04,
      pacingMultiplier: 1.2,
      breathInjection: true,
    },
  },
  crisp_fast: {
    label: 'Articulação Rápida (1.5x+)',
    emoji: '⚡',
    description: 'Otimizado para quem ouve em alta velocidade sem perder a clareza e dicção das sílabas.',
    config: {
      pitchShift: 0.02,
      pacingMultiplier: 0.75,
      breathInjection: false,
    },
  },
  custom: {
    label: 'Personalizado',
    emoji: '🎛️',
    description: 'Ajuste fino manual de tom, cadência e respirações segundo o seu gosto auditivo.',
    config: {
      pitchShift: -0.03,
      pacingMultiplier: 1.0,
      breathInjection: false,
    },
  },
};

// ---------------------------------------------------------------------------
// 7. Modelos de Voz do Sistema e do VoiceStudio
// ---------------------------------------------------------------------------
export type VoiceStudioModelId =
  | 'google_brasil'
  | 'voicestudio_cosyvoice'
  | 'voicestudio_f5tts'
  | 'voicestudio_chattts'
  | 'voicestudio_chatterbox';

export interface VoiceModelDefinition {
  id: string;
  label: string;
  engine: 'system' | 'voicestudio';
  description: string;
  emoji: string;
  supportsAcousticControls: boolean;
  defaultPreset?: VoiceStudioPresetId;
  defaultPitchShift?: number;
  defaultPacing?: number;
}

export const VOICESTUDIO_MODELS: VoiceModelDefinition[] = [
  {
    id: 'google_brasil',
    label: 'Google Brasil HD (Online)',
    engine: 'system',
    description: 'Voz neural oficial do Google Chrome em pt-BR. Fidelidade estável padrão do navegador.',
    emoji: '🌐',
    supportsAcousticControls: false,
  },
  {
    id: 'voicestudio_cosyvoice',
    label: 'VoiceStudio • CosyVoice (Audiolivro Aveludado)',
    engine: 'voicestudio',
    description: 'Modelo neural de alta resolução para audiolivros, com graves quentes e prosódia humana.',
    emoji: '🎙️',
    supportsAcousticControls: true,
    defaultPreset: 'warm_audiobook',
    defaultPitchShift: -0.04,
    defaultPacing: 1.05,
  },
  {
    id: 'voicestudio_f5tts',
    label: 'VoiceStudio • F5-TTS (Broadcast Podcast)',
    engine: 'voicestudio',
    description: 'Modelo de difusão com articulação rápida e projeção nítida para fones de ouvido.',
    emoji: '📻',
    supportsAcousticControls: true,
    defaultPreset: 'broadcast_hd',
    defaultPitchShift: 0.0,
    defaultPacing: 0.9,
  },
  {
    id: 'voicestudio_chattts',
    label: 'VoiceStudio • ChatTTS (Conversacional Suave)',
    engine: 'voicestudio',
    description: 'Modelo expressivo para leitura noturna, ritmo compassado e pausas relaxantes.',
    emoji: '🧘',
    supportsAcousticControls: true,
    defaultPreset: 'soft_intimate',
    defaultPitchShift: -0.03,
    defaultPacing: 1.2,
  },
  {
    id: 'voicestudio_chatterbox',
    label: 'VoiceStudio • ChatterBox (Técnico & Didático)',
    engine: 'voicestudio',
    description: 'Modelo analítico de alta precisão fonética para obras jurídicas e didáticas.',
    emoji: '⚡',
    supportsAcousticControls: true,
    defaultPreset: 'crisp_fast',
    defaultPitchShift: 0.02,
    defaultPacing: 0.85,
  },
];
