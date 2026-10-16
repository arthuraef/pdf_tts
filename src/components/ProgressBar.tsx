import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Compass } from 'lucide-react';

interface ProgressBarProps {
  currentPage: number;
  totalPages: number;
  currentChunkIndex: number;
  totalChunks: number;
  currentTextSnippet?: string;
  onGoToPage: (page: number) => void;
  disabled?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentPage,
  totalPages,
  currentChunkIndex,
  totalChunks,
  currentTextSnippet,
  onGoToPage,
  disabled = false,
}) => {
  const percentage = totalChunks > 0 ? Math.round(((currentChunkIndex + 1) / totalChunks) * 100) : 0;
  const [pageInput, setPageInput] = useState<string>(currentPage.toString());

  // Keep local input in sync with currentPage as audio progresses
  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  const handlePageSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      onGoToPage(parsed);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      {/* Page Navigation Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-slate-400 font-medium">
            <Compass className="w-4 h-4 text-indigo-400" />
            Navegador:
          </span>

          {/* Stepper buttons (prev / next page) */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => onGoToPage(currentPage - 1)}
              disabled={disabled || currentPage <= 1}
              title="Página anterior"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Direct Page Input Form */}
            <form onSubmit={handlePageSubmit} className="flex items-center gap-1 px-1">
              <span className="text-xs text-slate-400 font-medium">Pág.</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={() => handlePageSubmit()}
                disabled={disabled}
                className="w-14 sm:w-16 bg-slate-900 border border-slate-700/80 rounded-md px-1.5 py-0.5 text-center font-bold text-xs text-indigo-300 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <span className="text-xs text-slate-500">de {totalPages}</span>
            </form>

            <button
              type="button"
              onClick={() => onGoToPage(currentPage + 1)}
              disabled={disabled || currentPage >= totalPages}
              title="Próxima página"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Percentage badge */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs font-mono font-semibold text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
            {percentage}% lido
          </span>
        </div>
      </div>

      {/* Interactive Page Scrubber Slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Página {currentPage} de {totalPages}</span>
          <span className="font-mono text-indigo-400">Arraste para navegar</span>
        </div>
        <input
          type="range"
          min={1}
          max={totalPages}
          value={currentPage}
          onChange={(e) => onGoToPage(parseInt(e.target.value, 10))}
          disabled={disabled || totalPages <= 1}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-medium px-0.5">
          <button
            type="button"
            onClick={() => onGoToPage(1)}
            disabled={disabled}
            className="hover:text-indigo-400 transition cursor-pointer"
          >
            Início (pág. 1)
          </button>
          {totalPages > 4 && (
            <button
              type="button"
              onClick={() => onGoToPage(Math.round(totalPages / 2))}
              disabled={disabled}
              className="hover:text-indigo-400 transition cursor-pointer"
            >
              Meio (pág. {Math.round(totalPages / 2)})
            </button>
          )}
          <button
            type="button"
            onClick={() => onGoToPage(totalPages)}
            disabled={disabled}
            className="hover:text-indigo-400 transition cursor-pointer"
          >
            Fim (pág. {totalPages})
          </button>
        </div>
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
