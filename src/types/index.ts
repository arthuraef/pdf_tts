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

export interface DocumentWithProgress extends StoredDocument {
  progress?: PlaybackState;
  progressPercentage: number;
}

export interface TextChunk {
  pageIndex: number;
  chunkIndex: number;
  text: string;
}

export interface VoiceOption {
  id: string; // voiceURI
  label: string; // displayed in dropdown
  nativeVoice: SpeechSynthesisVoice;
}
