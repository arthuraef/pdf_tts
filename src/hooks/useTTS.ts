import { useState, useEffect, useRef, useCallback } from 'react';
import { TTSEngine } from '../core/tts-engine';
import { buildChunksFromPages } from '../core/text-chunker';
import { savePlaybackProgress, getPlaybackProgress } from '../storage/db';
import type { StoredDocument, TextChunk } from '../types';

export function useTTS(document: StoredDocument | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const ttsRef = useRef<TTSEngine | null>(null);

  // Initialize engine once
  useEffect(() => {
    ttsRef.current = new TTSEngine({
      onChunkStart: (index) => {
        setCurrentChunkIndex(index);
      },
      onStateChange: (playing, paused) => {
        setIsPlaying(playing);
        setIsPaused(paused);
      },
      onEnd: () => {
        setIsPlaying(false);
        setIsPaused(false);
      },
      onVoicesLoaded: (voices) => {
        setAvailableVoices(voices);
        const top = voices[0]?.voiceURI;
        if (top) {
          setSelectedVoiceURI((prev) => prev || top);
        }
      },
    });

    const initialVoices = ttsRef.current.getPortugueseVoices();
    if (initialVoices.length > 0) {
      setAvailableVoices(initialVoices);
      setSelectedVoiceURI(initialVoices[0].voiceURI);
    }

    return () => {
      ttsRef.current?.stop();
    };
  }, []);

  // When active document changes, prepare chunks and restore progress
  useEffect(() => {
    if (!document) {
      setChunks([]);
      setCurrentChunkIndex(0);
      ttsRef.current?.stop();
      return;
    }

    const docChunks = buildChunksFromPages(document.pages);
    setChunks(docChunks);

    // Fetch saved state from IndexedDB
    if (document.id) {
      getPlaybackProgress(document.id).then((saved) => {
        if (saved) {
          const restoredIndex = Math.min(saved.chunkIndex, docChunks.length - 1);
          const restoredRate = saved.playbackRate || 1.0;
          setCurrentChunkIndex(restoredIndex >= 0 ? restoredIndex : 0);
          setRate(restoredRate);
          ttsRef.current?.setRate(restoredRate);
          ttsRef.current?.setChunks(docChunks, restoredIndex >= 0 ? restoredIndex : 0);
        } else {
          ttsRef.current?.setChunks(docChunks, 0);
        }
      });
    } else {
      ttsRef.current?.setChunks(docChunks, 0);
    }
  }, [document]);

  // Save progress periodically and on index change
  useEffect(() => {
    if (document?.id && chunks.length > 0) {
      const currentChunk = chunks[currentChunkIndex];
      const pageIndex = currentChunk ? currentChunk.pageIndex : 0;
      savePlaybackProgress(document.id, pageIndex, currentChunkIndex, rate);
    }
  }, [document?.id, currentChunkIndex, rate, chunks]);

  const handlePlay = useCallback(() => {
    ttsRef.current?.play();
  }, []);

  const handlePause = useCallback(() => {
    ttsRef.current?.pause();
  }, []);

  const handleResume = useCallback(() => {
    ttsRef.current?.resume();
  }, []);

  const handleSkipBackward = useCallback(() => {
    ttsRef.current?.skip(-10);
  }, []);

  const handleSkipForward = useCallback(() => {
    ttsRef.current?.skip(10);
  }, []);

  const handleRateChange = useCallback((newRate: number) => {
    setRate(newRate);
    ttsRef.current?.setRate(newRate);
  }, []);

  const handleVoiceChange = useCallback((voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    ttsRef.current?.setVoice(voiceURI);
  }, []);

  const currentChunk = chunks[currentChunkIndex];
  const currentPage = currentChunk ? currentChunk.pageIndex + 1 : 1;

  return {
    isPlaying,
    isPaused,
    rate,
    currentChunkIndex,
    totalChunks: chunks.length,
    currentPage,
    currentChunkText: currentChunk?.text || '',
    availableVoices,
    selectedVoiceURI,
    play: handlePlay,
    pause: handlePause,
    resume: handleResume,
    skipBackward: handleSkipBackward,
    skipForward: handleSkipForward,
    setRate: handleRateChange,
    setVoice: handleVoiceChange,
  };
}
