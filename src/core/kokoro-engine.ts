import { KokoroTTS } from 'kokoro-js';

// Patch prototype immediately so any KokoroTTS instance allows all voices (including pf_dora, pm_alex, pm_santa)
try {
  (KokoroTTS as unknown as { prototype: { _validate_voice: (v: string) => string } }).prototype._validate_voice = function (voice: string) {
    return voice ? voice.charAt(0) : 'a';
  };
} catch (err) {
  console.warn('[KokoroEngine] Failed to patch prototype._validate_voice:', err);
}

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
  private speakResolve: (() => void) | null = null;
  private onStatusChange?: (s: KokoroStatus) => void;
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

  /**
   * Initializes / resumes AudioContext synchronously during a user click.
   * This is essential to prevent browser autoplay policies from blocking audio.
   */
  public initAudio(): void {
    try {
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(console.error);
      }
    } catch (e) {
      console.warn('[KokoroEngine] initAudio warning:', e);
    }
  }

  /** Load the ONNX model. Returns the same Promise if already loading. */
  public load(): Promise<void> {
    if (this.tts) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    this.setStatus('loading');
    this.loadPromise = KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'wasm',
    })
      .then((model) => {
        this.tts = model;
        // Also override instance method to guarantee pt-BR voices are accepted
        (this.tts as unknown as { _validate_voice: (v: string) => string })._validate_voice = (voice: string) => {
          return voice ? voice.charAt(0) : 'a';
        };
        this.setStatus('ready');
      })
      .catch((e) => {
        console.error('[KokoroEngine] load error:', e);
        this.setStatus('error');
        this.loadPromise = null;
        throw e;
      });

    return this.loadPromise;
  }

  /**
   * Generate and play one text chunk.
   * Resolves only when the audio finishes playing, or when stopped.
   */
  public async speak(text: string, rate: number = 1.0): Promise<void> {
    const cleanText = text?.trim();
    if (!cleanText) return;

    if (!this.tts) await this.load();
    if (!this.tts) throw new Error('[KokoroEngine] Model not loaded');

    // Stop previous audio and unblock previous speak() promise
    this.stopAudio();

    // Ensure AudioContext is ready
    this.initAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    // Pass neural speed directly to generate() for natural pitch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (this.tts as any).generate(cleanText, {
      voice: this.currentVoice,
      speed: rate,
    })) as KokoroAudio;

    if (!result || !result.audio || !result.sampling_rate) {
      throw new Error('[KokoroEngine] generate() returned invalid audio output');
    }

    const { audio, sampling_rate } = result;

    if (!this.audioCtx) {
      this.initAudio();
    }
    if (!this.audioCtx) throw new Error('[KokoroEngine] AudioContext unavailable');

    // Create AudioBuffer from raw samples
    const audioBuffer = this.audioCtx.createBuffer(1, audio.length, sampling_rate);
    audioBuffer.getChannelData(0).set(audio);

    return new Promise<void>((resolve) => {
      this.speakResolve = resolve;

      const source = this.audioCtx!.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = 1.0; // speed already baked into waveform
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
      try {
        this.currentSource.stop();
      } catch (_) {
        /* ignore */
      }
      this.currentSource = null;
    }
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
