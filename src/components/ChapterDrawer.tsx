import React from 'react';
import { X, BookOpen, ChevronRight, Hash } from 'lucide-react';
import type { ChapterOutlineItem } from '../types';

interface ChapterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: ChapterOutlineItem[];
  currentPage: number;
  onSelectChapter: (pageNumber: number) => void;
}

export const ChapterDrawer: React.FC<ChapterDrawerProps> = ({
  isOpen,
  onClose,
  chapters,
  currentPage,
  onSelectChapter,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Índice & Capítulos</h3>
              <p className="text-xs text-slate-400">
                {chapters.length} capítulo{chapters.length > 1 ? 's' : ''} detectado{chapters.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chapter List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2 pr-1 custom-scrollbar">
          {chapters.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <Hash className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Nenhum sumário estruturado encontrado neste PDF.
            </div>
          ) : (
            chapters.map((ch, idx) => {
              const isCurrent = currentPage === ch.pageNumber;
              return (
                <button
                  key={`${ch.pageNumber}_${idx}`}
                  onClick={() => {
                    onSelectChapter(ch.pageNumber);
                    onClose();
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer group ${
                    isCurrent
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/70 hover:border-slate-700 text-slate-300'
                  }`}
                  style={{ paddingLeft: `${Math.max(14, (ch.level || 0) * 16 + 14)}px` }}
                >
                  <div className="overflow-hidden">
                    <span className="font-medium text-sm block truncate group-hover:text-white">
                      {ch.title}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Página {ch.pageNumber}
                    </span>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 flex-shrink-0 transition transform group-hover:translate-x-0.5" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 text-center">
          Clique em qualquer capítulo para saltar diretamente para ele.
        </div>
      </div>
    </div>
  );
};
