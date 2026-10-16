import type { TextChunk } from '../types';

export interface TTSEventCallbacks {
  onChunkStart?: (index: number) => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
  onStateChange?: (isPlaying: boolean, isPaused: boolean) => void;
  onVoicesLoaded?: (voices: SpeechSynthesisVoice[]) => void;
}

export class TTSEngine {
  private synth: SpeechSynthesis | null = null;
  private chunks: TextChunk[] = [];
  private currentIndex: number = 0;
  private playbackRate: number = 1.0;
  private selectedVoiceURI: string | null = null;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private keepAliveTimer: number | null = null;
  private callbacks: TTSEventCallbacks = {};

  constructor(callbacks: TTSEventCallbacks = {}) {
    this.callbacks = callbacks;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
    }
  }

  private initVoices() {
    if (!this.synth) return;

    const handleVoices = () => {
      const voices = this.getPortugueseVoices();
      if (voices.length > 0 && !this.selectedVoiceURI) {
        // Automatically select the best quality voice
        this.selectedVoiceURI = voices[0].voiceURI;
      }
      this.callbacks.onVoicesLoaded?.(voices);
    };

    handleVoices();

    if (typeof this.synth.onvoiceschanged !== 'undefined') {
      this.synth.onvoiceschanged = handleVoices;
    }
  }

  public getPortugueseVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    const all = this.synth.getVoices();

    // Filter Portuguese voices
    const ptVoices = all.filter((v) => {
      const lang = v.lang.toLowerCase().replace('_', '-');
      return lang.startsWith('pt');
    });

    // Score & sort voices so the most natural/human ones appear first
    return ptVoices.sort((a, b) => {
      const getScore = (v: SpeechSynthesisVoice) => {
        let score = 0;
        const name = v.name.toLowerCase();
        const lang = v.lang.toLowerCase().replace('_', '-');

        // Prefer pt-BR over pt-PT
        if (lang === 'pt-br') score += 50;

        // Microsoft Natural/Online voices (super high quality on Edge/Windows)
        if (name.includes('natural') || name.includes('online')) score += 40;

        // Google neural/online voices (Chrome/Android)
        if (name.includes('google')) score += 30;

        // Apple Enhanced / Siri / Premium voices (macOS / iOS)
        if (name.includes('premium') || name.includes('enhanced') || name.includes('siri')) score += 35;

        // Local service voices usually have lower quality than cloud neural
        if (v.localService) score -= 5;

        return score;
      };

      return getScore(b) - getScore(a);
    });
  }

  public setVoice(voiceURI: string) {
    this.selectedVoiceURI = voiceURI;
    if (this.isPlaying && !this.isPaused) {
      this.speakCurrentChunk();
    }
  }

  public getSelectedVoiceURI(): string | null {
    return this.selectedVoiceURI;
  }

  public setCallbacks(callbacks: TTSEventCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public setChunks(chunks: TextChunk[], startIndex: number = 0) {
    this.stop();
    this.chunks = chunks;
    this.currentIndex = Math.max(0, Math.min(startIndex, chunks.length - 1));
  }

  public setRate(rate: number) {
    this.playbackRate = rate;
    if (this.isPlaying && !this.isPaused) {
      this.speakCurrentChunk();
    }
  }

  public getRate(): number {
    return this.playbackRate;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public play(index?: number) {
    if (!this.synth || this.chunks.length === 0) return;

    if (typeof index === 'number') {
      this.currentIndex = Math.max(0, Math.min(index, this.chunks.length - 1));
    }

    if (this.isPaused && this.synth.paused) {
      this.synth.resume();
      this.isPaused = false;
      this.isPlaying = true;
      this.notifyState();
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.notifyState();
    this.startKeepAlive();
    this.speakCurrentChunk();
  }

  public pause() {
    if (!this.synth) return;
    this.synth.pause();
    this.isPaused = true;
    this.isPlaying = false;
    this.clearKeepAlive();
    this.notifyState();
  }

  public resume() {
    if (!this.synth) return;
    if (this.synth.paused) {
      this.synth.resume();
    } else {
      this.speakCurrentChunk();
    }
    this.isPaused = false;
    this.isPlaying = true;
    this.startKeepAlive();
    this.notifyState();
  }

  public stop() {
    this.clearKeepAlive();
    if (this.synth) {
      this.synth.cancel();
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.notifyState();
  }

  public skip(seconds: number) {
    if (this.chunks.length === 0) return;

    const chunksDelta = Math.round((seconds * this.playbackRate) / 6);
    const targetDelta = chunksDelta === 0 ? (seconds > 0 ? 1 : -1) : chunksDelta;
    const nextIndex = Math.max(0, Math.min(this.chunks.length - 1, this.currentIndex + targetDelta));

    this.currentIndex = nextIndex;
    if (this.isPlaying) {
      this.speakCurrentChunk();
    } else {
      this.callbacks.onChunkStart?.(this.currentIndex);
    }
  }

  private speakCurrentChunk() {
    if (!this.synth) return;

    this.synth.cancel();

    if (this.currentIndex >= this.chunks.length) {
      this.stop();
      this.callbacks.onEnd?.();
      return;
    }

    const chunk = this.chunks[this.currentIndex];
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.rate = this.playbackRate;

    // Pick selected voice or top ranked PT voice
    const ptVoices = this.getPortugueseVoices();
    let chosenVoice: SpeechSynthesisVoice | undefined;

    if (this.selectedVoiceURI) {
      chosenVoice = ptVoices.find((v) => v.voiceURI === this.selectedVoiceURI);
    }

    if (!chosenVoice && ptVoices.length > 0) {
      chosenVoice = ptVoices[0];
      this.selectedVoiceURI = chosenVoice.voiceURI;
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang;
    }

    utterance.onstart = () => {
      this.callbacks.onChunkStart?.(this.currentIndex);
    };

    utterance.onend = () => {
      if (this.isPlaying && !this.isPaused) {
        this.currentIndex++;
        if (this.currentIndex < this.chunks.length) {
          this.speakCurrentChunk();
        } else {
          this.stop();
          this.callbacks.onEnd?.();
        }
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.error('TTS Utterance Error:', e);
        this.callbacks.onError?.(e);
      }
    };

    this.synth.speak(utterance);
  }

  private startKeepAlive() {
    this.clearKeepAlive();
    this.keepAliveTimer = window.setInterval(() => {
      if (this.synth && this.isPlaying && !this.isPaused && !this.synth.paused) {
        this.synth.pause();
        this.synth.resume();
      }
    }, 10000);
  }

  private clearKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private notifyState() {
    this.callbacks.onStateChange?.(this.isPlaying, this.isPaused);
  }
}
