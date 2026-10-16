import { useState, useEffect, useRef, useCallback } from 'react';
import { TTSEngine } from '../core/tts-engine';
import { KokoroEngine, KOKORO_BR_VOICES, type KokoroStatus } from '../core/kokoro-engine';
import { buildChunksFromPages } from '../core/text-chunker';
import { savePlaybackProgress, getPlaybackProgress } from '../storage/db';
import type { StoredDocument, TextChunk, VoiceOption } from '../types';

// --- Voice ID constants -------------------------------------------------
const KOKORO_PREFIX = 'kokoro:';

function isKokoroId(id: string) {
  return id.startsWith(KOKORO_PREFIX);
}

function kokoroVoiceId(id: string) {
  return id.replace(KOKORO_PREFIX, '');
}

// --- Build curated voice list ------------------------------------------
function buildVoiceList(rawVoices: SpeechSynthesisVoice[]): VoiceOption[] {
  const options: VoiceOption[] = [];

  // Sort the raw pt voices by quality score (same algorithm as tts-engine)
  const scored = rawVoices.map((v) => {
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase().replace('_', '-');
    let score = 0;
    if (lang === 'pt-br') score += 50;
    if (/natural|neural|online/.test(name)) score += 40;
    if (/google/.test(name)) score += 30;
    if (/premium|enhanced|siri/.test(name)) score += 35;
    if (v.localService) score -= 5;
    return { voice: v, score };
  }).sort((a, b) => b.score - a.score);

  // 1. Top "high quality" voice → always Claudia (BR)
  const top = scored[0];
  if (top) {
    options.push({
      id: top.voice.voiceURI,
      label: 'Claudia (BR) ✨ Alta Qualidade',
      engine: 'native',
      nativeVoice: top.voice,
    });
  }

  // 2. Luciana (BR) – classic Brazilian iOS/macOS voice
  const luciana = scored.find((s) => /luciana/i.test(s.voice.name) && s.voice !== top?.voice);
  if (luciana) {
    options.push({
      id: luciana.voice.voiceURI,
      label: 'Luciana (BR)',
      engine: 'native',
      nativeVoice: luciana.voice,
    });
  }

  // 3. Joana (PT) – Portuguese (Portugal) – keep for comparison
  const joana = scored.find((s) => /joana/i.test(s.voice.name));
  if (joana) {
    options.push({
      id: joana.voice.voiceURI,
      label: 'Joana (PT)',
      engine: 'native',
      nativeVoice: joana.voice,
    });
  }

  // 4. Kokoro AI pt-BR voices
  for (const kv of KOKORO_BR_VOICES) {
    options.push({
      id: `${KOKORO_PREFIX}${kv.id}`,
      label: kv.label,
      engine: 'kokoro',
      kokoroVoiceId: kv.id,
    });
  }

  return options;
}

// -----------------------------------------------------------------------

export function useTTS(document: StoredDocument | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [kokoroStatus, setKokoroStatus] = useState<KokoroStatus>('idle');

  const nativeRef = useRef<TTSEngine | null>(null);
  const kokoroRef = useRef<KokoroEngine | null>(null);

  // ---- Initialize engines once on mount --------------------------------
  useEffect(() => {
    const handleEnd = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setIsFinished(true);
    };

    // Native TTS engine
    nativeRef.current = new TTSEngine({
      onChunkStart: (index) => setCurrentChunkIndex(index),
      onStateChange: (playing, paused) => {
        setIsPlaying(playing);
        setIsPaused(paused);
      },
      onEnd: handleEnd,
      onVoicesLoaded: (rawVoices) => {
        const list = buildVoiceList(rawVoices);
        setVoiceOptions(list);
        setSelectedVoiceId((prev) => prev || list[0]?.id || '');
        // Auto-select best native voice in native engine
        const topNative = list.find((v) => v.engine === 'native');
        if (topNative?.nativeVoice) {
          nativeRef.current?.setVoice(topNative.nativeVoice.voiceURI);
        }
      },
    });

    // Seed from voices already available synchronously
    const initial = nativeRef.current.getPortugueseVoices();
    if (initial.length > 0) {
      const list = buildVoiceList(initial);
      setVoiceOptions(list);
      setSelectedVoiceId(list[0]?.id || '');
      if (list[0]?.nativeVoice) {
        nativeRef.current.setVoice(list[0].nativeVoice.voiceURI);
      }
    } else {
      // No native voices yet — seed Kokoro-only list
      const kokoroOnly = buildVoiceList([]);
      setVoiceOptions(kokoroOnly);
      setSelectedVoiceId(kokoroOnly[0]?.id || '');
    }

    // Kokoro engine
    kokoroRef.current = new KokoroEngine((s) => setKokoroStatus(s));

    return () => {
      nativeRef.current?.stop();
      kokoroRef.current?.stop();
    };
  }, []);

  // ---- Load document ---------------------------------------------------
  useEffect(() => {
    if (!document) {
      setChunks([]);
      setCurrentChunkIndex(0);
      setIsFinished(false);
      nativeRef.current?.stop();
      kokoroRef.current?.stop();
      return;
    }

    const docChunks = buildChunksFromPages(document.pages);
    setChunks(docChunks);
    nativeRef.current?.setChunks(docChunks, 0);

    if (document.id) {
      getPlaybackProgress(document.id).then((saved) => {
        if (saved) {
          const idx = Math.min(saved.chunkIndex, docChunks.length - 1);
          const r = [1.0, 1.5, 2.0].includes(saved.playbackRate) ? saved.playbackRate : 1.0;
          const safeIdx = idx >= 0 ? idx : 0;
          setCurrentChunkIndex(safeIdx);
          setRate(r);
          nativeRef.current?.setRate(r);
          nativeRef.current?.setChunks(docChunks, safeIdx);
          if (docChunks.length > 0 && safeIdx >= docChunks.length - 1) {
            setIsFinished(true);
          } else {
            setIsFinished(false);
          }
        } else {
          nativeRef.current?.setChunks(docChunks, 0);
          setIsFinished(false);
        }
      });
    }
  }, [document]);

  // ---- Save progress --------------------------------------------------
  useEffect(() => {
    if (document?.id && chunks.length > 0) {
      const cur = chunks[currentChunkIndex];
      savePlaybackProgress(document.id, cur?.pageIndex ?? 0, currentChunkIndex, rate);
    }
  }, [document?.id, currentChunkIndex, rate, chunks]);

  // Ref used to abort the Kokoro chunk loop when the user stops/pauses
  const kokoroAbortRef = useRef<{ aborted: boolean }>({ aborted: false });

  // ---- Kokoro sequential chunk player ---------------------------------
  const kokoroPlayChunk = useCallback(async (
    startIndex: number,
    currentRate: number,
    abortSignal: { aborted: boolean },
  ) => {
    const engine = kokoroRef.current;
    if (!engine) return;

    // Load model if not ready
    if (!engine.isReady()) {
      try {
        await engine.load();
      } catch (e) {
        console.error('[useTTS] Kokoro load failed:', e);
        setIsPlaying(false);
        return;
      }
    }

    // Bail if aborted during load
    if (abortSignal.aborted) return;

    const voiceId = kokoroVoiceId(selectedVoiceId);
    engine.setVoice(voiceId);

    let index = startIndex;
    while (!abortSignal.aborted) {
      if (index >= chunks.length) break;

      setCurrentChunkIndex(index);

      try {
        await engine.speak(chunks[index].text, currentRate);
      } catch (e) {
        console.error(`[useTTS] Kokoro speak error on chunk ${index}:`, e);
        setIsPlaying(false);
        setIsPaused(false);
        return;
      }

      if (abortSignal.aborted) break;

      index += 1;
    }

    if (!abortSignal.aborted && index >= chunks.length) {
      // Reached end of document naturally
      setIsPlaying(false);
      setIsPaused(false);
      setIsFinished(true);
    }
  }, [chunks, selectedVoiceId]);

  // ---- Public controls ------------------------------------------------

  /** Abort any running Kokoro loop and start a new one from `index`. */
  const startKokoro = useCallback((index: number, currentRate: number) => {
    kokoroAbortRef.current.aborted = true; // abort old loop
    kokoroRef.current?.stop(); // stop audio
    const signal = { aborted: false };
    kokoroAbortRef.current = signal;
    setIsPlaying(true);
    setIsPaused(false);
    setIsFinished(false);
    kokoroPlayChunk(index, currentRate, signal);
  }, [kokoroPlayChunk]);

  const handlePlay = useCallback(() => {
    setIsFinished(false);
    if (isKokoroId(selectedVoiceId)) {
      kokoroRef.current?.initAudio();
      startKokoro(currentChunkIndex, rate);
    } else {
      nativeRef.current?.play();
    }
  }, [selectedVoiceId, currentChunkIndex, rate, startKokoro]);

  const handlePause = useCallback(() => {
    if (isKokoroId(selectedVoiceId)) {
      kokoroAbortRef.current.aborted = true;
      kokoroRef.current?.stop();
      setIsPlaying(false);
      setIsPaused(true);
    } else {
      nativeRef.current?.pause();
    }
  }, [selectedVoiceId]);

  const handleResume = useCallback(() => {
    setIsFinished(false);
    if (isKokoroId(selectedVoiceId)) {
      kokoroRef.current?.initAudio();
      startKokoro(currentChunkIndex, rate);
    } else {
      nativeRef.current?.resume();
    }
  }, [selectedVoiceId, currentChunkIndex, rate, startKokoro]);

  const handleRestart = useCallback(() => {
    kokoroAbortRef.current.aborted = true;
    nativeRef.current?.stop();
    kokoroRef.current?.stop();
    setCurrentChunkIndex(0);
    setIsFinished(false);
    setIsPaused(false);

    if (document?.id) {
      savePlaybackProgress(document.id, 0, 0, rate);
    }

    if (isKokoroId(selectedVoiceId)) {
      kokoroRef.current?.initAudio();
      startKokoro(0, rate);
    } else {
      nativeRef.current?.setChunks(chunks, 0);
      nativeRef.current?.play();
    }
  }, [document?.id, rate, selectedVoiceId, chunks, startKokoro]);

  const handleSkipBackward = useCallback(() => {
    setIsFinished(false);
    if (isKokoroId(selectedVoiceId)) {
      const next = Math.max(0, currentChunkIndex - 2);
      if (isPlaying) {
        startKokoro(next, rate);
      } else {
        setCurrentChunkIndex(next);
      }
    } else {
      nativeRef.current?.skip(-10);
    }
  }, [selectedVoiceId, currentChunkIndex, isPlaying, rate, startKokoro]);

  const handleSkipForward = useCallback(() => {
    if (isKokoroId(selectedVoiceId)) {
      const next = Math.min(chunks.length - 1, currentChunkIndex + 2);
      if (next >= chunks.length - 1) {
        setIsFinished(true);
      } else {
        setIsFinished(false);
      }
      if (isPlaying) {
        startKokoro(next, rate);
      } else {
        setCurrentChunkIndex(next);
      }
    } else {
      nativeRef.current?.skip(10);
    }
  }, [selectedVoiceId, currentChunkIndex, isPlaying, rate, chunks.length, startKokoro]);

  const handleRateChange = useCallback((newRate: number) => {
    setRate(newRate);
    nativeRef.current?.setRate(newRate);
  }, []);

  const handleVoiceChange = useCallback((voiceId: string) => {
    // Stop whatever is playing
    kokoroAbortRef.current.aborted = true;
    nativeRef.current?.stop();
    kokoroRef.current?.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setSelectedVoiceId(voiceId);

    if (!isKokoroId(voiceId)) {
      // Switch native engine to this voice
      const option = voiceOptions.find((v) => v.id === voiceId);
      if (option?.nativeVoice) {
        nativeRef.current?.setVoice(option.nativeVoice.voiceURI);
        nativeRef.current?.setChunks(chunks, currentChunkIndex);
      }
    } else if (kokoroRef.current?.getStatus() === 'idle') {
      // Pre-load Kokoro model in background when first Kokoro voice selected
      kokoroRef.current.load().catch(console.error);
    }
  }, [voiceOptions, chunks, currentChunkIndex]);

  const currentChunk = chunks[currentChunkIndex];
  const currentPage = currentChunk ? currentChunk.pageIndex + 1 : 1;

  return {
    isPlaying,
    isPaused,
    isFinished,
    rate,
    currentChunkIndex,
    totalChunks: chunks.length,
    currentPage,
    currentChunkText: currentChunk?.text || '',
    voiceOptions,
    selectedVoiceId,
    kokoroStatus,
    play: handlePlay,
    pause: handlePause,
    resume: handleResume,
    restart: handleRestart,
    skipBackward: handleSkipBackward,
    skipForward: handleSkipForward,
    setRate: handleRateChange,
    setVoice: handleVoiceChange,
  };
}
