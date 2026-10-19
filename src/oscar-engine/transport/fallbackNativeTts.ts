/**
 * Plano Paraquedas (fallbackNativeTts.ts)
 * Fallback silencioso instantâneo usando a Web Speech API do sistema operacional
 * caso o motor neural enfrente lentidão ou perda de conexão.
 */

export class FallbackNativeTts {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public isAvailable(): boolean {
    return this.synth !== null;
  }

  public speak(
    text: string,
    rate: number = 1.0,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: unknown) => void
  ): void {
    if (!this.synth) {
      onEnd?.();
      return;
    }

    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;

    // Tenta encontrar uma voz em português
    const voices = this.synth.getVoices();
    const ptVoice = voices.find((v) =>
      v.lang.toLowerCase().replace('_', '-').startsWith('pt')
    );
    if (ptVoice) {
      utterance.voice = ptVoice;
      utterance.lang = ptVoice.lang;
    }

    utterance.onstart = () => {
      onStart?.();
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      onEnd?.();
    };

    utterance.onerror = (e) => {
      this.currentUtterance = null;
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        onError?.(e);
      }
    };

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
