/**
 * 🏛️ OscarVoice Engine (v3.0) — Fachada Pública do Motor Desacoplado
 * Ponto de entrada único e independente de React/UI.
 */

import type { ActingScoreChunk, EngineConfig, EngineStateEvents, VoiceStyle } from './types';
import { sanitizeDocumentPages } from './sanitizer';
import { parseTextToActingScores, VOICE_STYLES } from './director';
import { PrefetchQueue, fallbackNativeTts } from './transport';
import { webAudioStage, audioBuffersToWavBlob, triggerAudioDownload, breathInjector } from './audio-stage';
import { splitDiscursiveUnits } from '../core/text-chunker';

export * from './types';
export * from './sanitizer';
export * from './director';
export * from './transport';
export * from './audio-stage';

export class OscarEngine {
  private config: EngineConfig = {
    bionicPacingEnabled: true,
    spatialAudioEnabled: true,
    breathInjectionEnabled: false,
    basePlaybackRate: 1.0,
    voiceStyle: 'classic',
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
  private lastSpokenCharIndex: number = 0;
  private currentChunkCharOffset: number = 0;
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

    // Atualiza automaticamente quando o browser terminar de carregar as vozes assíncronas
    fallbackNativeTts.onVoicesLoaded((voices) => {
      if (!this.config.primaryVoice && voices.length > 0) {
        this.config.primaryVoice = voices[0].voiceURI;
        if (voices.length > 1) {
          this.config.secondaryVoice = voices[1].voiceURI;
        }
        if (this.rawPagesText.length > 0) {
          this.rebuildChunks();
        }
      }
    });
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
    const wasPlaying = this.isPlaying;
    this.rebuildChunks();
    if (!wasPlaying) {
      const styleDef = VOICE_STYLES[style] || VOICE_STYLES.classic;
      const previewText = `${styleDef.label} ativado.`;
      const targetVoice = this.config.primaryVoice;
      fallbackNativeTts.preview(
        previewText,
        targetVoice,
        parseFloat((this.config.basePlaybackRate * styleDef.rateMultiplier).toFixed(2)),
        styleDef.pitchMultiplier
      );
    }
  }

  public setPrimaryVoice(voiceURI: string): void {
    this.config.primaryVoice = voiceURI;
    const wasPlaying = this.isPlaying;
    this.rebuildChunks();
    if (!wasPlaying) {
      const styleDef = VOICE_STYLES[this.config.voiceStyle] || VOICE_STYLES.classic;
      fallbackNativeTts.preview(
        'Voz selecionada.',
        voiceURI,
        parseFloat((this.config.basePlaybackRate * styleDef.rateMultiplier).toFixed(2)),
        styleDef.pitchMultiplier
      );
    }
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

      const discursiveUnits = splitDiscursiveUnits(pageContent);
      const textStrings = discursiveUnits.map((u) => u.text);

      const pageScoreChunks = parseTextToActingScores(textStrings, {
        docId: this.docId,
        pageNumber: pageIdx + 1,
        voiceStyle: this.config.voiceStyle,
        primaryVoice: this.config.primaryVoice,
        secondaryVoice: this.config.secondaryVoice,
        bionicEnabled: this.config.bionicPacingEnabled,
      });

      pageScoreChunks.forEach((chunk, cIdx) => {
        const unit = discursiveUnits[cIdx];
        if (unit) {
          chunk.sourceOffsets = [
            {
              page: pageIdx + 1,
              start: unit.sourceStart,
              end: unit.sourceEnd,
            },
          ];
        }
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
   * Carrega um documento novo e constrói a partitura com segmentação discursiva.
   */
  public loadDocument(docId: number, rawPages: string[], startIndex: number = 0): void {
    this.stop();
    this.docId = docId;
    this.rawPagesText = rawPages;

    const sanitizedPages = sanitizeDocumentPages(rawPages);
    const allChunks: ActingScoreChunk[] = [];

    sanitizedPages.forEach((pageContent, pageIdx) => {
      if (!pageContent.trim()) return;

      const discursiveUnits = splitDiscursiveUnits(pageContent);
      const textStrings = discursiveUnits.map((u) => u.text);

      const pageScoreChunks = parseTextToActingScores(textStrings, {
        docId: this.docId,
        pageNumber: pageIdx + 1,
        voiceStyle: this.config.voiceStyle,
        primaryVoice: this.config.primaryVoice,
        secondaryVoice: this.config.secondaryVoice,
        bionicEnabled: this.config.bionicPacingEnabled,
      });

      pageScoreChunks.forEach((chunk, cIdx) => {
        const unit = discursiveUnits[cIdx];
        if (unit) {
          chunk.sourceOffsets = [
            {
              page: pageIdx + 1,
              start: unit.sourceStart,
              end: unit.sourceEnd,
            },
          ];
        }
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

    webAudioStage.ensureUnlocked().catch(() => {});

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
    this.lastSpokenCharIndex = 0;
    this.currentChunkCharOffset = 0;
    this.notifyState();
    this.playCurrentChunk(0);
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
    this.lastSpokenCharIndex = 0;
    this.currentChunkCharOffset = 0;
    this.notifyState();
  }

  /**
   * Pula exatamente 1 frase/ideia inteira para trás ou para frente.
   */
  public skipSentence(direction: -1 | 1): void {
    if (this.scoreChunks.length === 0) return;

    const nextIndex = Math.max(0, Math.min(this.scoreChunks.length - 1, this.currentIndex + direction));
    this.currentIndex = nextIndex;
    this.lastSpokenCharIndex = 0;
    this.currentChunkCharOffset = 0;

    if (this.isPlaying) {
      this.playCurrentChunk(0);
    } else {
      if (this.scoreChunks[this.currentIndex]) {
        this.events.onChunkStart?.(this.scoreChunks[this.currentIndex]);
      }
    }
  }

  public skip(seconds: number): void {
    this.skipSentence(seconds < 0 ? -1 : 1);
  }

  /**
   * Altera a velocidade de reprodução e retoma a fala da palavra exata
   * onde estava, sem reiniciar a frase do início.
   */
  public setBasePlaybackRate(rate: number): void {
    this.config.basePlaybackRate = rate;
    if (this.isPlaying && !this.isPaused) {
      const chunk = this.scoreChunks[this.currentIndex];
      // Se já estava falando a frase, retoma da palavra atual
      if (chunk && this.lastSpokenCharIndex > 0 && this.lastSpokenCharIndex < chunk.cleanText.length - 3) {
        this.playCurrentChunk(this.lastSpokenCharIndex);
      } else {
        this.playCurrentChunk(0);
      }
    }
  }

  /**
   * Executa o chunk atual aplicando a voz selecionada, modulação de pitch,
   * velocidade bionic e retomada precisa por caractere.
   */
  private playCurrentChunk(charOffset: number = 0): void {
    if (!this.isPlaying) return;

    if (this.currentIndex >= this.scoreChunks.length) {
      this.stop();
      this.events.onEnd?.();
      return;
    }

    const chunk = this.scoreChunks[this.currentIndex];
    this.events.onChunkStart?.(chunk);

    this.currentChunkCharOffset = charOffset;
    const textToSpeak = charOffset > 0 ? chunk.cleanText.slice(charOffset).trim() : chunk.cleanText;
    if (!textToSpeak) {
      this.handleChunkFinished(100);
      return;
    }

    // 1. Modulação de Pitch baseada no papel dramático e estilo
    let pitchMultiplier = 1.0;
    if (this.config.spatialAudioEnabled && chunk.acoustics.pitchAdjust) {
      const match = chunk.acoustics.pitchAdjust.match(/([+-]?\d+)%/);
      if (match) {
        pitchMultiplier = 1.0 + parseInt(match[1], 10) / 100;
      }
    }
    const styleDef = VOICE_STYLES[this.config.voiceStyle] || VOICE_STYLES.classic;
    const effectivePitch = parseFloat((pitchMultiplier * styleDef.pitchMultiplier).toFixed(2));

    // 2. Calcula a velocidade efetiva com Bionic Pacing e Estilo de Voz
    const bionicMultiplier = this.config.bionicPacingEnabled
      ? chunk.acoustics.bionicSpeedMultiplier
      : 1.0;
    const effectiveRate = parseFloat(
      (this.config.basePlaybackRate * bionicMultiplier * styleDef.rateMultiplier).toFixed(2)
    );

    // 3. Escolhe a voz adequada para o papel (Teatro 3D alterna vozes em diálogos)
    const isCharacter = chunk.role === 'character_a' || chunk.role === 'character_b';
    const targetVoice = this.config.spatialAudioEnabled && isCharacter && this.config.secondaryVoice
      ? this.config.secondaryVoice
      : this.config.primaryVoice;

    // 4. Injeta micro-respiração humana apenas se explicitamente habilitado
    if (
      this.config.breathInjectionEnabled &&
      charOffset === 0 &&
      chunk.acoustics.injectBreathBefore &&
      styleDef.breathEnabled
    ) {
      try {
        const ctx = webAudioStage.getAudioContext();
        if (ctx.state === 'running') {
          breathInjector.playBreath(ctx, ctx.destination);
        }
      } catch {
        // ignore
      }
    }

    const effectivePause = Math.round(
      (chunk.acoustics.pauseAfterMs || 300) * styleDef.pauseMsMultiplier
    );

    // 5. Síntese Neural Nativa com Suporte a Karaokê e Timbre Modulado
    fallbackNativeTts.speak({
      text: textToSpeak,
      voiceURI: targetVoice,
      rate: effectiveRate,
      pitch: effectivePitch,
      onStart: () => {
        this.events.onNetworkFallback?.(false);
      },
      onEnd: () => {
        this.lastSpokenCharIndex = 0;
        this.currentChunkCharOffset = 0;
        this.handleChunkFinished(effectivePause);
      },
      onError: (err) => {
        console.warn('Erro na síntese neural:', err);
        this.lastSpokenCharIndex = 0;
        this.currentChunkCharOffset = 0;
        this.handleChunkFinished(200);
      },
      onWordBoundary: (subCharIndex, charLength) => {
        this.lastSpokenCharIndex = this.currentChunkCharOffset + subCharIndex;
        this.events.onWordBoundary?.(this.lastSpokenCharIndex, charLength);
      },
    });
  }

  public preview(text: string, voiceURI?: string, style?: VoiceStyle): void {
    const targetStyle = style || this.config.voiceStyle;
    const styleDef = VOICE_STYLES[targetStyle] || VOICE_STYLES.classic;
    const targetVoice = voiceURI || this.config.primaryVoice;
    const rate = parseFloat((this.config.basePlaybackRate * styleDef.rateMultiplier).toFixed(2));
    fallbackNativeTts.preview(text, targetVoice, rate, styleDef.pitchMultiplier);
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
