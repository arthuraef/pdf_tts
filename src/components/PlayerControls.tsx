import React from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2 } from 'lucide-react';

interface PlayerControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  rate: number;
  onRateChange: (rate: number) => void;
  disabled?: boolean;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  isPaused,
  onPlay,
  onPause,
  onResume,
  onSkipBackward,
  onSkipForward,
  rate,
  onRateChange,
  disabled = false,
}) => {
  const speeds = [1.0, 1.25, 1.5];

  const handlePlayToggle = () => {
    if (isPlaying) {
      onPause();
    } else if (isPaused) {
      onResume();
    } else {
      onPlay();
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Speed Controls */}
        <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 order-2 sm:order-1">
          <span className="text-xs font-medium text-slate-400 px-2 flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5" /> Vel:
          </span>
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => onRateChange(s)}
              disabled={disabled}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                rate === s
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              } disabled:opacity-50`}
            >
              x{s.toString().replace('.', ',')}
            </button>
          ))}
        </div>

        {/* Playback action buttons */}
        <div className="flex items-center gap-4 order-1 sm:order-2">
          {/* Skip -10s */}
          <button
            onClick={onSkipBackward}
            disabled={disabled}
            title="Voltar 10 segundos"
            className="p-3 rounded-full text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition active:scale-95 disabled:opacity-50 flex items-center justify-center relative group"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="absolute -bottom-6 text-[10px] font-bold text-slate-400 tracking-tight opacity-0 group-hover:opacity-100 transition">
              -10s
            </span>
          </button>

          {/* Main Play / Pause */}
          <button
            onClick={handlePlayToggle}
            disabled={disabled}
            className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition transform active:scale-95 disabled:opacity-50"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>

          {/* Skip +10s */}
          <button
            onClick={onSkipForward}
            disabled={disabled}
            title="Avançar 10 segundos"
            className="p-3 rounded-full text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition active:scale-95 disabled:opacity-50 flex items-center justify-center relative group"
          >
            <RotateCw className="w-5 h-5" />
            <span className="absolute -bottom-6 text-[10px] font-bold text-slate-400 tracking-tight opacity-0 group-hover:opacity-100 transition">
              +10s
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
