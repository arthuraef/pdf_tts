import React, { useState } from 'react';
import { BookOpen, Plus, Headphones, Trash2, CheckCircle2, Search } from 'lucide-react';
import { BookCover } from './BookCover';
import { PDFUpload } from './PDFUpload';
import type { DocumentWithProgress, StoredDocument } from '../types';

interface BookshelfViewProps {
  documents: DocumentWithProgress[];
  activeDocId?: number | null;
  onSelectDocument: (doc: StoredDocument) => void;
  onDocumentUploaded: (doc: StoredDocument) => void;
  onDeleteDocument: (id: number) => void;
}

export const BookshelfView: React.FC<BookshelfViewProps> = ({
  documents,
  activeDocId,
  onSelectDocument,
  onDocumentUploaded,
  onDeleteDocument,
}) => {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocs = documents.filter((d) =>
    d.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeDoc = documents.find((d) => d.id === activeDocId);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-12 animate-in fade-in duration-300">
      {/* Top Editorial Banner inspired by Bauhaus references */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/70 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        {/* Geometric accent circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-24 w-40 h-40 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono font-semibold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Sua Biblioteca Pessoal
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight leading-tight">
              Livros & Audiolivros
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Transforme seus PDFs em audiolivros com narração de alta fidelidade e leitura focada.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsUploadOpen((prev) => !prev)}
            className="self-start sm:self-center inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Novo PDF</span>
          </button>
        </div>

        {/* Collapsible / Quick Add Dropzone */}
        {isUploadOpen && (
          <div className="mt-6 pt-6 border-t border-slate-800/80 animate-in slide-in-from-top-4 duration-300">
            <PDFUpload
              onDocumentLoaded={(doc) => {
                setIsUploadOpen(false);
                onDocumentUploaded(doc);
              }}
            />
          </div>
        )}
      </div>

      {/* Featured / Currently Reading Card (if books exist) */}
      {activeDoc && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 hover:border-slate-700 transition">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <BookCover
              title={activeDoc.fileName}
              coverUrl={activeDoc.coverUrl}
              size="md"
            />
            <div className="space-y-1.5 overflow-hidden flex-1 sm:flex-initial">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold block">
                Continuar Ouvindo
              </span>
              <h3 className="font-semibold text-slate-100 text-base sm:text-lg break-words line-clamp-2">
                {activeDoc.fileName}
              </h3>
              <p className="text-xs text-slate-400">
                Página {(activeDoc.progress?.pageIndex ?? 0) + 1} de {activeDoc.totalPages} •{' '}
                <span className="text-emerald-400 font-semibold">
                  {activeDoc.progressPercentage}% concluído
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectDocument(activeDoc)}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Headphones className="w-4 h-4" />
            <span>Retomar Leitura</span>
          </button>
        </div>
      )}

      {/* Search and Books Count Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white tracking-tight">
            Todos os Livros
          </h2>
          <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-850 px-2.5 py-0.5 rounded-full border border-slate-800">
            {documents.length}
          </span>
        </div>

        {documents.length > 3 && (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar livro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        )}
      </div>

      {/* Book Grid: Vertical covers with full title wrapping */}
      {filteredDocs.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-slate-800 rounded-3xl bg-slate-900/40 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-200">
              {searchQuery ? 'Nenhum livro encontrado para sua busca' : 'Sua estante está vazia'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? 'Tente buscar por outro termo ou limpe o filtro.'
                : 'Importe um arquivo PDF para começar a ouvir sua biblioteca com narração neural de alta qualidade.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Importar Primeiro Livro</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5 sm:gap-6">
          {filteredDocs.map((doc) => {
            const isFinished = doc.progressPercentage >= 100;
            return (
              <div
                key={doc.id}
                className="group relative bg-slate-900/70 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between shadow-lg transition-all duration-300 hover:shadow-2xl"
              >
                {/* Book Cover Area with Click to Play */}
                <div
                  onClick={() => onSelectDocument(doc)}
                  className="cursor-pointer flex flex-col items-center"
                >
                  <BookCover
                    title={doc.fileName}
                    coverUrl={doc.coverUrl}
                    size="md"
                    className="w-full max-w-[140px]"
                  />

                  {/* Full Title with Natural Line Break */}
                  <div className="w-full mt-3 text-left">
                    <h3 className="font-semibold text-slate-100 text-xs sm:text-sm break-words line-clamp-3 group-hover:text-indigo-300 transition-colors">
                      {doc.fileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')}
                    </h3>

                    {/* Progress Bar & Page info */}
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>Pág. {(doc.progress?.pageIndex ?? 0) + 1} de {doc.totalPages}</span>
                        {isFinished ? (
                          <span className="text-emerald-400 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Lido
                          </span>
                        ) : (
                          <span>{doc.progressPercentage}%</span>
                        )}
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isFinished ? 'bg-emerald-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${Math.min(100, doc.progressPercentage)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => onSelectDocument(doc)}
                    className="inline-flex items-center gap-1.5 font-semibold text-indigo-400 hover:text-indigo-300 text-xs cursor-pointer"
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Ouvir</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => doc.id && onDeleteDocument(doc.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                    title="Excluir livro da biblioteca"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
