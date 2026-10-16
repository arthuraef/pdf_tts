import React from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, Mic, Loader2 } from 'lucide-react';
import type { VoiceOption } from '../types';
import type { KokoroStatus } from '../core/kokoro-engine';

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
  voices: VoiceOption[];
  selectedVoiceId: string;
  onVoiceChange: (id: string) => void;
  kokoroStatus: KokoroStatus;
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
  voices,
  selectedVoiceId,
  onVoiceChange,
  kokoroStatus,
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

  const isKokoroVoice = selectedVoiceId.startsWith('kokoro:');
  const isKokoroLoading = isKokoroVoice && kokoroStatus === 'loading';
  const nativeVoices = voices.filter((v) => v.engine === 'native');
  const kokoroVoices = voices.filter((v) => v.engine === 'kokoro');

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
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
              disabled={disabled || isKokoroLoading}
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

        {/* Playback buttons */}
        <div className="flex items-center gap-4 order-1 sm:order-2">
          <button
            onClick={onSkipBackward}
            disabled={disabled || isKokoroLoading}
            title="Voltar 10 segundos"
            className="p-3 rounded-full text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition active:scale-95 disabled:opacity-50 flex items-center justify-center relative group"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="absolute -bottom-6 text-[10px] font-bold text-slate-400 tracking-tight opacity-0 group-hover:opacity-100 transition">-10s</span>
          </button>

          <button
            onClick={handlePlayToggle}
            disabled={disabled || isKokoroLoading}
            className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition transform active:scale-95 disabled:opacity-50"
          >
            {isKokoroLoading ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>

          <button
            onClick={onSkipForward}
            disabled={disabled || isKokoroLoading}
            title="Avançar 10 segundos"
            className="p-3 rounded-full text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition active:scale-95 disabled:opacity-50 flex items-center justify-center relative group"
          >
            <RotateCw className="w-5 h-5" />
            <span className="absolute -bottom-6 text-[10px] font-bold text-slate-400 tracking-tight opacity-0 group-hover:opacity-100 transition">+10s</span>
          </button>
        </div>
      </div>

      {/* Voice Selector */}
      {voices.length > 0 && (
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <label htmlFor="voice-select" className="text-slate-400 font-medium flex items-center gap-1.5 text-xs">
            <Mic className="w-3.5 h-3.5 text-indigo-400" />
            Voz de Leitura:
            {isKokoroLoading && (
              <span className="ml-1 flex items-center gap-1 text-amber-400 text-[11px]">
                <Loader2 className="w-3 h-3 animate-spin" />
                Baixando modelo Kokoro (~85 MB)…
              </span>
            )}
            {isKokoroVoice && kokoroStatus === 'ready' && (
              <span className="ml-1 text-emerald-400 text-[11px]">✓ Kokoro IA pronto</span>
            )}
            {isKokoroVoice && kokoroStatus === 'error' && (
              <span className="ml-1 text-rose-400 text-[11px]">✗ Falha ao carregar modelo</span>
            )}
          </label>

          <select
            id="voice-select"
            value={selectedVoiceId}
            onChange={(e) => onVoiceChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition cursor-pointer"
          >
            {/* Native voices group */}
            {nativeVoices.length > 0 && (
              <optgroup label="🎙️ Vozes do Sistema (Instantâneo)">
                {nativeVoices.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </optgroup>
            )}

            {/* Kokoro AI voices group */}
            {kokoroVoices.length > 0 && (
              <optgroup label="🤖 Kokoro AI — pt-BR Neural (Download ~85 MB)">
                {kokoroVoices.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </optgroup>
            )}
          </select>

          {isKokoroVoice && kokoroStatus === 'idle' && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              💡 Ao pressionar Play com uma voz Kokoro, o modelo de IA (~85 MB) será baixado uma única vez e armazenado no seu navegador para uso offline.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
