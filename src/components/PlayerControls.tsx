import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Gauge, Star, Sparkles } from 'lucide-react';
import type { VoiceStyle, VoiceStyleDefinition } from '../oscar-engine/types';

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
  voiceStyle: VoiceStyle;
  voiceStylesList: VoiceStyleDefinition[];
  onVoiceStyleChange: (style: VoiceStyle) => void;
  onHighlightCurrent?: () => void;
  onOpenVoiceStudio?: () => void;
  selectedModelLabel?: string;
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
  voiceStyle,
  voiceStylesList,
  onVoiceStyleChange,
  onHighlightCurrent,
  onOpenVoiceStudio,
  selectedModelLabel,
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

  const handlePresetRate = (val: number) => {
    setLocalRate(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onRateChange(val);
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

  // Filtrado estritamente para Narrador, Dinâmico e Calmo
  const allowedStyles: VoiceStyle[] = ['classic', 'dynamic', 'calm'];
  const displayStyles = voiceStylesList.filter((s) => allowedStyles.includes(s.id));

  return (
    <div className="w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
      {/* End of book celebration banner */}
      {isFinished && !isPlaying && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between text-xs text-emerald-200 animate-in fade-in duration-300">
          <span className="flex items-center gap-2">
            <span className="text-base">🎉</span>
            <span className="font-medium">Parabéns! Você concluiu a leitura deste livro!</span>
          </span>
          <button
            onClick={onRestart}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-4 flex items-center gap-1.5 cursor-pointer transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Ouvir novamente
          </button>
        </div>
      )}

      {/* 1. Narration Style Selector: Narrador, Dinâmico, Calmo */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
            Estilo de Narração
          </span>
          {onOpenVoiceStudio ? (
            <button
              type="button"
              onClick={onOpenVoiceStudio}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1 hover:underline cursor-pointer bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/20 transition"
              title="Abrir VoiceStudio • Trocar Modelo ou Ajustar Áudio"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>{selectedModelLabel || 'Google Brasil HD'}</span>
            </button>
          ) : (
            <span className="text-[10px] text-indigo-400 font-mono">
              Voz: {selectedModelLabel || 'Google Brasil HD'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800">
          {displayStyles.map((style) => {
            const isSelected = voiceStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => onVoiceStyleChange(style.id)}
                disabled={disabled}
                className={`py-2.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                }`}
              >
                <span>{style.emoji}</span>
                <span className="truncate">{style.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Main Playback Controls (Skip 1 Frase, Circular Play/Pause, Skip 1 Frase, Star) */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 py-2">
        {/* Voltar 1 Frase */}
        <button
          type="button"
          onClick={onSkipBackward}
          disabled={disabled}
          title="Voltar 1 frase inteira"
          className="px-3.5 py-3 rounded-2xl text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-750 active:scale-95 border border-slate-700/60 transition disabled:opacity-40 flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <ChevronLeft className="w-5 h-5 text-indigo-400" />
          <span className="text-xs font-semibold">1 Frase</span>
        </button>

        {/* Central Play/Pause Button - Inspired by Reference Images 2, 3 & 4 */}
        <button
          type="button"
          onClick={handlePlayToggle}
          disabled={disabled}
          title={
            isFinished
              ? 'Voltar ao início do livro'
              : isPlaying
              ? 'Pausar narração'
              : 'Iniciar narração instantânea'
          }
          className={`w-18 h-18 sm:w-20 sm:h-20 rounded-full text-white flex items-center justify-center shadow-xl transition-all duration-200 transform active:scale-95 disabled:opacity-40 cursor-pointer ${
            isFinished
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
              : isPlaying
              ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/40 ring-4 ring-indigo-500/20'
              : 'bg-white text-slate-950 hover:bg-slate-100 shadow-white/10 ring-4 ring-white/10'
          }`}
        >
          {isFinished ? (
            <RotateCcw className="w-8 h-8 text-white" />
          ) : isPlaying ? (
            <Pause className="w-8 h-8 fill-current text-white" />
          ) : (
            <Play className="w-8 h-8 fill-current text-slate-950 ml-1" />
          )}
        </button>

        {/* Avançar 1 Frase */}
        <button
          type="button"
          onClick={onSkipForward}
          disabled={disabled}
          title="Avançar 1 frase inteira"
          className="px-3.5 py-3 rounded-2xl text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-750 active:scale-95 border border-slate-700/60 transition disabled:opacity-40 flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <span className="text-xs font-semibold">1 Frase</span>
          <ChevronRight className="w-5 h-5 text-indigo-400" />
        </button>

        {/* Grifar Frase (Plim!) */}
        {onHighlightCurrent && (
          <button
            type="button"
            onClick={onHighlightCurrent}
            disabled={disabled}
            title="Grifar esta frase (Plim!)"
            className="p-3 rounded-2xl text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition active:scale-95 disabled:opacity-40 cursor-pointer shadow-sm"
          >
            <Star className="w-5 h-5 fill-amber-400" />
          </button>
        )}
      </div>

      {/* 3. Speed Bar: Presets & Slider with 200ms Debounce */}
      <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-400 font-medium">
            <Gauge className="w-3.5 h-3.5 text-indigo-400" /> Velocidade de Reprodução
          </span>
          <span className="font-mono font-bold text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-lg border border-indigo-500/30">
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
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
        />

        {/* Speed Pills inspired by Reference Images */}
        <div className="flex items-center justify-between gap-1 pt-1">
          {[1.0, 1.25, 1.5, 1.75, 2.0].map((val) => {
            const isCurrent = Math.abs(localRate - val) < 0.02;
            return (
              <button
                key={val}
                type="button"
                onClick={() => handlePresetRate(val)}
                disabled={disabled}
                className={`flex-1 py-1 px-1 rounded-lg text-[11px] font-mono font-semibold transition cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {val.toFixed(2).replace('.00', '')}x
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
