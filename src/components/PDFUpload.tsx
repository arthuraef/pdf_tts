import React, { useRef, useState } from 'react';
import { Upload, FileText, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { extractTextFromPDF } from '../core/pdf-parser';
import { saveDocument } from '../storage/db';
import type { StoredDocument } from '../types';

interface PDFUploadProps {
  onDocumentLoaded: (doc: StoredDocument) => void;
}

export const PDFUpload: React.FC<PDFUploadProps> = ({ onDocumentLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor, selecione um arquivo válido no formato PDF.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { pages, totalCharacters, chapters, coverUrl } = await extractTextFromPDF(file);

      if (totalCharacters === 0) {
        setError(
          'Este PDF não possui texto selecionável ou é protegido/escaneado. No momento, o MVP requer PDFs com camada de texto.'
        );
        setIsLoading(false);
        return;
      }

      const id = await saveDocument(file.name, file.size, pages, chapters, coverUrl);
      const doc: StoredDocument = {
        id,
        fileName: file.name,
        fileSize: file.size,
        totalPages: pages.length,
        pages,
        chapters,
        coverUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      onDocumentLoaded(doc);
    } catch (err: unknown) {
      console.error('Error processing PDF:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao processar o arquivo PDF. Verifique se o documento não está corrompido.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto my-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-700 hover:border-slate-500 bg-slate-900/50 hover:bg-slate-900/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleProcessFile(e.target.files[0]);
            }
          }}
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
            <p className="text-slate-300 font-medium">Extraindo texto do documento...</p>
            <p className="text-xs text-slate-500">100% processado no seu dispositivo</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              {isDragging ? <Upload className="w-8 h-8" /> : <FileText className="w-8 h-8" />}
            </div>
            <div>
              <p className="text-base sm:text-lg font-semibold text-slate-200">
                Arraste seu arquivo PDF aqui
              </p>
              <p className="text-sm text-slate-400 mt-1">
                ou clique para selecionar do seu computador/celular
              </p>
            </div>
            <span className="inline-block text-xs font-medium text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              Suporta documentos com texto selecionável
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Selo de Privacidade Grau Bancário */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800/80 rounded-xl px-4 py-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>
          <strong className="text-slate-200">100% Privado:</strong> Seus livros nunca saem do seu dispositivo. Zero envio para servidores externos.
        </span>
      </div>
    </div>
  );
};
