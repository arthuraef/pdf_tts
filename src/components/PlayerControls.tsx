import React from 'react';
import { Play, Pause, RotateCcw, RotateCw, Gauge, Mic, Loader2 } from 'lucide-react';
import type { VoiceOption } from '../types';
import type { KokoroStatus } from '../core/kokoro-engine';

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
  kokoroStatus: KokoroStatus;
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
  kokoroStatus,
  disabled = false,
}) => {
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

  const isKokoroVoice = selectedVoiceId.startsWith('kokoro:');
  const isKokoroLoading = isKokoroVoice && kokoroStatus === 'loading';
  const nativeVoices = voices.filter((v) => v.engine === 'native');
  const kokoroVoices = voices.filter((v) => v.engine === 'kokoro');

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
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2 flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Ler novamente
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Speed Slider: 1x to 2x with step 0.05 */}
        <div className="flex flex-col gap-2 bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-700/60 order-2 sm:order-1 w-full sm:w-72">
          <div className="flex items-center justify-between text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Gauge className="w-3.5 h-3.5 text-indigo-400" /> Velocidade:
            </span>
            <span className="font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md border border-indigo-500/30 font-mono">
              x{rate.toFixed(2).replace('.', ',')}
            </span>
          </div>

          <input
            type="range"
            min="1"
            max="2"
            step="0.05"
            value={rate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            disabled={disabled || isKokoroLoading}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
          />

          <div className="flex justify-between text-[10px] font-semibold text-slate-400 px-0.5">
            <button
              type="button"
              onClick={() => onRateChange(1.0)}
              className={`hover:text-indigo-400 transition cursor-pointer ${
                Math.abs(rate - 1.0) < 0.01 ? 'text-indigo-400 font-bold' : ''
              }`}
            >
              x1,0
            </button>
            <button
              type="button"
              onClick={() => onRateChange(1.25)}
              className={`hover:text-indigo-400 transition cursor-pointer ${
                Math.abs(rate - 1.25) < 0.01 ? 'text-indigo-400 font-bold' : ''
              }`}
            >
              x1,25
            </button>
            <button
              type="button"
              onClick={() => onRateChange(1.5)}
              className={`hover:text-indigo-400 transition cursor-pointer ${
                Math.abs(rate - 1.5) < 0.01 ? 'text-indigo-400 font-bold' : ''
              }`}
            >
              x1,5
            </button>
            <button
              type="button"
              onClick={() => onRateChange(1.75)}
              className={`hover:text-indigo-400 transition cursor-pointer ${
                Math.abs(rate - 1.75) < 0.01 ? 'text-indigo-400 font-bold' : ''
              }`}
            >
              x1,75
            </button>
            <button
              type="button"
              onClick={() => onRateChange(2.0)}
              className={`hover:text-indigo-400 transition cursor-pointer ${
                Math.abs(rate - 2.0) < 0.01 ? 'text-indigo-400 font-bold' : ''
              }`}
            >
              x2,0
            </button>
          </div>
        </div>

        {/* Playback buttons */}
        <div className="flex items-center gap-4 order-1 sm:order-2">
          <button
            onClick={onSkipBackward}
            disabled={disabled || isKokoroLoading}
            title="Voltar trecho anterior"
            className="p-3 rounded-full text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition active:scale-95 disabled:opacity-50 flex items-center justify-center relative group cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="absolute -bottom-6 text-[10px] font-bold text-slate-400 tracking-tight opacity-0 group-hover:opacity-100 transition">
              -10s
            </span>
          </button>

          <button
            onClick={handlePlayToggle}
            disabled={disabled || isKokoroLoading}
            title={
              isKokoroLoading
                ? 'Carregando modelo de IA...'
                : isFinished
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
            {isKokoroLoading ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : isFinished ? (
              <RotateCcw className="w-8 h-8" />
            ) : isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>

          <button
            onClick={onSkipForward}
            disabled={disabled || isKokoroLoading}
            title="Avançar próximo trecho"
            className="p-3 rounded-full text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition active:scale-95 disabled:opacity-50 flex items-center justify-center relative group cursor-pointer"
          >
            <RotateCw className="w-5 h-5" />
            <span className="absolute -bottom-6 text-[10px] font-bold text-slate-400 tracking-tight opacity-0 group-hover:opacity-100 transition">
              +10s
            </span>
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
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </optgroup>
            )}

            {/* Kokoro AI voices group */}
            {kokoroVoices.length > 0 && (
              <optgroup label="🤖 Kokoro AI — pt-BR Neural (Download ~85 MB)">
                {kokoroVoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
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
