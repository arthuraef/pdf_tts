/**
 * 🏛️ OscarVoice Engine (v3.0) — Fachada Pública do Motor Desacoplado
 * Ponto de entrada único e independente de React/UI.
 */

import type { ActingScoreChunk, EngineConfig, EngineStateEvents, VoiceStyle } from './types';
import { sanitizeDocumentPages } from './sanitizer';
import { parseTextToActingScores, VOICE_STYLES } from './director';
import { PrefetchQueue, fallbackNativeTts } from './transport';
import { webAudioStage, audioBuffersToWavBlob, triggerAudioDownload, breathInjector } from './audio-stage';

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
    voiceStyle: 'dramatic',
    primaryVoice: '',
    secondaryVoice: '',
  };

  private events: EngineStateEvents = {};
  private docId: number = 1;
  private rawPagesText: string[] = [];
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

    // Se nenhuma voz foi especificada, escolhe a melhor voz em pt-BR disponível
    if (!this.config.primaryVoice) {
      const ptVoices = fallbackNativeTts.getPortugueseVoices();
      if (ptVoices.length > 0) {
        this.config.primaryVoice = ptVoices[0].voiceURI;
        if (ptVoices.length > 1) {
          this.config.secondaryVoice = ptVoices[1].voiceURI;
        }
      }
    }
  }

  public setEvents(events: EngineStateEvents): void {
    this.events = { ...this.events, ...events };
  }

  public updateConfig(config: Partial<EngineConfig>): void {
    const prevStyle = this.config.voiceStyle;
    const prevVoice = this.config.primaryVoice;
    this.config = { ...this.config, ...config };

    // Se o estilo ou voz mudaram, regenera os chunks com a nova partitura
    if (
      (config.voiceStyle && config.voiceStyle !== prevStyle) ||
      (config.primaryVoice && config.primaryVoice !== prevVoice)
    ) {
      this.rebuildChunks();
    }
  }

  public getConfig(): EngineConfig {
    return { ...this.config };
  }

  public setVoiceStyle(style: VoiceStyle): void {
    this.config.voiceStyle = style;
    this.rebuildChunks();
  }

  public setPrimaryVoice(voiceURI: string): void {
    this.config.primaryVoice = voiceURI;
    this.rebuildChunks();
  }

  public setSecondaryVoice(voiceURI: string): void {
    this.config.secondaryVoice = voiceURI;
    this.rebuildChunks();
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getScoreChunks(): ActingScoreChunk[] {
    return this.scoreChunks;
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return fallbackNativeTts.getPortugueseVoices();
  }

  /**
   * Regenera a partitura emocional dos chunks quando o usuário troca o estilo ou a voz.
   */
  private rebuildChunks(): void {
    if (this.rawPagesText.length === 0) return;

    const savedIndex = this.currentIndex;
    const wasPlaying = this.isPlaying;

    this.stop();

    const sanitizedPages = sanitizeDocumentPages(this.rawPagesText);
    const allChunks: ActingScoreChunk[] = [];

    sanitizedPages.forEach((pageContent, pageIdx) => {
      if (!pageContent.trim()) return;

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

      const pageScoreChunks = parseTextToActingScores(sentenceStrings, {
        docId: this.docId,
        pageNumber: pageIdx + 1,
        voiceStyle: this.config.voiceStyle,
        primaryVoice: this.config.primaryVoice,
        secondaryVoice: this.config.secondaryVoice,
        bionicEnabled: this.config.bionicPacingEnabled,
      });

      allChunks.push(...pageScoreChunks);
    });

    this.scoreChunks = allChunks;
    this.prefetchQueue.setChunks(this.scoreChunks);
    this.currentIndex = Math.max(0, Math.min(savedIndex, this.scoreChunks.length - 1));

    if (wasPlaying) {
      this.play(this.currentIndex);
    }
  }

  /**
   * Carrega um documento novo e constrói a partitura.
   */
  public loadDocument(docId: number, rawPages: string[], startIndex: number = 0): void {
    this.stop();
    this.docId = docId;
    this.rawPagesText = rawPages;

    const sanitizedPages = sanitizeDocumentPages(rawPages);
    const allChunks: ActingScoreChunk[] = [];

    sanitizedPages.forEach((pageContent, pageIdx) => {
      if (!pageContent.trim()) return;

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

      const pageScoreChunks = parseTextToActingScores(sentenceStrings, {
        docId: this.docId,
        pageNumber: pageIdx + 1,
        voiceStyle: this.config.voiceStyle,
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

  public async play(targetIndex?: number): Promise<void> {
    if (this.scoreChunks.length === 0) return;

    if (typeof targetIndex === 'number') {
      this.currentIndex = Math.max(0, Math.min(targetIndex, this.scoreChunks.length - 1));
    }

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
   * Executa o chunk atual aplicando a voz selecionada, modulação de pitch,
   * velocidade bionic e respiração procedural.
   */
  private playCurrentChunk(): void {
    if (!this.isPlaying) return;

    if (this.currentIndex >= this.scoreChunks.length) {
      this.stop();
      this.events.onEnd?.();
      return;
    }

    const chunk = this.scoreChunks[this.currentIndex];
    this.events.onChunkStart?.(chunk);

    // 1. Calcula o pitch baseado no perfil acústico e estilo
    let pitchMultiplier = 1.0;
    if (chunk.acoustics.pitchAdjust) {
      const match = chunk.acoustics.pitchAdjust.match(/([+-]?\d+)%/);
      if (match) {
        pitchMultiplier = 1.0 + parseInt(match[1], 10) / 100;
      }
    }
    const styleDef = VOICE_STYLES[this.config.voiceStyle] || VOICE_STYLES.classic;
    const effectivePitch = parseFloat((pitchMultiplier * styleDef.pitchMultiplier).toFixed(2));

    // 2. Calcula a velocidade efetiva com Bionic Pacing
    const bionicMultiplier = this.config.bionicPacingEnabled
      ? chunk.acoustics.bionicSpeedMultiplier
      : 1.0;
    const effectiveRate = parseFloat((this.config.basePlaybackRate * bionicMultiplier).toFixed(2));

    // 3. Escolhe a voz adequada para o papel (Narrador ou Personagem em diálogo)
    const isCharacter = chunk.role === 'character_a' || chunk.role === 'character_b';
    const targetVoice = isCharacter && this.config.secondaryVoice
      ? this.config.secondaryVoice
      : this.config.primaryVoice;

    // 4. Injeta micro-respiração humana se requisitado pelo diretor
    if (this.config.breathInjectionEnabled && chunk.acoustics.injectBreathBefore) {
      try {
        const ctx = webAudioStage.getAudioContext();
        breathInjector.playBreath(ctx, ctx.destination);
      } catch {
        // ignore
      }
    }

    // 5. Síntese Neural Nativa com Suporte a Karaokê e Timbre Modulado
    fallbackNativeTts.speak({
      text: chunk.cleanText,
      voiceURI: targetVoice,
      rate: effectiveRate,
      pitch: effectivePitch,
      onStart: () => {
        this.events.onNetworkFallback?.(false);
      },
      onEnd: () => {
        this.handleChunkFinished(chunk.acoustics.pauseAfterMs);
      },
      onError: (err) => {
        console.warn('Erro na síntese neural:', err);
        this.handleChunkFinished(200);
      },
      onWordBoundary: (charIndex, charLength) => {
        this.events.onWordBoundary?.(charIndex, charLength);
      },
    });
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

  private notifyState(): void {
    this.events.onPlaybackStateChange?.(this.isPlaying, this.isPaused);
  }

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
