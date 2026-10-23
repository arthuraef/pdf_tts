import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Sliders,
  Play,
  RotateCcw,
  Check,
  Volume2,
  Wind,
  Gauge,
  Radio,
} from 'lucide-react';
import type { VoiceStudioEnhancerConfig, VoiceStudioPresetId } from '../oscar-engine/types';
import { VOICESTUDIO_PRESETS } from '../oscar-engine/types';

interface VoiceStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VoiceStudioEnhancerConfig;
  onChangeConfig: (patch: Partial<VoiceStudioEnhancerConfig>) => void;
  onSelectPreset: (presetId: VoiceStudioPresetId) => void;
  onPreview: (sampleText?: string) => void;
  selectedVoiceName?: string;
}

const PRESET_KEYS: VoiceStudioPresetId[] = [
  'warm_audiobook',
  'broadcast_hd',
  'soft_intimate',
  'crisp_fast',
  'custom',
];

export const VoiceStudioModal: React.FC<VoiceStudioModalProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  onSelectPreset,
  onPreview,
  selectedVoiceName = 'Google Brasil (Online)',
}) => {
  const [sampleText, setSampleText] = useState(
    'O tribunal julgou procedente o recurso, garantindo a ampla defesa e a segurança jurídica.'
  );
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  if (!isOpen) return null;

  const handleTestAudio = () => {
    setIsPlayingPreview(true);
    onPreview(sampleText);
    setTimeout(() => setIsPlayingPreview(false), 4500);
  };

  const handleResetDefault = () => {
    onSelectPreset('warm_audiobook');
  };

  const pitchPercent = Math.round(config.pitchShift * 100);
  const pitchLabel =
    pitchPercent === 0
      ? 'Padrão (Neutro)'
      : pitchPercent < 0
      ? `${pitchPercent}% (Mais Grave & Aveludado)`
      : `+${pitchPercent}% (Mais Claro & Agudo)`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voicestudio-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl max-h-[90vh] bg-slate-900 border border-indigo-900/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="voicestudio-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                  VoiceStudio • Estúdio de Áudio
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Google Brasil HD
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Aprimoramento acústico e masterização para fala natural de audiolivro
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Active Voice Info Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-indigo-950/30 border border-indigo-900/40 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Radio className="w-4 h-4 text-indigo-400" />
              <span>Voz Atual do Sistema:</span>
              <strong className="text-white font-medium">{selectedVoiceName}</strong>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-slate-400 text-[11px]">Efeito Ativo:</span>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => onChangeConfig({ enabled: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 cursor-pointer"
              />
            </label>
          </div>

          {/* Presets Grid */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              Perfis Acústicos de Masterização (VoiceStudio)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRESET_KEYS.map((key) => {
                const preset = VOICESTUDIO_PRESETS[key];
                const isSelected = config.preset === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelectPreset(key)}
                    className={`flex flex-col text-left p-3.5 rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-500/10'
                        : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <span>{preset.emoji}</span>
                        {preset.label}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fine Tuning Controls */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-indigo-400" />
              Ajustes Finos de Estúdio
            </h4>

            {/* Pitch Shift Slider */}
            <div className="space-y-1.5 bg-slate-800/40 p-3.5 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                  Timbre e Altura da Voz (Pitch Shift)
                </span>
                <span className="font-mono text-indigo-300 font-semibold">{pitchLabel}</span>
              </div>
              <input
                type="range"
                min="-0.08"
                max="0.08"
                step="0.01"
                value={config.pitchShift}
                onChange={(e) =>
                  onChangeConfig({
                    pitchShift: parseFloat(e.target.value),
                    preset: 'custom',
                  })
                }
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>-8% (Grave Profundo)</span>
                <span>0% (Neutro)</span>
                <span>+8% (Brilho Agudo)</span>
              </div>
            </div>

            {/* Pacing Slider */}
            <div className="space-y-1.5 bg-slate-800/40 p-3.5 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                  Cadência e Respiração de Pausas
                </span>
                <span className="font-mono text-indigo-300 font-semibold">
                  {config.pacingMultiplier.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.35"
                step="0.05"
                value={config.pacingMultiplier}
                onChange={(e) =>
                  onChangeConfig({
                    pacingMultiplier: parseFloat(e.target.value),
                    preset: 'custom',
                  })
                }
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.75x (Dinâmico / Rápido)</span>
                <span>1.0x (Padrão)</span>
                <span>1.35x (Calmo / Reflexivo)</span>
              </div>
            </div>

            {/* Breath Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Wind className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-semibold text-white">Micro-Respirações Orgânicas</h5>
                  <p className="text-[11px] text-slate-400">
                    Injeta sons sutis de respiração natural antes de frases longas
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.breathInjection}
                onChange={(e) =>
                  onChangeConfig({
                    breathInjection: e.target.checked,
                    preset: 'custom',
                  })
                }
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 cursor-pointer"
              />
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Teste Acústico em Tempo Real
              </span>
              <span className="text-[10px] text-slate-400">Ouça o efeito aplicado na voz</span>
            </div>

            <textarea
              rows={2}
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              className="w-full text-xs text-slate-200 bg-slate-900/80 border border-slate-700 rounded-xl p-2.5 resize-none focus:outline-none focus:border-indigo-500"
            />

            <button
              type="button"
              onClick={handleTestAudio}
              disabled={isPlayingPreview}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isPlayingPreview ? 'Reproduzindo...' : 'Ouvir com VoiceStudio'}</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <button
            type="button"
            onClick={handleResetDefault}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-indigo-600/30"
          >
            Salvar e Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
