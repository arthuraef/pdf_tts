import { useState, useEffect, useRef, useCallback } from 'react';
import { TTSEngine } from '../core/tts-engine';
import { buildChunksFromPages } from '../core/text-chunker';
import { savePlaybackProgress, getPlaybackProgress } from '../storage/db';
import type { StoredDocument, TextChunk, VoiceOption } from '../types';

// --- Build curated native voice list -----------------------------------
function buildVoiceList(rawVoices: SpeechSynthesisVoice[]): VoiceOption[] {
  const options: VoiceOption[] = [];

  // Sort Portuguese voices by quality score
  const scored = rawVoices
    .map((v) => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase().replace('_', '-');
      let score = 0;
      if (lang === 'pt-br') score += 50;
      if (/natural|neural|online/.test(name)) score += 40;
      if (/google/.test(name)) score += 30;
      if (/premium|enhanced|siri/.test(name)) score += 35;
      if (v.localService) score -= 5;
      return { voice: v, score };
    })
    .sort((a, b) => b.score - a.score);

  // 1. Top "high quality" voice → Claudia (BR)
  const top = scored[0];
  if (top) {
    options.push({
      id: top.voice.voiceURI,
      label: 'Claudia (BR) ✨ Alta Qualidade',
      nativeVoice: top.voice,
    });
  }

  // 2. Luciana (BR)
  const luciana = scored.find((s) => /luciana/i.test(s.voice.name) && s.voice !== top?.voice);
  if (luciana) {
    options.push({
      id: luciana.voice.voiceURI,
      label: 'Luciana (BR)',
      nativeVoice: luciana.voice,
    });
  }

  // 3. Joana (PT)
  const joana = scored.find((s) => /joana/i.test(s.voice.name));
  if (joana) {
    options.push({
      id: joana.voice.voiceURI,
      label: 'Joana (PT)',
      nativeVoice: joana.voice,
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

  const nativeRef = useRef<TTSEngine | null>(null);

  // ---- Initialize TTS engine on mount ---------------------------------
  useEffect(() => {
    const handleEnd = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setIsFinished(true);
    };

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
        if (list[0]?.nativeVoice) {
          nativeRef.current?.setVoice(list[0].nativeVoice.voiceURI);
        }
      },
    });

    const initial = nativeRef.current.getPortugueseVoices();
    if (initial.length > 0) {
      const list = buildVoiceList(initial);
      setVoiceOptions(list);
      setSelectedVoiceId(list[0]?.id || '');
      if (list[0]?.nativeVoice) {
        nativeRef.current.setVoice(list[0].nativeVoice.voiceURI);
      }
    }

    return () => {
      nativeRef.current?.stop();
    };
  }, []);

  // ---- Load document ---------------------------------------------------
  useEffect(() => {
    if (!document) {
      setChunks([]);
      setCurrentChunkIndex(0);
      setIsFinished(false);
      nativeRef.current?.stop();
      return;
    }

    const docChunks = buildChunksFromPages(document.pages);
    setChunks(docChunks);
    nativeRef.current?.setChunks(docChunks, 0);

    if (document.id) {
      getPlaybackProgress(document.id).then((saved) => {
        if (saved) {
          const idx = Math.min(saved.chunkIndex, docChunks.length - 1);
          const r =
            typeof saved.playbackRate === 'number' &&
            saved.playbackRate >= 1.0 &&
            saved.playbackRate <= 2.0
              ? parseFloat(saved.playbackRate.toFixed(2))
              : 1.0;
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

  // ---- Public controls ------------------------------------------------

  const handlePlay = useCallback(() => {
    setIsFinished(false);
    nativeRef.current?.play();
  }, []);

  const handlePause = useCallback(() => {
    nativeRef.current?.pause();
  }, []);

  const handleResume = useCallback(() => {
    setIsFinished(false);
    nativeRef.current?.resume();
  }, []);

  const handleRestart = useCallback(() => {
    nativeRef.current?.stop();
    setCurrentChunkIndex(0);
    setIsFinished(false);
    setIsPaused(false);

    if (document?.id) {
      savePlaybackProgress(document.id, 0, 0, rate);
    }

    nativeRef.current?.setChunks(chunks, 0);
    nativeRef.current?.play();
  }, [document?.id, rate, chunks]);

  const handleSkipBackward = useCallback(() => {
    setIsFinished(false);
    nativeRef.current?.skip(-10);
  }, []);

  const handleSkipForward = useCallback(() => {
    nativeRef.current?.skip(10);
  }, []);

  const handleJumpToPage = useCallback(
    (targetPage1Based: number) => {
      if (chunks.length === 0) return;
      const targetPageIndex = Math.max(0, targetPage1Based - 1);

      // Find the first chunk on this page
      let targetChunkIndex = chunks.findIndex((c) => c.pageIndex === targetPageIndex);

      // If page has no text, find next page with text
      if (targetChunkIndex === -1) {
        targetChunkIndex = chunks.findIndex((c) => c.pageIndex > targetPageIndex);
      }

      // If past end of text, clamp to last chunk
      if (targetChunkIndex === -1) {
        targetChunkIndex = chunks.length - 1;
      }

      const wasPlaying = isPlaying;
      nativeRef.current?.stop();

      setIsFinished(targetChunkIndex >= chunks.length - 1);
      setCurrentChunkIndex(targetChunkIndex);

      if (document?.id) {
        const cur = chunks[targetChunkIndex];
        savePlaybackProgress(document.id, cur?.pageIndex ?? 0, targetChunkIndex, rate);
      }

      nativeRef.current?.setChunks(chunks, targetChunkIndex);

      if (wasPlaying) {
        setIsPlaying(true);
        setIsPaused(false);
        nativeRef.current?.play();
      }
    },
    [chunks, document?.id, rate, isPlaying]
  );

  const handleRateChange = useCallback((newRate: number) => {
    const cleanRate = parseFloat(newRate.toFixed(2));
    setRate(cleanRate);
    nativeRef.current?.setRate(cleanRate);
  }, []);

  const handleVoiceChange = useCallback(
    (voiceId: string) => {
      nativeRef.current?.stop();
      setIsPlaying(false);
      setIsPaused(false);
      setSelectedVoiceId(voiceId);

      const option = voiceOptions.find((v) => v.id === voiceId);
      if (option?.nativeVoice) {
        nativeRef.current?.setVoice(option.nativeVoice.voiceURI);
        nativeRef.current?.setChunks(chunks, currentChunkIndex);
      }
    },
    [voiceOptions, chunks, currentChunkIndex]
  );

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
    play: handlePlay,
    pause: handlePause,
    resume: handleResume,
    restart: handleRestart,
    skipBackward: handleSkipBackward,
    skipForward: handleSkipForward,
    goToPage: handleJumpToPage,
    setRate: handleRateChange,
    setVoice: handleVoiceChange,
  };
}
