/**
 * 🏛️ OscarVoice Engine (v3.0) — Fachada Pública do Motor Desacoplado
 * Ponto de entrada único e independente de React/UI.
 */

import type { ActingScoreChunk, EngineConfig, EngineStateEvents } from './types';
import { sanitizeDocumentPages } from './sanitizer';
import { parseTextToActingScores } from './director';
import { PrefetchQueue, fallbackNativeTts, type WordBoundaryEvent } from './transport';
import { webAudioStage, audioBuffersToWavBlob, triggerAudioDownload } from './audio-stage';

export * from './types';
export * from './sanitizer';
export * from './director';
export * from './transport';
export * from './audio-stage';

export class OscarEngine {
  private config: EngineConfig = {
    bionicPacingEnabled: true,
    spatialAudioEnabled: true,
    breathInjectionEnabled: true,
    basePlaybackRate: 1.0,
    primaryVoice: 'pt-BR-FranciscaNeural',
    secondaryVoice: 'pt-BR-AntonioNeural',
  };

  private events: EngineStateEvents = {};
  private docId: number = 1;
  private pagesText: string[] = [];
  private scoreChunks: ActingScoreChunk[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private prefetchQueue: PrefetchQueue;

  constructor(events: EngineStateEvents = {}, config?: Partial<EngineConfig>) {
    this.events = events;
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.prefetchQueue = new PrefetchQueue(webAudioStage.getAudioContext());
  }

  public setEvents(events: EngineStateEvents): void {
    this.events = { ...this.events, ...events };
  }

  public updateConfig(config: Partial<EngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): EngineConfig {
    return { ...this.config };
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getScoreChunks(): ActingScoreChunk[] {
    return this.scoreChunks;
  }

  /**
   * 🛡️ Lei 4: Processamento por Demanda (Lazy Page Parsing)
   * Higieniza o texto e prepara os chunks com partitura de atuação.
   */
  public loadDocument(docId: number, rawPages: string[], startIndex: number = 0): void {
    this.stop();
    this.docId = docId;

    // 1. Camada 1: Faxina & Dicionário Brasileiro
    this.pagesText = sanitizeDocumentPages(rawPages);

    // 2. Divide em sentenças estruturadas por página
    const allChunks: ActingScoreChunk[] = [];

    this.pagesText.forEach((pageContent, pageIdx) => {
      if (!pageContent.trim()) return;

      // Divide em sentenças
      const sentences = pageContent.match(/[^.!?\n]+[.!?\n]*/g) || [pageContent];
      const sentenceStrings: string[] = [];
      let buffer = '';

      for (const s of sentences) {
        const trimmed = s.trim();
        if (!trimmed) continue;

        if ((buffer + ' ' + trimmed).trim().length > 160 && buffer.length > 0) {
          sentenceStrings.push(buffer.trim());
          buffer = trimmed;
        } else {
          buffer = buffer ? `${buffer} ${trimmed}` : trimmed;
        }
      }
      if (buffer.trim()) {
        sentenceStrings.push(buffer.trim());
      }

      // 3. Camada 2: Diretor de Atuação & Partitura Emocional
      const pageScoreChunks = parseTextToActingScores(sentenceStrings, {
        docId: this.docId,
        pageNumber: pageIdx + 1,
        primaryVoice: this.config.primaryVoice,
        secondaryVoice: this.config.secondaryVoice,
        bionicEnabled: this.config.bionicPacingEnabled,
      });

      allChunks.push(...pageScoreChunks);
    });

    this.scoreChunks = allChunks;
    this.prefetchQueue.setChunks(this.scoreChunks);
    this.currentIndex = Math.max(0, Math.min(startIndex, this.scoreChunks.length - 1));
  }

  /**
   * Inicia a reprodução com o Micro-Teatro 3D e esteira 'Zero Silêncio'.
   */
  public async play(targetIndex?: number): Promise<void> {
    if (this.scoreChunks.length === 0) return;

    if (typeof targetIndex === 'number') {
      this.currentIndex = Math.max(0, Math.min(targetIndex, this.scoreChunks.length - 1));
    }

    // 🛡️ Lei 3: Desbloqueia contexto de áudio em clique do usuário
    await webAudioStage.ensureUnlocked();

    if (this.isPaused) {
      webAudioStage.resume();
      fallbackNativeTts.resume();
      this.isPaused = false;
      this.isPlaying = true;
      this.notifyState();
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.notifyState();
    this.playCurrentChunk();
  }

  public pause(): void {
    webAudioStage.pause();
    fallbackNativeTts.pause();
    this.isPaused = true;
    this.isPlaying = false;
    this.notifyState();
  }

  public resume(): void {
    this.play();
  }

  public stop(): void {
    webAudioStage.stopCurrent();
    fallbackNativeTts.stop();
    this.isPlaying = false;
    this.isPaused = false;
    this.notifyState();
  }

  public skip(seconds: number): void {
    if (this.scoreChunks.length === 0) return;

    const rate = this.config.basePlaybackRate;
    const delta = Math.round((seconds * rate) / 5);
    const step = delta === 0 ? (seconds > 0 ? 1 : -1) : delta;

    const nextIndex = Math.max(0, Math.min(this.scoreChunks.length - 1, this.currentIndex + step));
    this.currentIndex = nextIndex;

    if (this.isPlaying) {
      this.playCurrentChunk();
    } else {
      if (this.scoreChunks[this.currentIndex]) {
        this.events.onChunkStart?.(this.scoreChunks[this.currentIndex]);
      }
    }
  }

  public setBasePlaybackRate(rate: number): void {
    this.config.basePlaybackRate = rate;
    if (this.isPlaying && !this.isPaused) {
      this.playCurrentChunk();
    }
  }

  /**
   * Executa o chunk atual: tenta via WebAudioStage com áudio HD da esteira;
   * se for fallback, aciona instantaneamente a Web Speech API local sem engasgar.
   */
  private async playCurrentChunk(): Promise<void> {
    if (!this.isPlaying) return;

    if (this.currentIndex >= this.scoreChunks.length) {
      this.stop();
      this.events.onEnd?.();
      return;
    }

    const chunk = this.scoreChunks[this.currentIndex];
    this.events.onChunkStart?.(chunk);

    try {
      const prepared = await this.prefetchQueue.getOrFetch(this.currentIndex, this.docId);

      // Notifica se entrou em modo de emergência offline
      this.events.onNetworkFallback?.(prepared.isFallback);

      if (!prepared.isFallback && prepared.audioBuffer) {
        // Reproduz com o Micro-Teatro 3D
        const pan = this.config.spatialAudioEnabled ? chunk.acoustics.spatialPan : 0;
        const bionicMultiplier = this.config.bionicPacingEnabled
          ? chunk.acoustics.bionicSpeedMultiplier
          : 1.0;
        const effectiveRate = this.config.basePlaybackRate * bionicMultiplier;

        // Dispara eventos de Karaokê se disponíveis
        this.dispatchWordBoundaries(prepared.wordBoundaries, effectiveRate);

        webAudioStage.playBuffer(
          prepared.audioBuffer,
          pan,
          effectiveRate,
          this.config.breathInjectionEnabled && chunk.acoustics.injectBreathBefore,
          () => {
            this.handleChunkFinished(chunk.acoustics.pauseAfterMs);
          }
        );
      } else {
        // 🛡️ Lei 2: Executa Fallback Nativo sem parar o livro
        fallbackNativeTts.speak(
          chunk.cleanText,
          this.config.basePlaybackRate,
          undefined,
          () => {
            this.handleChunkFinished(chunk.acoustics.pauseAfterMs);
          },
          (err) => {
            console.warn('Erro no fallback nativo:', err);
            this.handleChunkFinished(200);
          }
        );
      }
    } catch (err) {
      console.warn('Erro ao reproduzir chunk no OscarEngine:', err);
      // Avança suavemente em caso de falha irreparável
      this.handleChunkFinished(200);
    }
  }

  private handleChunkFinished(pauseMs: number = 300): void {
    if (this.isPlaying && !this.isPaused) {
      setTimeout(() => {
        if (this.isPlaying && !this.isPaused) {
          this.currentIndex++;
          if (this.currentIndex < this.scoreChunks.length) {
            this.playCurrentChunk();
          } else {
            this.stop();
            this.events.onEnd?.();
          }
        }
      }, pauseMs);
    }
  }

  private dispatchWordBoundaries(
    boundaries: WordBoundaryEvent[],
    playbackRate: number
  ): void {
    if (!boundaries || boundaries.length === 0 || !this.events.onWordBoundary) return;

    for (const b of boundaries) {
      const delayMs = (b.offset / playbackRate);
      setTimeout(() => {
        if (this.isPlaying && !this.isPaused) {
          this.events.onWordBoundary?.(b.text.length, b.length);
        }
      }, delayMs);
    }
  }

  private notifyState(): void {
    this.events.onPlaybackStateChange?.(this.isPlaying, this.isPaused);
  }

  /**
   * Exporta a página/capítulo atual em formato WAV/MP3 com download direto.
   */
  public async exportChapterAudio(pageNumber: number): Promise<Blob> {
    const pageChunks = this.scoreChunks.filter((c) => c.pageNumber === pageNumber);
    const buffers: AudioBuffer[] = [];

    for (const chunk of pageChunks) {
      const chunkIndex = this.scoreChunks.findIndex((c) => c.id === chunk.id);
      if (chunkIndex !== -1) {
        const prepared = await this.prefetchQueue.getOrFetch(chunkIndex, this.docId);
        if (prepared.audioBuffer) {
          buffers.push(prepared.audioBuffer);
        }
      }
    }

    const wavBlob = audioBuffersToWavBlob(buffers);
    triggerAudioDownload(wavBlob, `audiolivro-capitulo-${pageNumber}.wav`);
    return wavBlob;
  }
}
