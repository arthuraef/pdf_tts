import type { TextChunk } from '../types';

export interface TTSEventCallbacks {
  onChunkStart?: (index: number) => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
  onStateChange?: (isPlaying: boolean, isPaused: boolean) => void;
}

export class TTSEngine {
  private synth: SpeechSynthesis | null = null;
  private chunks: TextChunk[] = [];
  private currentIndex: number = 0;
  private playbackRate: number = 1.0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private keepAliveTimer: number | null = null;
  private callbacks: TTSEventCallbacks = {};

  constructor(callbacks: TTSEventCallbacks = {}) {
    this.callbacks = callbacks;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
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
    // If actively playing, resume speaking current chunk with new rate
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

  /**
   * Jump backwards by approx seconds.
   * At average 15 chars/second at 1.0x rate, 10 seconds is approx 150 chars (around 1 chunk).
   */
  public skip(seconds: number) {
    if (this.chunks.length === 0) return;

    // Approximate chunks per 10s: ~1 to 2 chunks based on playback rate
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

    // Auto-detect Portuguese or system default
    const voices = this.synth.getVoices();
    const ptVoice = voices.find((v) => v.lang.startsWith('pt'));
    if (ptVoice) {
      utterance.voice = ptVoice;
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
    // Chrome bugfix: pause/resume every 10s prevents speech synthesis stalling
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
