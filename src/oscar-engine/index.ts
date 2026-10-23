/**
 * 🏛️ OscarVoice Engine (v3.0) — Fachada Pública do Motor Desacoplado
 * Ponto de entrada único e independente de React/UI.
 */

import type {
  ActingScoreChunk,
  EngineConfig,
  EngineStateEvents,
  VoiceStyle,
  VoiceStudioEnhancerConfig,
  VoiceStudioModelId,
} from './types';
import { VOICESTUDIO_PRESETS, VOICESTUDIO_MODELS } from './types';
import { sanitizeDocumentPages, applyPtBrLexicon } from './sanitizer';
import { parseChunksToActingScores, VOICE_STYLES } from './director';
import { PrefetchQueue, fallbackNativeTts, resolveVoiceForModel } from './transport';
import {
  webAudioStage,
  audioBuffersToWavBlob,
  triggerAudioDownload,
  breathInjector,
  installGlobalAudioUnlock,
} from './audio-stage';
import { buildChunksFromPages } from '../core/text-chunker';

export * from './types';
export * from './sanitizer';
export * from './director';
export * from './transport';
export * from './audio-stage';
export * from './evaluation';

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
  private selectedModelId: VoiceStudioModelId = 'google_brasil';
  private chunkStartedAt: number = 0;
  private chunkPlaybackRate: number = 1.0;
  private hasNativeBoundary: boolean = false;
  private prefetchQueue: PrefetchQueue;
  private voiceStudioConfig: VoiceStudioEnhancerConfig = {
    enabled: true,
    preset: 'warm_audiobook',
    ...VOICESTUDIO_PRESETS.warm_audiobook.config,
  };

  constructor(events: EngineStateEvents = {}, config?: Partial<EngineConfig>) {
    this.events = events;
    if (config) {
      this.config = { ...this.config, ...config };
      if (config.voiceStudio) {
        this.voiceStudioConfig = { ...this.voiceStudioConfig, ...config.voiceStudio };
      }
      if (config.selectedModelId) {
        this.selectedModelId = config.selectedModelId;
      }
    }
    this.prefetchQueue = new PrefetchQueue(webAudioStage.getAudioContext());

    // 📱 Desbloqueio atômico de áudio para dispositivos móveis (VoiceStudio pattern)
    installGlobalAudioUnlock(webAudioStage);

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

  public getSelectedModelId(): VoiceStudioModelId {
    return this.selectedModelId;
  }

  public setSelectedModelId(modelId: VoiceStudioModelId): void {
    this.selectedModelId = modelId;
    const modelDef = VOICESTUDIO_MODELS.find((m) => m.id === modelId);
    if (modelDef && modelDef.engine === 'voicestudio') {
      if (modelDef.defaultPreset) {
        this.voiceStudioConfig.preset = modelDef.defaultPreset;
      }
      if (typeof modelDef.defaultPitchShift === 'number') {
        this.voiceStudioConfig.pitchShift = modelDef.defaultPitchShift;
      }
      if (typeof modelDef.defaultPacing === 'number') {
        this.voiceStudioConfig.pacingMultiplier = modelDef.defaultPacing;
      }
    }

    // Sincroniza a voz primária física com a voz resolvida para este modelo
    const ptVoices = fallbackNativeTts.getPortugueseVoices();
    const resolved = resolveVoiceForModel(modelId, ptVoices);
    if (resolved) {
      this.config.primaryVoice = resolved.voiceURI;
    }

    if (this.isPlaying && !this.isPaused) {
      this.playCurrentChunk(this.lastSpokenCharIndex || 0);
    }
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
    const pdfPages = sanitizedPages.map((text, idx) => ({
      pageNumber: idx + 1,
      text,
    }));

    const textChunks = buildChunksFromPages(pdfPages);
    const chunkInputs = textChunks.map((c) => ({
      text: c.text,
      rawText: c.rawText,
      pageNumber: c.sourceOffsets?.[0]?.page ?? c.pageIndex + 1,
      chunkIndex: c.chunkIndex,
      sourceOffsets: c.sourceOffsets,
    }));

    this.scoreChunks = parseChunksToActingScores(chunkInputs, {
      docId: this.docId,
      pageNumber: 1,
      voiceStyle: this.config.voiceStyle,
      primaryVoice: this.config.primaryVoice,
      secondaryVoice: this.config.secondaryVoice,
      bionicEnabled: this.config.bionicPacingEnabled,
    });

    this.prefetchQueue.setChunks(this.scoreChunks);
    this.currentIndex = Math.max(0, Math.min(savedIndex, this.scoreChunks.length - 1));

    if (wasPlaying) {
      this.play(this.currentIndex);
    }
  }

  /**
   * Carrega um documento novo e constrói a partitura com segmentação discursiva e costura de páginas.
   */
  public loadDocument(docId: number, rawPages: string[], startIndex: number = 0): void {
    this.stop();
    this.docId = docId;
    this.rawPagesText = rawPages;

    const sanitizedPages = sanitizeDocumentPages(rawPages);
    const pdfPages = sanitizedPages.map((text, idx) => ({
      pageNumber: idx + 1,
      text,
    }));

    const textChunks = buildChunksFromPages(pdfPages);
    const chunkInputs = textChunks.map((c) => ({
      text: c.text,
      rawText: c.rawText,
      pageNumber: c.sourceOffsets?.[0]?.page ?? c.pageIndex + 1,
      chunkIndex: c.chunkIndex,
      sourceOffsets: c.sourceOffsets,
    }));

    this.scoreChunks = parseChunksToActingScores(chunkInputs, {
      docId: this.docId,
      pageNumber: 1,
      voiceStyle: this.config.voiceStyle,
      primaryVoice: this.config.primaryVoice,
      secondaryVoice: this.config.secondaryVoice,
      bionicEnabled: this.config.bionicPacingEnabled,
    });

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
      this.chunkStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.notifyState();
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.chunkStartedAt = 0;
    this.hasNativeBoundary = false;
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
    this.chunkStartedAt = 0;
    this.hasNativeBoundary = false;
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
   * onde estava, alinhando ao início da palavra sem reiniciar a frase do início.
   */
  public setBasePlaybackRate(rate: number): void {
    this.config.basePlaybackRate = rate;
    if (this.isPlaying && !this.isPaused) {
      const chunk = this.scoreChunks[this.currentIndex];
      if (!chunk || !chunk.cleanText) return;

      let currentCharPos = 0;
      if (this.hasNativeBoundary && this.lastSpokenCharIndex > 0) {
        currentCharPos = this.lastSpokenCharIndex;
      } else if (this.chunkStartedAt > 0) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const elapsedSec = Math.max(0, (now - this.chunkStartedAt) / 1000);
        // Em português falado natural, a cadência média é de ~15.5 caracteres por segundo a 1.0x
        const charsSpokenSinceStart = Math.floor(elapsedSec * 15.5 * (this.chunkPlaybackRate || 1.0));
        currentCharPos = this.currentChunkCharOffset + charsSpokenSinceStart;
      }

      // Garante limites válidos dentro do chunk
      currentCharPos = Math.max(0, Math.min(currentCharPos, chunk.cleanText.length - 1));

      // Se já avançou no texto e não está no finalzinho (menos de 4 caracteres para o fim)
      if (currentCharPos > 0 && currentCharPos < chunk.cleanText.length - 4) {
        let wordStartIndex = currentCharPos;
        // Recua até o início da palavra atual (caractere após espaço ou 0)
        while (wordStartIndex > 0 && !/\s/.test(chunk.cleanText[wordStartIndex - 1])) {
          wordStartIndex--;
        }
        // Avança caso tenha parado em espaço em branco
        while (wordStartIndex < chunk.cleanText.length && /\s/.test(chunk.cleanText[wordStartIndex])) {
          wordStartIndex++;
        }
        if (wordStartIndex < chunk.cleanText.length - 3) {
          this.playCurrentChunk(wordStartIndex);
          return;
        }
      }

      // Se estiver muito próximo do fim, não reinicia do início
      if (currentCharPos >= chunk.cleanText.length - 4) {
        return;
      }

      this.playCurrentChunk(0);
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

    // Ajusta o offset pulando eventuais espaços em branco iniciais
    let actualOffset = charOffset;
    while (actualOffset < chunk.cleanText.length && /\s/.test(chunk.cleanText[actualOffset])) {
      actualOffset++;
    }

    this.currentChunkCharOffset = actualOffset;
    this.chunkStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.hasNativeBoundary = false;

    const textToSpeak = actualOffset > 0 ? chunk.cleanText.slice(actualOffset) : chunk.cleanText;
    if (!textToSpeak.trim()) {
      this.handleChunkFinished(100);
      return;
    }

    // Identifica o modelo ativo e se suporta controles acústicos do VoiceStudio
    const activeModel =
      VOICESTUDIO_MODELS.find((m) => m.id === this.selectedModelId) || VOICESTUDIO_MODELS[0];
    const supportsAcoustic = activeModel.supportsAcousticControls;

    // 1. Modulação de Pitch baseada no papel dramático, estilo e VoiceStudio Enhancer (apenas modelos VoiceStudio)
    let pitchMultiplier = 1.0;
    if (this.config.spatialAudioEnabled && chunk.acoustics.pitchAdjust) {
      const match = chunk.acoustics.pitchAdjust.match(/([+-]?\d+)%/);
      if (match) {
        pitchMultiplier = 1.0 + parseInt(match[1], 10) / 100;
      }
    }
    const styleDef = VOICE_STYLES[this.config.voiceStyle] || VOICE_STYLES.classic;
    const studioPitchShift = supportsAcoustic && this.voiceStudioConfig.enabled
      ? this.voiceStudioConfig.pitchShift
      : 0.0;
    const effectivePitch = parseFloat(
      Math.max(0.5, Math.min(2.0, pitchMultiplier * styleDef.pitchMultiplier * (1.0 + studioPitchShift))).toFixed(2)
    );

    // 2. Calcula a velocidade efetiva com Bionic Pacing e Estilo de Voz
    const bionicMultiplier = this.config.bionicPacingEnabled
      ? chunk.acoustics.bionicSpeedMultiplier
      : 1.0;
    const effectiveRate = parseFloat(
      (this.config.basePlaybackRate * bionicMultiplier * styleDef.rateMultiplier).toFixed(2)
    );
    this.chunkPlaybackRate = effectiveRate;

    // 3. Escolhe a voz adequada para o modelo e papel dramático
    const isCharacter = chunk.role === 'character_a' || chunk.role === 'character_b';
    let targetVoice = this.config.primaryVoice;
    const ptVoices = fallbackNativeTts.getPortugueseVoices();
    if (this.selectedModelId.startsWith('voicestudio_')) {
      const resolved = resolveVoiceForModel(this.selectedModelId, ptVoices);
      if (resolved) {
        targetVoice = resolved.voiceURI;
      }
    } else if (this.selectedModelId === 'google_brasil') {
      const googleVoice = ptVoices.find((v) => /google/i.test(v.name));
      if (googleVoice) {
        targetVoice = googleVoice.voiceURI;
      }
    }

    if (this.config.spatialAudioEnabled && isCharacter && this.config.secondaryVoice) {
      targetVoice = this.config.secondaryVoice;
    }

    // 4. Injeta micro-respiração humana orgânica (disponível em modelos VoiceStudio)
    const breathActive = supportsAcoustic
      ? (this.voiceStudioConfig.enabled && this.voiceStudioConfig.breathInjection) ||
        (this.config.breathInjectionEnabled && styleDef.breathEnabled)
      : (this.config.breathInjectionEnabled && styleDef.breathEnabled);

    if (breathActive && actualOffset === 0 && chunk.acoustics.injectBreathBefore) {
      try {
        const ctx = webAudioStage.getAudioContext();
        if (ctx.state === 'running') {
          breathInjector.playBreath(ctx, ctx.destination);
        }
      } catch {
        // ignore
      }
    }

    const studioPacing = supportsAcoustic && this.voiceStudioConfig.enabled
      ? this.voiceStudioConfig.pacingMultiplier
      : 1.0;
    const effectivePause = Math.round(
      (chunk.acoustics.pauseAfterMs || 300) * styleDef.pauseMsMultiplier * studioPacing
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
        this.chunkStartedAt = 0;
        this.hasNativeBoundary = false;
        this.lastSpokenCharIndex = 0;
        this.currentChunkCharOffset = 0;
        this.handleChunkFinished(effectivePause);
      },
      onError: (err) => {
        console.warn('Erro na síntese neural:', err);
        this.chunkStartedAt = 0;
        this.hasNativeBoundary = false;
        this.lastSpokenCharIndex = 0;
        this.currentChunkCharOffset = 0;
        this.handleChunkFinished(200);
      },
      onWordBoundary: (subCharIndex, charLength) => {
        this.hasNativeBoundary = true;
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

  public getVoiceStudioConfig(): VoiceStudioEnhancerConfig {
    return { ...this.voiceStudioConfig };
  }

  public setVoiceStudioConfig(config: Partial<VoiceStudioEnhancerConfig>): void {
    this.voiceStudioConfig = { ...this.voiceStudioConfig, ...config };
  }

  public previewVoiceStudio(
    sampleText: string = 'O tribunal julgou procedente o recurso, garantindo a ampla defesa e a segurança jurídica.',
    voiceURI?: string,
    customConfig?: Partial<VoiceStudioEnhancerConfig>,
    modelId?: VoiceStudioModelId
  ): void {
    const activeModelId = modelId || this.selectedModelId;
    const activeModel =
      VOICESTUDIO_MODELS.find((m) => m.id === activeModelId) || VOICESTUDIO_MODELS[0];
    const cfg = { ...this.voiceStudioConfig, ...customConfig };

    // Sanitiza obrigatoriamente a amostra pelo Sanitizer PT-BR
    const sanitizedSample = applyPtBrLexicon(sampleText);

    // Resolve a voz específica do modelo garantindo que VoiceStudio NÃO use a voz Google fixa
    let targetVoice = voiceURI;
    const ptVoices = fallbackNativeTts.getPortugueseVoices();
    if (
      !targetVoice ||
      targetVoice === 'google_brasil' ||
      targetVoice.startsWith('voicestudio_') ||
      (activeModelId.startsWith('voicestudio_') && /google/i.test(targetVoice))
    ) {
      const resolved = resolveVoiceForModel(activeModelId, ptVoices);
      targetVoice = resolved ? resolved.voiceURI : this.config.primaryVoice;
    }

    const styleDef = VOICE_STYLES[this.config.voiceStyle] || VOICE_STYLES.classic;
    const pitchShift = activeModel.supportsAcousticControls && cfg.enabled ? cfg.pitchShift : 0.0;
    const pitch = parseFloat((styleDef.pitchMultiplier * (1.0 + pitchShift)).toFixed(2));
    const rate = parseFloat((this.config.basePlaybackRate * styleDef.rateMultiplier).toFixed(2));
    fallbackNativeTts.preview(sanitizedSample, targetVoice, rate, pitch);
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
