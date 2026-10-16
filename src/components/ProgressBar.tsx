import React from 'react';

interface ProgressBarProps {
  currentPage: number;
  totalPages: number;
  currentChunkIndex: number;
  totalChunks: number;
  currentTextSnippet?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentPage,
  totalPages,
  currentChunkIndex,
  totalChunks,
  currentTextSnippet,
}) => {
  const percentage = totalChunks > 0 ? Math.round(((currentChunkIndex + 1) / totalChunks) * 100) : 0;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 font-semibold">Página {currentPage}</span>
          <span className="text-slate-500">de {totalPages}</span>
        </div>
        <div className="text-slate-400 font-mono">{percentage}% lido</div>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
        <div
          className="bg-indigo-500 h-full rounded-full transition-all duration-300 shadow-sm shadow-indigo-500/50"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Text preview card */}
      {currentTextSnippet && (
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Trecho sendo lido:
          </span>
          <p className="text-sm text-slate-200 leading-relaxed italic line-clamp-3">
            "{currentTextSnippet}"
          </p>
        </div>
      )}
    </div>
  );
};
