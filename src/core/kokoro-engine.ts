import { KokoroTTS } from 'kokoro-js';

// Kokoro pt-BR voices (native)
export interface KokoroVoiceOption {
  id: string;       // e.g. "pf_dora"
  label: string;    // displayed in UI
  gender: 'female' | 'male';
}

export const KOKORO_BR_VOICES: KokoroVoiceOption[] = [
  { id: 'pf_dora', label: 'Dora ✨ (Kokoro AI • BR)', gender: 'female' },
  { id: 'pm_alex', label: 'Alex ✨ (Kokoro AI • BR)', gender: 'male' },
  { id: 'pm_santa', label: 'Santa ✨ (Kokoro AI • BR)', gender: 'male' },
];

export type KokoroStatus = 'idle' | 'loading' | 'ready' | 'error';

export class KokoroEngine {
  private tts: KokoroTTS | null = null;
  private status: KokoroStatus = 'idle';
  private currentVoice: string = 'pf_dora';
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlaying = false;
  private onStatusChange?: (s: KokoroStatus) => void;
  private onEnd?: () => void;
  private abortController: AbortController | null = null;

  constructor(onStatusChange?: (s: KokoroStatus) => void, onEnd?: () => void) {
    this.onStatusChange = onStatusChange;
    this.onEnd = onEnd;
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

  public async load(): Promise<void> {
    if (this.tts || this.status === 'loading') return;

    this.setStatus('loading');
    try {
      this.tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: 'wasm',
      });
      this.setStatus('ready');
    } catch (e) {
      console.error('Kokoro load error:', e);
      this.setStatus('error');
      throw e;
    }
  }

  public async speak(text: string, rate: number = 1.0): Promise<void> {
    if (!this.tts) {
      await this.load();
    }
    if (!this.tts) return;

    this.stop();
    this.isPlaying = true;
    this.abortController = new AbortController();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const audio = await (this.tts as any).generate(text, { voice: this.currentVoice });

      if (this.abortController.signal.aborted || !this.isPlaying) return;

      const wavUint8: Uint8Array = audio.toWav();
      const arrayBuffer = wavUint8.buffer.slice(
        wavUint8.byteOffset,
        wavUint8.byteOffset + wavUint8.byteLength,
      ) as ArrayBuffer;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
      }

      const decoded = await this.audioCtx.decodeAudioData(arrayBuffer.slice(0));

      if (this.abortController.signal.aborted || !this.isPlaying) return;

      const source = this.audioCtx.createBufferSource();
      source.buffer = decoded;

      // Apply rate via playbackRate (0.5x – 2x)
      source.playbackRate.value = rate;
      source.connect(this.audioCtx.destination);

      this.currentSource = source;
      source.onended = () => {
        if (this.isPlaying) {
          this.isPlaying = false;
          this.onEnd?.();
        }
      };
      source.start(0);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error('Kokoro speak error:', e);
      }
    }
  }

  public stop(): void {
    this.isPlaying = false;
    this.abortController?.abort();
    this.abortController = null;
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (_) { /* already stopped */ }
      this.currentSource = null;
    }
  }

  public isReady(): boolean {
    return this.status === 'ready' && this.tts !== null;
  }
}
