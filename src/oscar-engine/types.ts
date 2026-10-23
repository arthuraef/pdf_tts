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
}
