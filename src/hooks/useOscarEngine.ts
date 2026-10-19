import { useState, useEffect, useRef, useCallback } from 'react';
import { OscarEngine } from '../oscar-engine';
import { VOICE_STYLES } from '../oscar-engine/director/emotionalParser';
import type { ActingScoreChunk, VoiceStyle, VoiceStyleDefinition } from '../oscar-engine/types';
import { savePlaybackProgress, getPlaybackProgress } from '../storage/db';
import type { StoredDocument, VoiceOption } from '../types';

export function useOscarEngine(document: StoredDocument | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [chunks, setChunks] = useState<ActingScoreChunk[]>([]);
  const [highlightWord, setHighlightWord] = useState<{ index: number; length: number } | null>(null);

  // Flags dos superpoderes do Oscar Engine
  const [bionicEnabled, setBionicEnabled] = useState(true);
  const [spatialAudioEnabled, setSpatialAudioEnabled] = useState(true);
  const [breathEnabled, setBreathEnabled] = useState(true);

  // Seleção de Estilo de Voz e Vozes
  const [voiceStyle, setVoiceStyleState] = useState<VoiceStyle>('dramatic');
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');

  const engineRef = useRef<OscarEngine | null>(null);

  // ---- Inicializa vozes disponíveis -------------------------------------
  const updateVoiceList = useCallback(() => {
    if (!engineRef.current) return;
    const rawVoices = engineRef.current.getAvailableVoices();
    const formatted: VoiceOption[] = rawVoices.map((v) => {
      let label = v.name;
      if (/francisca/i.test(v.name)) label = 'Francisca ✨ Alta Fidelidade';
      else if (/antonio/i.test(v.name)) label = 'Antonio 🎭 Voz Masculina';
      else if (/thalita/i.test(v.name)) label = 'Thalita 🌟 Voz Expressiva';
      else if (/google/i.test(v.name)) label = 'Google Brasil (Online)';
      else if (/luciana/i.test(v.name)) label = 'Luciana (Natural)';
      else if (/felipe/i.test(v.name)) label = 'Felipe (Natural)';

      return {
        id: v.voiceURI,
        label,
        nativeVoice: v,
      };
    });

    setAvailableVoices(formatted);
    if (formatted.length > 0 && !selectedVoiceId) {
      setSelectedVoiceId(formatted[0].id);
      engineRef.current.setPrimaryVoice(formatted[0].id);
    }
  }, [selectedVoiceId]);

  // ---- Inicializa o Oscar Engine no mount -------------------------------
  useEffect(() => {
    engineRef.current = new OscarEngine(
      {
        onChunkStart: (chunk) => {
          const all = engineRef.current?.getScoreChunks() || [];
          const idx = all.findIndex((c) => c.id === chunk.id);
          if (idx !== -1) {
            setCurrentChunkIndex(idx);
          }
          setHighlightWord(null);
        },
        onPlaybackStateChange: (playing, paused) => {
          setIsPlaying(playing);
          setIsPaused(paused);
        },
        onNetworkFallback: (isOffline) => {
          setIsOfflineFallback(isOffline);
        },
        onWordBoundary: (charIndex, charLength) => {
          setHighlightWord({ index: charIndex, length: charLength });
        },
        onEnd: () => {
          setIsPlaying(false);
          setIsPaused(false);
          setIsFinished(true);
        },
      },
      {
        bionicPacingEnabled: bionicEnabled,
        spatialAudioEnabled: spatialAudioEnabled,
        breathInjectionEnabled: breathEnabled,
        basePlaybackRate: rate,
        voiceStyle,
      }
    );

    updateVoiceList();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoiceList;
    }

    return () => {
      engineRef.current?.stop();
    };
  }, []);

  // ---- Atualiza configs quando toggles mudarem --------------------------
  useEffect(() => {
    engineRef.current?.updateConfig({
      bionicPacingEnabled: bionicEnabled,
      spatialAudioEnabled: spatialAudioEnabled,
      breathInjectionEnabled: breathEnabled,
      basePlaybackRate: rate,
      voiceStyle,
      primaryVoice: selectedVoiceId,
    });
  }, [bionicEnabled, spatialAudioEnabled, breathEnabled, rate, voiceStyle, selectedVoiceId]);

  // ---- Carrega Documento no Engine --------------------------------------
  useEffect(() => {
    if (!document) {
      setChunks([]);
      setCurrentChunkIndex(0);
      setIsFinished(false);
      engineRef.current?.stop();
      return;
    }

    const rawPagesText = document.pages.map((p) => p.text);
    engineRef.current?.loadDocument(document.id || 1, rawPagesText, 0);

    const generatedChunks = engineRef.current?.getScoreChunks() || [];
    setChunks(generatedChunks);

    if (document.id) {
      getPlaybackProgress(document.id).then((saved) => {
        if (saved) {
          const idx = Math.min(saved.chunkIndex, generatedChunks.length - 1);
          const r =
            typeof saved.playbackRate === 'number' &&
            saved.playbackRate >= 1.0 &&
            saved.playbackRate <= 2.0
              ? parseFloat(saved.playbackRate.toFixed(2))
              : 1.0;
          const safeIdx = idx >= 0 ? idx : 0;
          setCurrentChunkIndex(safeIdx);
          setRate(r);
          engineRef.current?.setBasePlaybackRate(r);

          if (generatedChunks.length > 0 && safeIdx >= generatedChunks.length - 1) {
            setIsFinished(true);
          } else {
            setIsFinished(false);
          }
        } else {
          setIsFinished(false);
        }
      });
    }
  }, [document]);

  // ---- Salva progresso no IndexedDB ------------------------------------
  useEffect(() => {
    if (document?.id && chunks.length > 0) {
      const cur = chunks[currentChunkIndex];
      savePlaybackProgress(document.id, (cur?.pageNumber ?? 1) - 1, currentChunkIndex, rate);
    }
  }, [document?.id, currentChunkIndex, rate, chunks]);

  // ---- Controles Públicos ----------------------------------------------
  const handlePlay = useCallback(() => {
    setIsFinished(false);
    engineRef.current?.play(currentChunkIndex);
  }, [currentChunkIndex]);

  const handlePause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const handleResume = useCallback(() => {
    setIsFinished(false);
    engineRef.current?.resume();
  }, []);

  const handleRestart = useCallback(() => {
    engineRef.current?.stop();
    setCurrentChunkIndex(0);
    setIsFinished(false);
    setIsPaused(false);

    if (document?.id) {
      savePlaybackProgress(document.id, 0, 0, rate);
    }

    engineRef.current?.play(0);
  }, [document?.id, rate]);

  const handleSkipBackward = useCallback(() => {
    setIsFinished(false);
    engineRef.current?.skip(-10);
    if (engineRef.current) {
      setCurrentChunkIndex(engineRef.current.getCurrentIndex());
    }
  }, []);

  const handleSkipForward = useCallback(() => {
    engineRef.current?.skip(10);
    if (engineRef.current) {
      setCurrentChunkIndex(engineRef.current.getCurrentIndex());
    }
  }, []);

  const handleJumpToPage = useCallback(
    (targetPage1Based: number) => {
      if (chunks.length === 0) return;

      let targetChunkIndex = chunks.findIndex((c) => c.pageNumber === targetPage1Based);
      if (targetChunkIndex === -1) {
        targetChunkIndex = chunks.findIndex((c) => c.pageNumber > targetPage1Based);
      }
      if (targetChunkIndex === -1) {
        targetChunkIndex = chunks.length - 1;
      }

      const wasPlaying = isPlaying;
      engineRef.current?.stop();

      setIsFinished(targetChunkIndex >= chunks.length - 1);
      setCurrentChunkIndex(targetChunkIndex);

      if (document?.id) {
        const cur = chunks[targetChunkIndex];
        savePlaybackProgress(document.id, (cur?.pageNumber ?? 1) - 1, targetChunkIndex, rate);
      }

      if (wasPlaying) {
        engineRef.current?.play(targetChunkIndex);
      }
    },
    [chunks, document?.id, rate, isPlaying]
  );

  const handleRateChange = useCallback((newRate: number) => {
    const cleanRate = parseFloat(newRate.toFixed(2));
    setRate(cleanRate);
    engineRef.current?.setBasePlaybackRate(cleanRate);
  }, []);

  const handleVoiceStyleChange = useCallback((style: VoiceStyle) => {
    setVoiceStyleState(style);
    engineRef.current?.setVoiceStyle(style);
    const newChunks = engineRef.current?.getScoreChunks() || [];
    setChunks(newChunks);
  }, []);

  const handleVoiceChange = useCallback((voiceURI: string) => {
    setSelectedVoiceId(voiceURI);
    engineRef.current?.setPrimaryVoice(voiceURI);
    const newChunks = engineRef.current?.getScoreChunks() || [];
    setChunks(newChunks);
  }, []);

  const handleExportAudio = useCallback(async () => {
    const currentChunk = chunks[currentChunkIndex];
    const pageNum = currentChunk ? currentChunk.pageNumber : 1;
    if (engineRef.current) {
      return await engineRef.current.exportChapterAudio(pageNum);
    }
    return null;
  }, [chunks, currentChunkIndex]);

  const currentChunk = chunks[currentChunkIndex];
  const currentPage = currentChunk ? currentChunk.pageNumber : 1;
  const voiceStylesList: VoiceStyleDefinition[] = Object.values(VOICE_STYLES);

  return {
    isPlaying,
    isPaused,
    isFinished,
    isOfflineFallback,
    rate,
    currentChunkIndex,
    totalChunks: chunks.length,
    currentPage,
    currentChunkText: currentChunk?.cleanText || '',
    currentChunkRole: currentChunk?.role || 'narrator',
    currentVoiceId: selectedVoiceId || currentChunk?.voiceId || 'pt-BR-FranciscaNeural',
    highlightWord,
    bionicEnabled,
    spatialAudioEnabled,
    breathEnabled,
    voiceStyle,
    voiceStylesList,
    availableVoices,
    selectedVoiceId,
    setVoiceStyle: handleVoiceStyleChange,
    setVoice: handleVoiceChange,
    toggleBionic: () => setBionicEnabled((prev) => !prev),
    toggleSpatialAudio: () => setSpatialAudioEnabled((prev) => !prev),
    toggleBreath: () => setBreathEnabled((prev) => !prev),
    play: handlePlay,
    pause: handlePause,
    resume: handleResume,
    restart: handleRestart,
    skipBackward: handleSkipBackward,
    skipForward: handleSkipForward,
    goToPage: handleJumpToPage,
    setRate: handleRateChange,
    exportAudio: handleExportAudio,
  };
}
