import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Gauge, Mic, Smartphone, Star, BookOpen, Clock } from 'lucide-react';
import type { VoiceOption } from '../types';

interface PlayerControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  isFinished: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  rate: number;
  onRateChange: (rate: number) => void;
  voices: VoiceOption[];
  selectedVoiceId: string;
  onVoiceChange: (id: string) => void;
  estimatedMinutes?: number;
  onTogglePocketMode?: () => void;
  onHighlightCurrent?: () => void;
  onOpenChapters?: () => void;
  hasChapters?: boolean;
  onOpenHighlights?: () => void;
  disabled?: boolean;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  isPaused,
  isFinished,
  onPlay,
  onPause,
  onResume,
  onRestart,
  onSkipBackward,
  onSkipForward,
  rate,
  onRateChange,
  voices,
  selectedVoiceId,
  onVoiceChange,
  estimatedMinutes,
  onTogglePocketMode,
  onHighlightCurrent,
  onOpenChapters,
  hasChapters = false,
  onOpenHighlights,
  disabled = false,
}) => {
  // Amortecedor (Debounce de 200ms) para o slider de velocidade
  const [localRate, setLocalRate] = useState<number>(rate);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalRate(rate);
  }, [rate]);

  const handleSliderChange = (newVal: number) => {
    setLocalRate(newVal);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onRateChange(newVal);
    }, 200);
  };

  const handlePlayToggle = () => {
    if (isFinished) {
      onRestart();
    } else if (isPlaying) {
      onPause();
    } else if (isPaused) {
      onResume();
    } else {
      onPlay();
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      {/* End of book notification banner */}
      {isFinished && !isPlaying && (
        <div className="bg-indigo-950/60 border border-indigo-500/30 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-indigo-200">
          <span className="flex items-center gap-2">
            <span>🎉</span>
            <span>Você concluiu a leitura deste livro!</span>
          </span>
          <button
            onClick={onRestart}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Ler novamente
          </button>
        </div>
      )}

      {/* Top Action Bar (Estimate badge, Pocket mode, Chapters, Highlights) */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          {typeof estimatedMinutes === 'number' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/60 text-emerald-300 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>~{estimatedMinutes} min restantes</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasChapters && onOpenChapters && (
            <button
              type="button"
              onClick={onOpenChapters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-indigo-300 hover:text-white border border-slate-700/60 text-xs font-medium transition cursor-pointer"
              title="Abrir índice e capítulos"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Capítulos</span>
            </button>
          )}

          {onOpenHighlights && (
            <button
              type="button"
              onClick={onOpenHighlights}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition cursor-pointer"
              title="Ver frases grifadas"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>Grifos</span>
            </button>
          )}

          {onTogglePocketMode && (
            <button
              type="button"
              onClick={onTogglePocketMode}
              disabled={disabled}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-200 border border-indigo-500/40 text-xs font-semibold transition cursor-pointer"
              title="Modo Bolso / Academia (tela preta AMOLED com botões gigantes)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Modo Bolso</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Speed Slider: 1x to 2x with 200ms debounce */}
        <div className="flex flex-col gap-2 bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-700/60 order-2 sm:order-1 w-full sm:w-72">
          <div className="flex items-center justify-between text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Gauge className="w-3.5 h-3.5 text-indigo-400" /> Velocidade:
            </span>
            <span className="font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md border border-indigo-500/30 font-mono">
              x{localRate.toFixed(2).replace('.', ',')}
            </span>
          </div>

          <input
            type="range"
            min="1"
            max="2"
            step="0.05"
            value={localRate}
            onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
          />

          <div className="flex justify-between text-[10px] font-semibold text-slate-400 px-0.5">
            {[1.0, 1.25, 1.5, 1.75, 2.0].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setLocalRate(val);
                  onRateChange(val);
                }}
                className={`hover:text-indigo-400 transition cursor-pointer ${
                  Math.abs(localRate - val) < 0.02 ? 'text-indigo-400 font-bold' : ''
                }`}
              >
                x{val.toFixed(1).replace('.', ',')}
              </button>
            ))}
          </div>
        </div>

        {/* Playback buttons (Voltar 1 Frase / Play / Avançar 1 Frase + Grifar) */}
        <div className="flex items-center gap-3 order-1 sm:order-2">
          {/* Voltar 1 Frase */}
          <button
            onClick={onSkipBackward}
            disabled={disabled}
            title="Voltar 1 frase inteira (ideia anterior)"
            className="px-3 py-2.5 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 transition active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-indigo-400" />
            <span className="text-xs font-semibold">1 Frase</span>
          </button>

          {/* Central Play/Pause button */}
          <button
            onClick={handlePlayToggle}
            disabled={disabled}
            title={
              isFinished
                ? 'Voltar ao início do livro'
                : isPlaying
                ? 'Pausar leitura'
                : 'Iniciar leitura'
            }
            className={`w-16 h-16 rounded-full text-white flex items-center justify-center shadow-lg transition transform active:scale-95 disabled:opacity-50 cursor-pointer ${
              isFinished
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
            }`}
          >
            {isFinished ? (
              <RotateCcw className="w-8 h-8" />
            ) : isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>

          {/* Avançar 1 Frase */}
          <button
            onClick={onSkipForward}
            disabled={disabled}
            title="Avançar 1 frase inteira (próxima ideia)"
            className="px-3 py-2.5 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 transition active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
          >
            <span className="text-xs font-semibold">1 Frase</span>
            <ChevronRight className="w-5 h-5 text-indigo-400" />
          </button>

          {/* Botão de Grifar Frase (Plim!) */}
          {onHighlightCurrent && (
            <button
              onClick={onHighlightCurrent}
              disabled={disabled}
              title="Grifar esta frase (Plim!)"
              className="p-3 rounded-xl text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Star className="w-5 h-5 fill-amber-400" />
            </button>
          )}
        </div>
      </div>

      {/* Voice Selector (if native list provided) */}
      {voices.length > 0 && (
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <label htmlFor="voice-select" className="text-slate-400 font-medium flex items-center gap-1.5 text-xs">
            <Mic className="w-3.5 h-3.5 text-indigo-400" />
            Voz de Leitura:
          </label>

          <select
            id="voice-select"
            value={selectedVoiceId}
            onChange={(e) => onVoiceChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition cursor-pointer"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
