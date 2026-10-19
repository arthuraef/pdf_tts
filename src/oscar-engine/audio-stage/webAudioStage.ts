/**
 * Micro-Teatro Acústico 3D (webAudioStage.ts)
 * Mesa de som virtual que processa áudio espacial (Stereo Panning),
 * injeção de respirações humanas e desbloqueio de políticas de autoplay no mobile.
 */

import { breathInjector } from './breathInjector';

export class WebAudioStage {
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private masterGain: GainNode | null = null;
  private isSuspended: boolean = false;

  constructor() {
    this.initAudioContext();
  }

  public getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.initAudioContext();
    }
    return this.audioCtx!;
  }

  private initAudioContext(): void {
    if (typeof window === 'undefined') return;

    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (AudioContextClass) {
      this.audioCtx = new AudioContextClass();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
    }
  }

  /**
   * 🛡️ Lei 3: Desbloqueio obrigatório de Autoplay no Mobile (iOS Safari / Android)
   */
  public async ensureUnlocked(): Promise<void> {
    if (!this.audioCtx) {
      this.initAudioContext();
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (err) {
        console.warn('[WebAudioStage] AudioContext resume error:', err);
      }
    }
  }

  /**
   * Toca um AudioBuffer com posicionamento estéreo 3D e injeção opcional de respiração.
   */
  public playBuffer(
    buffer: AudioBuffer,
    pan: number = 0,
    playbackRate: number = 1.0,
    injectBreath: boolean = false,
    onEnded?: () => void
  ): void {
    const ctx = this.getAudioContext();
    this.stopCurrent();

    // Injeta som de respiração 250ms antes se solicitado
    if (injectBreath && this.masterGain) {
      breathInjector.playBreath(ctx, this.masterGain);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, ctx.currentTime);

    // Configura Áudio Espacial Estéreo (StereoPannerNode)
    let finalNode: AudioNode = source;

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
      source.connect(panner);
      finalNode = panner;
    }

    if (this.masterGain) {
      finalNode.connect(this.masterGain);
    } else {
      finalNode.connect(ctx.destination);
    }

    source.onended = () => {
      if (this.currentSource === source) {
        this.currentSource = null;
        onEnded?.();
      }
    };

    this.currentSource = source;
    source.start();
  }

  public stopCurrent(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // ignore
      }
      this.currentSource = null;
    }
  }

  public pause(): void {
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend();
      this.isSuspended = true;
    }
  }

  public resume(): void {
    if (this.audioCtx && this.isSuspended) {
      this.audioCtx.resume();
      this.isSuspended = false;
    }
  }

  public destroy(): void {
    this.stopCurrent();
    if (this.audioCtx) {
      try {
        this.audioCtx.close().catch(() => {});
      } catch {
        // ignore
      }
      this.audioCtx = null;
    }
  }
}

export const webAudioStage = new WebAudioStage();
