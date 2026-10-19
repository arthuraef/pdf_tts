import React, { useState } from 'react';
import { Sparkles, Zap, Headphones, Wind, Download, CheckCircle2, Mic, Palette, Volume2 } from 'lucide-react';
import type { SpeakerRole, VoiceStyle, VoiceStyleDefinition } from '../oscar-engine/types';
import type { VoiceOption } from '../types';

interface OscarControlsProps {
  isOscarActive: boolean;
  onToggleOscar: () => void;
  bionicEnabled: boolean;
  onToggleBionic: () => void;
  spatialAudioEnabled: boolean;
  onToggleSpatialAudio: () => void;
  breathEnabled: boolean;
  onToggleBreath: () => void;
  isOfflineFallback: boolean;
  currentRole: SpeakerRole;
  voices: VoiceOption[];
  selectedVoiceId: string;
  onVoiceChange: (voiceId: string) => void;
  onPreviewVoice?: (voiceId: string) => void;
  voiceStyle: VoiceStyle;
  voiceStylesList: VoiceStyleDefinition[];
  onVoiceStyleChange: (style: VoiceStyle) => void;
  onPreviewStyle?: (style: VoiceStyle) => void;
  onExportAudio: () => Promise<Blob | null>;
  disabled?: boolean;
}

export const OscarControls: React.FC<OscarControlsProps> = ({
  isOscarActive,
  onToggleOscar,
  bionicEnabled,
  onToggleBionic,
  spatialAudioEnabled,
  onToggleSpatialAudio,
  breathEnabled,
  onToggleBreath,
  isOfflineFallback: _isOfflineFallback,
  currentRole,
  voices,
  selectedVoiceId,
  onVoiceChange,
  onPreviewVoice,
  voiceStyle,
  voiceStylesList,
  onVoiceStyleChange,
  onPreviewStyle,
  onExportAudio,
  disabled = false,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = async () => {
    if (isExporting || disabled) return;
    setIsExporting(true);
    setExportSuccess(false);
    try {
      await onExportAudio();
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao exportar áudio:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const getRoleBadge = () => {
    switch (currentRole) {
      case 'character_a':
        return { label: 'Personagem (Esq)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      case 'character_b':
        return { label: 'Personagem (Dir)', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
      case 'heading':
        return { label: 'Título / Capítulo', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'aside':
        return { label: 'Observação / Parênteses', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
      default:
        return { label: 'Narrador (Centro)', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
    }
  };

  const badge = getRoleBadge();
  const activeStyleDef = voiceStylesList.find((s) => s.id === voiceStyle);

  return (
    <div className="w-full bg-slate-900 border border-indigo-900/40 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Top Banner: Engine Status & Switch */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              OscarVoice Engine (v3.0)
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-normal">
                HD Neural
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Voz de estúdio humana, áudio espacial 3D e ritmo adaptativo
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleOscar}
          className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            isOscarActive
              ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-600/30'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {isOscarActive ? 'Motor HD Ativo' : 'Ativar Motor HD'}
        </button>
      </div>

      {isOscarActive && (
        <>
          {/* Voice Selection & Role Badge */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="oscar-voice-select"
                    className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"
                  >
                    <Mic className="w-3.5 h-3.5 text-indigo-400" />
                    Voz Neural Principal:
                  </label>
                  {selectedVoiceId && (
                    <button
                      type="button"
                      onClick={() => onPreviewVoice?.(selectedVoiceId)}
                      title="Ouvir teste desta voz"
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <Volume2 className="w-3 h-3" />
                      Testar Voz
                    </button>
                  )}
                </div>
                <select
                  id="oscar-voice-select"
                  value={selectedVoiceId}
                  onChange={(e) => onVoiceChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                >
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-1.5">
                <span className="text-[11px] text-slate-400">Papel em Reprodução:</span>
                <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
            </div>

            {/* Status Info */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-850 text-xs">
              <span className="text-slate-400 text-[11px]">Tecnologia de Áudio:</span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Síntese Neural HD • 100% Client-Side (Custo Zero)
              </span>
            </div>
          </div>

          {/* Voice Style Selector (Estilos de Narração) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-400" />
                Estilo de Narração & Atuação:
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-indigo-300 font-medium">
                  {activeStyleDef?.emoji} {activeStyleDef?.label}
                </span>
                {onPreviewStyle && (
                  <button
                    type="button"
                    onClick={() => onPreviewStyle(voiceStyle)}
                    title="Ouvir amostra deste estilo"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer hover:underline"
                  >
                    <Volume2 className="w-3 h-3" />
                    Ouvir
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {voiceStylesList.map((st) => {
                const isSelected = st.id === voiceStyle;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onVoiceStyleChange(st.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-sm shadow-indigo-600/30 ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    <span className="text-base sm:text-lg mb-0.5">{st.emoji}</span>
                    <span className="text-[11px] font-bold leading-tight">{st.label.split(' ')[0]}</span>
                    <span className="text-[9px] text-slate-400 line-clamp-1">{st.label.split(' ').slice(1).join(' ')}</span>
                  </button>
                );
              })}
            </div>

            {activeStyleDef && (
              <p className="text-[11px] text-slate-400 italic px-1">
                "{activeStyleDef.description}"
              </p>
            )}
          </div>

          {/* Superpowers Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Bionic Audio */}
            <button
              type="button"
              onClick={onToggleBionic}
              disabled={disabled}
              className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                bionicEnabled
                  ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                Bionic Audio
              </span>
              <span className={`text-[10px] font-bold ${bionicEnabled ? 'text-indigo-400' : 'text-slate-600'}`}>
                {bionicEnabled ? 'LIGADO' : 'DESL.'}
              </span>
            </button>

            {/* Áudio Espacial 3D */}
            <button
              type="button"
              onClick={onToggleSpatialAudio}
              disabled={disabled}
              className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                spatialAudioEnabled
                  ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-indigo-400" />
                Teatro 3D
              </span>
              <span className={`text-[10px] font-bold ${spatialAudioEnabled ? 'text-indigo-400' : 'text-slate-600'}`}>
                {spatialAudioEnabled ? 'LIGADO' : 'DESL.'}
              </span>
            </button>

            {/* Micro-Respiração */}
            <button
              type="button"
              onClick={onToggleBreath}
              disabled={disabled}
              className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                breathEnabled
                  ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-indigo-400" />
                Respiração
              </span>
              <span className={`text-[10px] font-bold ${breathEnabled ? 'text-indigo-400' : 'text-slate-600'}`}>
                {breathEnabled ? 'LIGADO' : 'DESL.'}
              </span>
            </button>
          </div>

          {/* Download Chapter as Audio (.wav) */}
          <div className="pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={handleExport}
              disabled={disabled || isExporting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-750 text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              {isExporting ? 'Renderizando áudio do capítulo...' : exportSuccess ? 'Áudio Baixado com Sucesso! 🎉' : 'Baixar Capítulo em Áudio (.wav)'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
