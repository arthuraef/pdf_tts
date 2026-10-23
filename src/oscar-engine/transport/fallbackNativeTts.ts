/**
 * Motor de Síntese Neural & Nativa (fallbackNativeTts.ts)
 * Síntese de alta fidelidade 100% no browser, com suporte a seleção de vozes,
 * modulação fina de pitch/rate e eventos de karaokê (WordBoundary).
 */

export interface NativeSpeakOptions {
  text: string;
  voiceURI?: string;
  rate?: number;
  pitch?: number; // 0.5 a 2.0
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
  onWordBoundary?: (charIndex: number, charLength: number) => void;
}

/**
 * Mapeia inteligentemente um modelo do VoiceStudio ou Google Brasil para a melhor
 * voz real instalada no navegador/sistema, garantindo timbres distintos e permitindo
 * que vozes locais aceitem modulação real de pitch.
 */
export function resolveVoiceForModel(
  modelId: string,
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;

  const ptVoices = voices.filter((v) => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    return lang.startsWith('pt');
  });

  const pool = ptVoices.length > 0 ? ptVoices : voices;

  switch (modelId) {
    case 'google_brasil': {
      // 1. Google Brasil HD: Prioriza expressamente a voz oficial do Google
      return pool.find((v) => /google/i.test(v.name)) || pool[0];
    }

    case 'voicestudio_cosyvoice': {
      // 2. CosyVoice (Audiolivro Aveludado): Voz feminina/aveludada NÃO-Google (aceita modulação real de pitch)
      const nonGoogle = pool.filter((v) => !/google/i.test(v.name));
      const warmVoice = nonGoogle.find((v) =>
        /luciana|francisca|shelley|sandy|maria|helena|vitoria|leticia|female|mulher/i.test(v.name)
      );
      if (warmVoice) return warmVoice;
      if (nonGoogle.length > 0) return nonGoogle[0];
      return pool.find((v) => /google/i.test(v.name)) || pool[0];
    }

    case 'voicestudio_f5tts': {
      // 3. F5-TTS (Broadcast Podcast): Voz masculina / forte NÃO-Google
      const nonGoogle = pool.filter((v) => !/google/i.test(v.name));
      const maleVoice = nonGoogle.find((v) =>
        /eddy|rocko|reed|grandpa|felipe|antonio|fabio|daniel|male|homem|joao|ricardo/i.test(v.name)
      );
      if (maleVoice) return maleVoice;
      if (nonGoogle.length > 1) return nonGoogle[1];
      if (nonGoogle.length > 0) return nonGoogle[0];
      return pool.find((v) => /google/i.test(v.name)) || pool[0];
    }

    case 'voicestudio_chattts': {
      // 4. ChatTTS (Conversacional Suave): Voz expressiva / suave
      const nonGoogle = pool.filter((v) => !/google/i.test(v.name));
      const softVoice = nonGoogle.find((v) =>
        /flo|sandy|shelley|thalita|leticia|joana|camila/i.test(v.name)
      );
      if (softVoice) return softVoice;
      if (nonGoogle.length > 2) return nonGoogle[2];
      if (nonGoogle.length > 0) return nonGoogle[0];
      return pool.find((v) => /google/i.test(v.name)) || pool[0];
    }

    case 'voicestudio_chatterbox': {
      // 5. ChatterBox (Técnico & Didático): Articulação precisa e didática
      const nonGoogle = pool.filter((v) => !/google/i.test(v.name));
      const crispVoice = nonGoogle.find((v) =>
        /reed|grandma|daniel|francisca|felipe|joana|yara/i.test(v.name)
      );
      if (crispVoice) return crispVoice;
      if (nonGoogle.length > 1) return nonGoogle[nonGoogle.length - 1];
      if (nonGoogle.length > 0) return nonGoogle[0];
      return pool.find((v) => /google/i.test(v.name)) || pool[0];
    }

    default: {
      return pool.find((v) => v.voiceURI === modelId || v.name === modelId) || pool[0];
    }
  }
}

export class FallbackNativeTts {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private speakTimeout: number | null = null;
  private keepAliveInterval: number | null = null;
  private onVoicesReadyCallbacks: Array<(voices: SpeechSynthesisVoice[]) => void> = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
    }
  }

  private initVoices(): void {
    if (!this.synth) return;

    const loadVoices = () => {
      try {
        const live = this.synth ? this.synth.getVoices() : [];
        if (live.length > 0) {
          this.cachedVoices = live;
          const ptVoices = this.getPortugueseVoices();
          this.onVoicesReadyCallbacks.forEach((cb) => {
            try {
              cb(ptVoices);
            } catch (err) {
              console.warn('[FallbackNativeTts] Callback error:', err);
            }
          });
        }
      } catch (e) {
        console.warn('[FallbackNativeTts] Falha ao carregar vozes:', e);
      }
    };

    loadVoices();

    // Use addEventListener instead of assigning to .onvoiceschanged so we never overwrite other handlers
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
      } catch {
        // Fallback for older browsers
        this.synth.onvoiceschanged = loadVoices;
      }
    }
  }

  public onVoicesLoaded(callback: (voices: SpeechSynthesisVoice[]) => void): () => void {
    this.onVoicesReadyCallbacks.push(callback);
    const current = this.getPortugueseVoices();
    if (current.length > 0) {
      callback(current);
    }
    return () => {
      this.onVoicesReadyCallbacks = this.onVoicesReadyCallbacks.filter((cb) => cb !== callback);
    };
  }

  public isAvailable(): boolean {
    return this.synth !== null;
  }

  public getPortugueseVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];

    // Always fetch live synth voices in case the browser populated them asynchronously
    const live = this.synth.getVoices();
    if (live && live.length > 0) {
      this.cachedVoices = live;
    }

    const all = this.cachedVoices;
    const ptVoices = all.filter((v) => {
      const lang = v.lang.toLowerCase().replace('_', '-');
      return lang.startsWith('pt');
    });

    if (ptVoices.length === 0) {
      // If no Portuguese voices are installed, return all available voices as a safety fallback
      return all;
    }

    return ptVoices.sort((a, b) => {
      const score = (v: SpeechSynthesisVoice) => {
        let s = 0;
        const name = v.name.toLowerCase();
        const lang = v.lang.toLowerCase().replace('_', '-');

        // Strong preference for Brazilian Portuguese
        if (lang === 'pt-br') s += 60;
        else if (lang.startsWith('pt')) s += 20;

        // Google Brasil (online) prioritizada com score máximo
        if (/google/i.test(name) && /pt/i.test(lang)) s += 200;
        else if (/google/i.test(name)) s += 120;

        // Neural / Online natural voices (Francisca, Antonio, Google, Microsoft, Apple Enhanced)
        if (/natural|neural|online/.test(name)) s += 50;
        if (/francisca|antonio|thalita|fabio/.test(name)) s += 45;
        if (/premium|enhanced|siri|luciana|felipe|leticia/.test(name)) s += 35;
        if (v.localService) s -= 5;
        return s;
      };
      return score(b) - score(a);
    });
  }

  public speak(options: NativeSpeakOptions): void {
    if (!this.synth) {
      options.onEnd?.();
      return;
    }

    // Clear any pending speak timeout
    if (this.speakTimeout !== null) {
      window.clearTimeout(this.speakTimeout);
      this.speakTimeout = null;
    }

    // Stop keep-alive ping from previous utterance
    this.stopKeepAlive();

    // Fix Chromium stuck in paused state
    if (this.synth.paused) {
      try {
        this.synth.resume();
      } catch {
        // ignore
      }
    }

    // Se já estava falando ou com itens pendentes, cancela e descongela o canal IPC
    const wasSpeaking = this.synth.speaking || this.synth.pending;
    if (wasSpeaking) {
      try {
        this.synth.cancel();
        // Em Chromium/WebKit, cancel() pode deixar o sintetizador em estado pausado; resume() destrava a fila
        this.synth.resume();
      } catch {
        // ignore
      }
    }

    let hasRecoveredWithFallback = false;

    const doSpeak = () => {
      if (!this.synth) return;

      // Garante que o sintetizador não esteja congelado antes de enfileirar
      if (this.synth.paused) {
        try {
          this.synth.resume();
        } catch {
          // ignore
        }
      }

      const utterance = new SpeechSynthesisUtterance(options.text);
      utterance.rate = Math.max(0.5, Math.min(2.0, options.rate ?? 1.0));
      utterance.pitch = Math.max(0.5, Math.min(2.0, options.pitch ?? 1.0));
      utterance.volume = options.volume ?? 1.0;

      // Localiza a voz apropriada para o modelo ou URI
      const ptVoices = this.getPortugueseVoices();
      let chosenVoice: SpeechSynthesisVoice | undefined;

      if (options.voiceURI) {
        if (options.voiceURI.startsWith('voicestudio_') || options.voiceURI === 'google_brasil') {
          chosenVoice = resolveVoiceForModel(options.voiceURI, ptVoices);
        } else {
          chosenVoice = ptVoices.find(
            (v) =>
              v.voiceURI === options.voiceURI ||
              v.name.toLowerCase() === options.voiceURI!.toLowerCase() ||
              v.name.toLowerCase().includes(options.voiceURI!.toLowerCase())
          );
        }
      }

      if (!chosenVoice && ptVoices.length > 0) {
        chosenVoice = ptVoices.find((v) => /google/i.test(v.name)) || ptVoices[0];
      }

      if (chosenVoice) {
        utterance.voice = chosenVoice;
        // BCP 47 rigoroso: substitui '_' por '-' para evitar que o Chromium rejeite a voz
        utterance.lang = (chosenVoice.lang || 'pt-BR').replace(/_/g, '-');
      } else {
        utterance.lang = 'pt-BR';
      }

      utterance.onstart = () => {
        this.startKeepAlive();
        options.onStart?.();
      };

      utterance.onend = () => {
        this.stopKeepAlive();
        if (this.currentUtterance === utterance) {
          this.currentUtterance = null;
        }
        if (typeof window !== 'undefined') {
          (window as unknown as { __currentUtterance?: SpeechSynthesisUtterance | null }).__currentUtterance = null;
        }
        options.onEnd?.();
      };

      utterance.onerror = (e) => {
        this.stopKeepAlive();
        if (this.currentUtterance === utterance) {
          this.currentUtterance = null;
        }
        if (typeof window !== 'undefined') {
          (window as unknown as { __currentUtterance?: SpeechSynthesisUtterance | null }).__currentUtterance = null;
        }

        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('[FallbackNativeTts] Utterance error:', e.error);

          // Auto-recuperação sem dropouts: se uma voz do sistema falhar (ex: pacote de voz não baixado no SO),
          // tenta imediatamente com a voz padrão mais estável do navegador para não deixar o usuário no silêncio
          if (!hasRecoveredWithFallback && ptVoices.length > 0) {
            const fallbackVoice = ptVoices.find((v) => /google/i.test(v.name)) || ptVoices[0];
            if (fallbackVoice && utterance.voice !== fallbackVoice) {
              hasRecoveredWithFallback = true;
              console.info('[FallbackNativeTts] Recuperando reprodução com voz estável:', fallbackVoice.name);
              const retryUtterance = new SpeechSynthesisUtterance(options.text);
              retryUtterance.rate = utterance.rate;
              retryUtterance.pitch = utterance.pitch;
              retryUtterance.volume = utterance.volume;
              retryUtterance.voice = fallbackVoice;
              retryUtterance.lang = (fallbackVoice.lang || 'pt-BR').replace(/_/g, '-');
              retryUtterance.onstart = utterance.onstart;
              retryUtterance.onend = utterance.onend;
              retryUtterance.onboundary = utterance.onboundary;
              retryUtterance.onerror = () => {
                options.onError?.(e);
              };
              this.currentUtterance = retryUtterance;
              try {
                this.synth?.speak(retryUtterance);
                return;
              } catch {
                // fallback falhou, repassa erro original
              }
            }
          }

          options.onError?.(e);
        }
      };

      // Karaoke word boundary events
      if (typeof options.onWordBoundary === 'function') {
        utterance.onboundary = (e) => {
          if (e.name === 'word' && typeof e.charIndex === 'number') {
            options.onWordBoundary?.(e.charIndex, e.charLength || 5);
          }
        };
      }

      // Retain utterance in instance property and window global to protect from V8 garbage collection mid-speech
      this.currentUtterance = utterance;
      if (typeof window !== 'undefined') {
        (window as unknown as { __currentUtterance?: SpeechSynthesisUtterance | null }).__currentUtterance = utterance;
      }

      try {
        this.synth.speak(utterance);
      } catch (err) {
        console.error('[FallbackNativeTts] synth.speak error:', err);
        options.onError?.(err);
      }
    };

    // Respeita o ciclo assíncrono de cancelamento do Chromium (60ms) para evitar cancelamento da nova fala
    if (wasSpeaking) {
      this.speakTimeout = window.setTimeout(doSpeak, 60);
    } else {
      doSpeak();
    }
  }

  public preview(text: string, voiceURI?: string, rate: number = 1.0, pitch: number = 1.0): void {
    this.speak({
      text,
      voiceURI,
      rate,
      pitch,
    });
  }

  public stop(): void {
    if (this.speakTimeout !== null) {
      window.clearTimeout(this.speakTimeout);
      this.speakTimeout = null;
    }
    this.stopKeepAlive();
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {
        // ignore
      }
      this.currentUtterance = null;
    }
  }

  public pause(): void {
    this.stopKeepAlive();
    if (this.synth) {
      try {
        this.synth.pause();
      } catch {
        // ignore
      }
    }
  }

  public resume(): void {
    if (this.synth && this.synth.paused) {
      try {
        this.synth.resume();
        this.startKeepAlive();
      } catch {
        // ignore
      }
    }
  }

  public getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveInterval = window.setInterval(() => {
      if (this.synth && this.synth.speaking && !this.synth.paused) {
        try {
          this.synth.pause();
          this.synth.resume();
        } catch {
          // ignore
        }
      }
    }, 10000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval !== null) {
      window.clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}

export const fallbackNativeTts = new FallbackNativeTts();
