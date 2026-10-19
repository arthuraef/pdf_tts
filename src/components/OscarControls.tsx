import React, { useState } from 'react';
import { Sparkles, Zap, Headphones, Wind, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import type { SpeakerRole } from '../oscar-engine/types';

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
  currentVoiceId: string;
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
  isOfflineFallback,
  currentRole,
  currentVoiceId,
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
          {/* Active Voice & Elenco Indicators */}
          <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Voz Ativa:</span>
              <span className="text-xs font-semibold text-slate-200">
                {currentVoiceId.includes('Antonio') ? 'Antonio (M)' : 'Francisca (F)'}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${badge.color}`}>
                {badge.label}
              </span>
            </div>

            {isOfflineFallback ? (
              <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5" /> Modo Offline Ativo
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Zero-Silence Stream
              </span>
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
          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleExport}
              disabled={disabled || isExporting}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
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
