import { KokoroTTS } from 'kokoro-js';

// Kokoro pt-BR voices
export interface KokoroVoiceOption {
  id: string;       // e.g. "pf_dora"
  label: string;
  gender: 'female' | 'male';
}

export const KOKORO_BR_VOICES: KokoroVoiceOption[] = [
  { id: 'pf_dora',  label: 'Dora ✨ (Kokoro AI • BR)',  gender: 'female' },
  { id: 'pm_alex',  label: 'Alex ✨ (Kokoro AI • BR)',  gender: 'male'   },
  { id: 'pm_santa', label: 'Santa ✨ (Kokoro AI • BR)', gender: 'male'   },
];

export type KokoroStatus = 'idle' | 'loading' | 'ready' | 'error';

export class KokoroEngine {
  private tts: KokoroTTS | null = null;
  private status: KokoroStatus = 'idle';
  private currentVoice: string = 'pf_dora';
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  // Tracks the resolve fn of the current speak() promise so stop() can unblock it
  private speakResolve: (() => void) | null = null;
  private onStatusChange?: (s: KokoroStatus) => void;
  // loadPromise lets multiple callers await the same in-flight load
  private loadPromise: Promise<void> | null = null;

  constructor(onStatusChange?: (s: KokoroStatus) => void) {
    this.onStatusChange = onStatusChange;
  }

  private setStatus(s: KokoroStatus) {
    this.status = s;
    this.onStatusChange?.(s);
  }

  public getStatus(): KokoroStatus {
    return this.status;
  }

  public setVoice(voiceId: string) {
    this.currentVoice = voiceId;
  }

  /** Load the ONNX model. Safe to call multiple times — returns the same promise if already loading. */
  public load(): Promise<void> {
    if (this.tts) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    this.setStatus('loading');
    this.loadPromise = KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'wasm',
    }).then((model) => {
      this.tts = model;
      this.setStatus('ready');
    }).catch((e) => {
      console.error('Kokoro load error:', e);
      this.setStatus('error');
      this.loadPromise = null; // allow retry
      throw e;
    });

    return this.loadPromise;
  }

  /**
   * Generate and play a text chunk. Returns a Promise that resolves when the
   * audio finishes playing (or immediately if stopped/aborted).
   */
  public async speak(text: string, rate: number = 1.0): Promise<void> {
    // Ensure model is loaded
    if (!this.tts) {
      await this.load();
    }
    if (!this.tts) return;

    // Stop any current playback before starting new
    this.stopAudio();

    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContext();
    }
    // Resume suspended context (needed on some browsers after user gesture)
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const audio = await (this.tts as any).generate(text, { voice: this.currentVoice });

      const wavUint8: Uint8Array = audio.toWav();
      const arrayBuffer = wavUint8.buffer.slice(
        wavUint8.byteOffset,
        wavUint8.byteOffset + wavUint8.byteLength,
      ) as ArrayBuffer;

      const decoded = await this.audioCtx.decodeAudioData(arrayBuffer);

      // Return a promise that resolves only when audio FINISHES playing
      await new Promise<void>((resolve) => {
        this.speakResolve = resolve;

        const source = this.audioCtx!.createBufferSource();
        source.buffer = decoded;
        source.playbackRate.value = rate;
        source.connect(this.audioCtx!.destination);
        this.currentSource = source;

        source.onended = () => {
          this.currentSource = null;
          this.speakResolve = null;
          resolve();
        };

        source.start(0);
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error('Kokoro speak error:', e);
      }
    }
  }

  /** Stop current audio and unblock any pending speak() promise. */
  private stopAudio(): void {
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch (_) { /* already stopped */ }
      this.currentSource = null;
    }
    // Unblock the awaiting speak() promise
    if (this.speakResolve) {
      this.speakResolve();
      this.speakResolve = null;
    }
  }

  public stop(): void {
    this.stopAudio();
  }

  public isReady(): boolean {
    return this.status === 'ready' && this.tts !== null;
  }
}
