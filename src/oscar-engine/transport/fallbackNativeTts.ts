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

export class FallbackNativeTts {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
    }
  }

  private initVoices(): void {
    if (!this.synth) return;

    const loadVoices = () => {
      this.cachedVoices = this.synth!.getVoices();
    };

    loadVoices();
    if (typeof this.synth.onvoiceschanged !== 'undefined') {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  public isAvailable(): boolean {
    return this.synth !== null;
  }

  public getPortugueseVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    if (this.cachedVoices.length === 0) {
      this.cachedVoices = this.synth.getVoices();
    }

    const all = this.cachedVoices;
    const ptVoices = all.filter((v) => {
      const lang = v.lang.toLowerCase().replace('_', '-');
      return lang.startsWith('pt');
    });

    return ptVoices.sort((a, b) => {
      const score = (v: SpeechSynthesisVoice) => {
        let s = 0;
        const name = v.name.toLowerCase();
        const lang = v.lang.toLowerCase().replace('_', '-');

        if (lang === 'pt-br') s += 50;
        if (/natural|neural|online/.test(name)) s += 40;
        if (/francisca|antonio|thalita/.test(name)) s += 45;
        if (/google/.test(name)) s += 30;
        if (/premium|enhanced|siri/.test(name)) s += 35;
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

    this.stop();

    const utterance = new SpeechSynthesisUtterance(options.text);
    utterance.rate = Math.max(0.5, Math.min(2.0, options.rate ?? 1.0));
    utterance.pitch = Math.max(0.5, Math.min(2.0, options.pitch ?? 1.0));
    utterance.volume = options.volume ?? 1.0;

    // Busca a voz solicitada
    const ptVoices = this.getPortugueseVoices();
    let chosenVoice: SpeechSynthesisVoice | undefined;

    if (options.voiceURI) {
      chosenVoice = ptVoices.find(
        (v) =>
          v.voiceURI === options.voiceURI ||
          v.name.toLowerCase() === options.voiceURI!.toLowerCase() ||
          v.name.toLowerCase().includes(options.voiceURI!.toLowerCase())
      );
    }

    if (!chosenVoice && ptVoices.length > 0) {
      chosenVoice = ptVoices[0];
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang;
    }

    utterance.onstart = () => {
      options.onStart?.();
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.currentUtterance = null;
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        options.onError?.(e);
      }
    };

    // Eventos de Karaokê (WordBoundary)
    if (typeof options.onWordBoundary === 'function') {
      utterance.onboundary = (e) => {
        if (e.name === 'word' && typeof e.charIndex === 'number') {
          options.onWordBoundary?.(e.charIndex, e.charLength || 5);
        }
      };
    }

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  public pause(): void {
    if (this.synth) {
      this.synth.pause();
    }
  }

  public resume(): void {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
  }

  public getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }
}

export const fallbackNativeTts = new FallbackNativeTts();
