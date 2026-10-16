import React, { useState, useEffect } from 'react';
import {
  Library,
  BookOpen,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  X,
  FileText,
  Clock,
} from 'lucide-react';
import { getAllDocumentsWithProgress, deleteDocument } from '../storage/db';
import type { DocumentWithProgress, StoredDocument } from '../types';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDocId?: number;
  onSelectDocument: (doc: StoredDocument) => void;
  onUploadNew: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  activeDocId,
  onSelectDocument,
  onUploadNew,
}) => {
  const [documents, setDocuments] = useState<DocumentWithProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const list = await getAllDocumentsWithProgress();
      setDocuments(list);
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
      setConfirmDeleteId(null);
    }
  }, [isOpen]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              <Library className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Minha Biblioteca
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {documents.length} {documents.length === 1 ? 'livro' : 'livros'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Seus PDFs e posições de leitura salvos localmente
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Fechar biblioteca"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              Carregando seus livros...
            </div>
          ) : documents.length === 0 ? (
            <div className="py-16 text-center space-y-4 max-w-sm mx-auto">
              <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mx-auto">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-slate-200 text-base">Sua biblioteca está vazia</h3>
                <p className="text-xs text-slate-400">
                  Envie o seu primeiro PDF para ouvir a qualquer hora.
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onUploadNew();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Enviar PDF
              </button>
            </div>
          ) : (
            documents.map((doc) => {
              const isActive = doc.id === activeDocId;
              const isDeleting = confirmDeleteId === doc.id;
              const pageText = doc.progress
                ? `Página ${doc.progress.pageIndex + 1} de ${doc.totalPages}`
                : `1 de ${doc.totalPages} págs`;

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    onSelectDocument(doc);
                    onClose();
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group ${
                    isActive
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-lg shadow-indigo-950/30'
                      : 'bg-slate-950/50 hover:bg-slate-800/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Book Info */}
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-800 text-slate-300 group-hover:text-white group-hover:bg-slate-700 transition'
                      }`}
                    >
                      <FileText className="w-6 h-6" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-slate-100 truncate" title={doc.fileName}>
                          {doc.fileName}
                        </h4>
                        {isActive && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30 flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                            Lendo
                          </span>
                        )}
                        {doc.progressPercentage === 100 && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            Lido
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span>{pageText}</span>
                        <span>•</span>
                        <span>{(doc.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline font-mono font-semibold text-slate-300">
                          {doc.progressPercentage}%
                        </span>
                      </div>

                      {/* Small progress bar */}
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2 border border-slate-700/50">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all"
                          style={{ width: `${doc.progressPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDocument(doc);
                        onClose();
                      }}
                      className={`px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          : 'bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {isActive ? 'Continuar' : 'Abrir'}
                    </button>

                    {isDeleting ? (
                      <div className="flex items-center gap-1 bg-rose-950/80 p-1 rounded-xl border border-rose-500/30">
                        <button
                          type="button"
                          onClick={(e) => handleDelete(doc.id!, e)}
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition cursor-pointer"
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 rounded-lg text-slate-300 hover:text-white font-bold text-[11px] transition cursor-pointer"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(doc.id!);
                        }}
                        title="Remover livro da biblioteca"
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Progresso salvo automaticamente por livro
          </p>

          <button
            onClick={() => {
              onClose();
              onUploadNew();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Adicionar PDF
          </button>
        </div>
      </div>
    </div>
  );
};
