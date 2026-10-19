import React, { useEffect, useState } from 'react';
import { X, Star, Trash2, ArrowUpRight, Copy, Check } from 'lucide-react';
import { getHighlightsForDoc, deleteHighlight } from '../storage/db';
import type { BookHighlight } from '../types';

interface HighlightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  docId?: number;
  onJumpToPage: (page: number) => void;
}

export const HighlightsModal: React.FC<HighlightsModalProps> = ({
  isOpen,
  onClose,
  docId,
  onJumpToPage,
}) => {
  const [highlights, setHighlights] = useState<BookHighlight[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && docId) {
      getHighlightsForDoc(docId).then(setHighlights);
    }
  }, [isOpen, docId]);

  const handleDelete = async (id?: number) => {
    if (!id || !docId) return;
    await deleteHighlight(id);
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  const handleCopy = (text: string, id?: number) => {
    if (!id) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Citações e Grifos do Livro</h3>
              <p className="text-xs text-slate-400">
                {highlights.length} frase{highlights.length > 1 ? 's' : ''} favoritada{highlights.length > 1 ? 's' : ''}
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

        {/* Highlight Items */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {highlights.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <Star className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
              Nenhum trecho grifado ainda.
              <p className="text-xs text-slate-600 mt-1">
                Toque no botão "Grifar" ou no botão do fone enquanto ouve para salvar frases com um "Plim!".
              </p>
            </div>
          ) : (
            highlights.map((h) => (
              <div
                key={h.id}
                className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-3 hover:border-slate-700 transition"
              >
                <p className="text-sm text-slate-200 italic leading-relaxed">
                  "{h.text}"
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-850 text-xs text-slate-500">
                  <span className="font-mono text-indigo-400">
                    Página {h.pageNumber}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(h.text, h.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                      title="Copiar citação"
                    >
                      {copiedId === h.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        onJumpToPage(h.pageNumber);
                        onClose();
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition cursor-pointer flex items-center gap-1 text-[11px]"
                      title="Ir para esta página"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Ir
                    </button>

                    <button
                      onClick={() => handleDelete(h.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                      title="Excluir grifo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
