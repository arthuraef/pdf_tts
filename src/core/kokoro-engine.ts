import { KokoroTTS } from 'kokoro-js';

export interface KokoroVoiceOption {
  id: string;
  label: string;
  gender: 'female' | 'male';
}

export const KOKORO_BR_VOICES: KokoroVoiceOption[] = [
  { id: 'pf_dora',  label: 'Dora ✨ (Kokoro AI • BR)',  gender: 'female' },
  { id: 'pm_alex',  label: 'Alex ✨ (Kokoro AI • BR)',  gender: 'male'   },
  { id: 'pm_santa', label: 'Santa ✨ (Kokoro AI • BR)', gender: 'male'   },
];

export type KokoroStatus = 'idle' | 'loading' | 'ready' | 'error';

// Shape returned by kokoro-js generate()
interface KokoroAudio {
  audio: Float32Array;
  sampling_rate: number;
}

export class KokoroEngine {
  private tts: KokoroTTS | null = null;
  private status: KokoroStatus = 'idle';
  private currentVoice: string = 'pf_dora';
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  // Resolve fn of the current speak() promise — called by stopAudio() to unblock
  private speakResolve: (() => void) | null = null;
  private onStatusChange?: (s: KokoroStatus) => void;
  // Shared promise so multiple callers await the same download
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

  /** Load the ONNX model. Returns the same Promise if already loading. */
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
      console.error('[KokoroEngine] load error:', e);
      this.setStatus('error');
      this.loadPromise = null; // allow retry
      throw e;
    });

    return this.loadPromise;
  }

  /**
   * Generate and play one text chunk.
   * Returns a Promise that resolves when the audio finishes (or is stopped).
   * Throws on generation/playback errors so the caller can break the loop.
   */
  public async speak(text: string, rate: number = 1.0): Promise<void> {
    if (!this.tts) await this.load();
    if (!this.tts) throw new Error('[KokoroEngine] model not loaded');

    // Stop any currently playing audio and unblock previous speak() promise
    this.stopAudio();

    // Ensure AudioContext exists and is running
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    // Generate audio from the model
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (this.tts as any).generate(text, { voice: this.currentVoice }) as KokoroAudio;

    if (!result || !result.audio || !result.sampling_rate) {
      throw new Error('[KokoroEngine] generate() returned unexpected shape');
    }

    const { audio, sampling_rate } = result;

    // Build an AudioBuffer directly from the Float32Array — no WAV encoding needed
    const audioBuffer = this.audioCtx.createBuffer(1, audio.length, sampling_rate);
    audioBuffer.copyToChannel(audio as Float32Array<ArrayBuffer>, 0);

    // Return a Promise that resolves only when the audio finishes playing
    return new Promise<void>((resolve) => {
      this.speakResolve = resolve;

      const source = this.audioCtx!.createBufferSource();
      source.buffer = audioBuffer;
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
  }

  private stopAudio(): void {
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch (_) { /* already stopped */ }
      this.currentSource = null;
    }
    // Unblock any awaiting speak() promise so the loop can exit cleanly
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
