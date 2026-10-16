export interface PDFPageContent {
  pageNumber: number;
  text: string;
}

export interface StoredDocument {
  id?: number;
  fileName: string;
  fileSize: number;
  totalPages: number;
  pages: PDFPageContent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaybackState {
  id?: number;
  docId: number;
  pageIndex: number;
  chunkIndex: number;
  playbackRate: number;
  updatedAt: Date;
}

export interface TextChunk {
  pageIndex: number;
  chunkIndex: number;
  text: string;
}

/** Unified voice option (either browser native or Kokoro AI) */
export interface VoiceOption {
  id: string;           // unique: voiceURI for native, "kokoro:pf_dora" etc for AI
  label: string;        // displayed in dropdown
  engine: 'native' | 'kokoro';
  nativeVoice?: SpeechSynthesisVoice;  // only for native
  kokoroVoiceId?: string;              // only for kokoro
}
