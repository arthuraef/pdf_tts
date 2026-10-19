import React from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, Star, X, Smartphone } from 'lucide-react';

interface PocketModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  currentPage: number;
  totalPages: number;
  currentText: string;
  isPlaying: boolean;
  isPaused: boolean;
  estimatedMinutes?: number;
  onPlayToggle: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onHighlight: () => void;
}

export const PocketModeModal: React.FC<PocketModeModalProps> = ({
  isOpen,
  onClose,
  title,
  currentPage,
  totalPages,
  currentText,
  isPlaying,
  isPaused: _isPaused,
  estimatedMinutes,
  onPlayToggle,
  onSkipBackward,
  onSkipForward,
  onHighlight,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between p-6 select-none overflow-hidden touch-manipulation">
      {/* Top Header: Battery-friendly, minimal OLED */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <Smartphone className="w-5 h-5 text-indigo-400 flex-shrink-0 animate-pulse" />
          <div className="overflow-hidden">
            <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase block">
              Modo Bolso / Academia (AMOLED)
            </span>
            <h2 className="text-sm font-semibold truncate text-slate-200">
              {title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {typeof estimatedMinutes === 'number' && (
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-emerald-300">
              ⏱️ ~{estimatedMinutes} min
            </span>
          )}
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer"
            title="Sair do Modo Bolso"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Center Zone: Giant readable typography + Massive Play/Pause */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto py-6 max-w-xl mx-auto text-center space-y-8">
        <div className="text-xs text-slate-400 font-mono tracking-wider">
          PÁGINA {currentPage} DE {totalPages}
        </div>

        {/* Large focused active sentence */}
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <p className="text-xl sm:text-2xl font-medium leading-relaxed text-indigo-100">
            "{currentText || 'Pronto para leitura...'}"
          </p>
        </div>

        {/* Giant Central Play/Pause Button */}
        <button
          onClick={onPlayToggle}
          className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center shadow-2xl transition transform active:scale-90 cursor-pointer ${
            isPlaying
              ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/40 border-4 border-indigo-400'
              : 'bg-white/15 hover:bg-white/25 border-4 border-white/30 text-white'
          }`}
          title={isPlaying ? 'Pausar' : 'Reproduzir'}
        >
          {isPlaying ? (
            <Pause className="w-14 h-14 fill-current text-white" />
          ) : (
            <Play className="w-14 h-14 fill-current text-white ml-2" />
          )}
        </button>
      </div>

      {/* Bottom Zone: Giant tap targets for thumb reach while walking/running */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
        {/* Skip 1 sentence back */}
        <button
          onClick={onSkipBackward}
          className="h-20 rounded-2xl bg-white/10 active:bg-indigo-900/60 flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
        >
          <ChevronLeft className="w-7 h-7 text-indigo-300" />
          <span className="text-[11px] font-bold text-slate-300">Voltar Frase</span>
        </button>

        {/* Highlight current idea with Chime */}
        <button
          onClick={onHighlight}
          className="h-20 rounded-2xl bg-amber-500/20 border border-amber-500/40 active:bg-amber-500/40 flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
          title="Salvar citação (Plim!)"
        >
          <Star className="w-6 h-6 text-amber-300 fill-amber-300" />
          <span className="text-[11px] font-bold text-amber-200">Grifar (Plim!)</span>
        </button>

        {/* Skip 1 sentence forward */}
        <button
          onClick={onSkipForward}
          className="h-20 rounded-2xl bg-white/10 active:bg-indigo-900/60 flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
        >
          <ChevronRight className="w-7 h-7 text-indigo-300" />
          <span className="text-[11px] font-bold text-slate-300">Avançar Frase</span>
        </button>
      </div>
    </div>
  );
};
