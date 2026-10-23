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
    await this.unlockAudio();
  }

  /**
   * 🛡️ Desbloqueio atômico de hardware de áudio no Mobile (VoiceStudio unlockAudio pattern).
   * Toca um micro-buffer silencioso de 1 amostra para forçar o WebAudio hardware a despertar
   * sem latência residual em iOS Safari / Android Chrome.
   */
  public async unlockAudio(): Promise<boolean> {
    if (!this.audioCtx) {
      this.initAudioContext();
    }
    if (!this.audioCtx) return false;

    try {
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      const silentBuffer = this.audioCtx.createBuffer(1, 1, 22050);
      const source = this.audioCtx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(this.audioCtx.destination);
      source.start(0);
      return true;
    } catch (err) {
      console.warn('[WebAudioStage] Mobile audio unlock error:', err);
      return false;
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

  /**
   * Toca um chime sutil e elegante ("Plim!") de confirmação (ex: grifo por fone de ouvido).
   */
  public playChime(): void {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      // Oscilador cristalino com subida harmônica sutil (880 Hz -> 1320 Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (err) {
      console.warn('Erro ao reproduzir chime:', err);
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

let unlockListenersInstalled = false;

/**
 * Registra listeners globais efêmeros nos primeiros gestos do usuário (pointerdown, touchstart, keydown)
 * para desbloquear instantaneamente o AudioContext em dispositivos móveis (VoiceStudio pattern).
 */
export function installGlobalAudioUnlock(stage: WebAudioStage = webAudioStage): void {
  if (typeof window === 'undefined' || unlockListenersInstalled) return;
  unlockListenersInstalled = true;

  const unlockHandler = () => {
    stage.unlockAudio().then((unlocked) => {
      if (unlocked) {
        window.removeEventListener('pointerdown', unlockHandler);
        window.removeEventListener('touchstart', unlockHandler);
        window.removeEventListener('keydown', unlockHandler);
      }
    });
  };

  window.addEventListener('pointerdown', unlockHandler, { passive: true });
  window.addEventListener('touchstart', unlockHandler, { passive: true });
  window.addEventListener('keydown', unlockHandler, { passive: true });
}
