import { useState, useEffect, useRef, useCallback } from 'react';
import { OscarEngine, webAudioStage } from '../oscar-engine';
import { VOICE_STYLES } from '../oscar-engine/director/emotionalParser';
import type {
  ActingScoreChunk,
  VoiceStyle,
  VoiceStyleDefinition,
  VoiceStudioEnhancerConfig,
  VoiceStudioPresetId,
  VoiceStudioModelId,
} from '../oscar-engine/types';
import { VOICESTUDIO_PRESETS, VOICESTUDIO_MODELS } from '../oscar-engine/types';
import { savePlaybackProgress, getPlaybackProgress, saveHighlight } from '../storage/db';
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
  const [breathEnabled, setBreathEnabled] = useState(false);

  // Seleção de Estilo de Voz e Vozes (Apenas Narrador, Dinâmico e Calmo)
  const [voiceStyle, setVoiceStyleState] = useState<VoiceStyle>('classic');
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');

  // 🎙️ Seletor de Modelo de Voz (Google Brasil HD como padrão + Modelos VoiceStudio)
  const [selectedModelId, setSelectedModelIdState] = useState<VoiceStudioModelId>(() => {
    try {
      const saved = localStorage.getItem('pdf_voice_selected_model');
      if (saved && VOICESTUDIO_MODELS.some((m) => m.id === saved)) {
        return saved as VoiceStudioModelId;
      }
    } catch {
      // ignore
    }
    return 'google_brasil';
  });

  const activeVoiceModel =
    VOICESTUDIO_MODELS.find((m) => m.id === selectedModelId) || VOICESTUDIO_MODELS[0];
  const isCurrentVoiceVoiceStudio = selectedModelId.startsWith('voicestudio_');

  // 🎛️ VoiceStudio Audio Enhancer (Configuração de Áudio para voz Google Brasil HD)
  const [voiceStudioConfig, setVoiceStudioConfigState] = useState<VoiceStudioEnhancerConfig>(() => {
    try {
      const saved = localStorage.getItem('pdf_voice_voicestudio_enhancer');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {
      enabled: true,
      preset: 'warm_audiobook',
      ...VOICESTUDIO_PRESETS.warm_audiobook.config,
    };
  });

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
      else if (/leticia/i.test(v.name)) label = 'Leticia (Natural)';

      return {
        id: v.voiceURI,
        label,
        nativeVoice: v,
      };
    });

    setAvailableVoices(formatted);
    setSelectedVoiceId((prev) => {
      if (prev && formatted.some((f) => f.id === prev)) {
        return prev;
      }
      if (formatted.length > 0) {
        engineRef.current?.setPrimaryVoice(formatted[0].id);
        return formatted[0].id;
      }
      return '';
    });
  }, []);

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
        selectedModelId,
      }
    );

    updateVoiceList();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', updateVoiceList);
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.removeEventListener('voiceschanged', updateVoiceList);
      }
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
    });
  }, [bionicEnabled, spatialAudioEnabled, breathEnabled, rate]);

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

  // ---- Salva progresso no IndexedDB com throttling inteligente --------
  const lastSavedPageRef = useRef<number>(-1);
  const currentChunk = chunks[currentChunkIndex];
  const currentPage = currentChunk ? currentChunk.pageNumber : 1;

  // 1. Salva ao trocar de página
  useEffect(() => {
    if (document?.id && chunks.length > 0) {
      if (currentPage !== lastSavedPageRef.current) {
        lastSavedPageRef.current = currentPage;
        savePlaybackProgress(document.id, currentPage - 1, currentChunkIndex, rate);
      }
    }
  }, [document?.id, currentPage, currentChunkIndex, rate, chunks.length]);

  // 2. Salva ao pausar ou parar
  useEffect(() => {
    if (document?.id && !isPlaying && chunks.length > 0) {
      const cur = chunks[currentChunkIndex];
      savePlaybackProgress(document.id, (cur?.pageNumber ?? 1) - 1, currentChunkIndex, rate);
    }
  }, [isPlaying, document?.id, currentChunkIndex, rate, chunks]);

  // 3. Salva ao minimizar app ou fechar aba (evita I/O constante a cada palavra)
  useEffect(() => {
    const handleVisibility = () => {
      if (document?.id && window.document.visibilityState === 'hidden' && chunks.length > 0) {
        const cur = chunks[currentChunkIndex];
        savePlaybackProgress(document.id, (cur?.pageNumber ?? 1) - 1, currentChunkIndex, rate);
      }
    };
    const handleUnload = () => {
      if (document?.id && chunks.length > 0) {
        const cur = chunks[currentChunkIndex];
        savePlaybackProgress(document.id, (cur?.pageNumber ?? 1) - 1, currentChunkIndex, rate);
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
    };
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
    engineRef.current?.skipSentence(-1);
    if (engineRef.current) {
      setCurrentChunkIndex(engineRef.current.getCurrentIndex());
    }
  }, []);

  const handleSkipForward = useCallback(() => {
    engineRef.current?.skipSentence(1);
    if (engineRef.current) {
      setCurrentChunkIndex(engineRef.current.getCurrentIndex());
    }
  }, []);

  const handleHighlightCurrent = useCallback(async () => {
    if (!document?.id || chunks.length === 0) return;
    const cur = chunks[currentChunkIndex];
    if (!cur) return;

    webAudioStage.playChime();
    await saveHighlight(document.id, cur.pageNumber, currentChunkIndex, cur.cleanText);
  }, [document?.id, chunks, currentChunkIndex]);

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

  const handlePreviewVoice = useCallback((voiceURI: string) => {
    engineRef.current?.preview('Olá! Esta é uma demonstração desta voz neural.', voiceURI, voiceStyle);
  }, [voiceStyle]);

  const handlePreviewStyle = useCallback((style: VoiceStyle) => {
    const styleDef = VOICE_STYLES[style] || VOICE_STYLES.classic;
    engineRef.current?.preview(`Demonstração do estilo ${styleDef.label}.`, selectedVoiceId, style);
  }, [selectedVoiceId]);

  const voiceStylesList: VoiceStyleDefinition[] = [
    VOICE_STYLES.classic,
    VOICE_STYLES.dynamic,
    VOICE_STYLES.calm,
  ];

  const handleVoiceStudioConfigChange = useCallback((patch: Partial<VoiceStudioEnhancerConfig>) => {
    setVoiceStudioConfigState((prev) => {
      const updated = { ...prev, ...patch };
      try {
        localStorage.setItem('pdf_voice_voicestudio_enhancer', JSON.stringify(updated));
      } catch {
        // ignore
      }
      engineRef.current?.setVoiceStudioConfig(updated);
      return updated;
    });
  }, []);

  const handleVoiceStudioPresetChange = useCallback((presetId: VoiceStudioPresetId) => {
    const presetDef = VOICESTUDIO_PRESETS[presetId];
    if (!presetDef) return;

    setVoiceStudioConfigState((prev) => {
      const updated: VoiceStudioEnhancerConfig = {
        ...prev,
        enabled: true,
        preset: presetId,
        ...presetDef.config,
      };
      try {
        localStorage.setItem('pdf_voice_voicestudio_enhancer', JSON.stringify(updated));
      } catch {
        // ignore
      }
      engineRef.current?.setVoiceStudioConfig(updated);
      return updated;
    });
  }, []);

  const handleModelChange = useCallback((modelId: VoiceStudioModelId) => {
    setSelectedModelIdState(modelId);
    try {
      localStorage.setItem('pdf_voice_selected_model', modelId);
    } catch {
      // ignore
    }
    engineRef.current?.setSelectedModelId(modelId);

    const modelDef = VOICESTUDIO_MODELS.find((m) => m.id === modelId);
    if (modelDef?.engine === 'voicestudio' && modelDef.defaultPreset) {
      const presetDef = VOICESTUDIO_PRESETS[modelDef.defaultPreset];
      if (presetDef) {
        setVoiceStudioConfigState((prev) => {
          const updated: VoiceStudioEnhancerConfig = {
            ...prev,
            enabled: true,
            preset: modelDef.defaultPreset!,
            ...presetDef.config,
            pitchShift:
              typeof modelDef.defaultPitchShift === 'number'
                ? modelDef.defaultPitchShift
                : presetDef.config.pitchShift,
            pacingMultiplier:
              typeof modelDef.defaultPacing === 'number'
                ? modelDef.defaultPacing
                : presetDef.config.pacingMultiplier,
          };
          try {
            localStorage.setItem('pdf_voice_voicestudio_enhancer', JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });
      }
    }
  }, []);

  const handlePreviewVoiceStudio = useCallback(
    (sampleText?: string) => {
      engineRef.current?.previewVoiceStudio(
        sampleText,
        selectedVoiceId,
        voiceStudioConfig,
        selectedModelId
      );
    },
    [selectedVoiceId, voiceStudioConfig, selectedModelId]
  );

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
    previousChunkText: currentChunkIndex > 0 ? chunks[currentChunkIndex - 1]?.cleanText : undefined,
    nextChunkText: currentChunkIndex < chunks.length - 1 ? chunks[currentChunkIndex + 1]?.cleanText : undefined,
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
    selectedModelId,
    activeVoiceModel,
    isCurrentVoiceVoiceStudio,
    setModel: handleModelChange,
    availableVoiceModels: VOICESTUDIO_MODELS,
    voiceStudioConfig,
    setVoiceStudioConfig: handleVoiceStudioConfigChange,
    setVoiceStudioPreset: handleVoiceStudioPresetChange,
    previewVoiceStudio: handlePreviewVoiceStudio,
    setVoiceStyle: handleVoiceStyleChange,
    setVoice: handleVoiceChange,
    previewVoice: handlePreviewVoice,
    previewStyle: handlePreviewStyle,
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
    highlightCurrent: handleHighlightCurrent,
    exportAudio: handleExportAudio,
  };
}
