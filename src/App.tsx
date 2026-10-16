import { useState, useEffect } from 'react';
import { Headphones, BookOpen, Trash2, Library } from 'lucide-react';
import { PDFUpload } from './components/PDFUpload';
import { PlayerControls } from './components/PlayerControls';
import { ProgressBar } from './components/ProgressBar';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { LibraryModal } from './components/LibraryModal';
import { useTTS } from './hooks/useTTS';
import { useMediaSession } from './hooks/useMediaSession';
import { getActiveDocument, deleteDocument, setActiveDocId } from './storage/db';
import type { StoredDocument } from './types';

export function App() {
  const [activeDoc, setActiveDoc] = useState<StoredDocument | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // Restore existing document from IndexedDB on startup
  useEffect(() => {
    getActiveDocument().then((doc) => {
      if (doc) {
        setActiveDoc(doc);
      }
      setIsReady(true);
    });
  }, []);

  const {
    isPlaying,
    isPaused,
    isFinished,
    rate,
    currentChunkIndex,
    totalChunks,
    currentPage,
    currentChunkText,
    voiceOptions,
    selectedVoiceId,
    play,
    pause,
    resume,
    restart,
    skipBackward,
    skipForward,
    goToPage,
    setRate,
    setVoice,
  } = useTTS(activeDoc);

  // Sync background playback and lockscreen media controls
  useMediaSession({
    document: activeDoc,
    currentPage,
    currentChunkIndex,
    totalChunks,
    isPlaying,
    isPaused,
    rate,
    play,
    pause,
    resume,
    skipBackward,
    skipForward,
  });

  const handleDocumentLoaded = (doc: StoredDocument) => {
    setActiveDoc(doc);
  };

  const handleSelectDocument = (doc: StoredDocument) => {
    pause();
    setActiveDocId(doc.id ?? null);
    setActiveDoc(doc);
  };

  const handleUploadFromLibrary = () => {
    pause();
    setActiveDoc(null);
  };

  const handleRemoveDocument = async () => {
    pause();
    if (activeDoc?.id) {
      await deleteDocument(activeDoc.id);
    }
    setActiveDoc(null);
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/30">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white m-0">PDF Voice</h1>
            <p className="text-xs text-slate-400">Leitor de PDF em Voz Alta (MVP)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsLibraryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-750 transition text-xs font-semibold cursor-pointer shadow-sm"
            title="Abrir minha biblioteca de livros"
          >
            <Library className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Biblioteca</span>
          </button>

          <PWAInstallPrompt />
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-3xl w-full mx-auto my-auto py-8">
        {!activeDoc ? (
          <div className="space-y-6">
            <div className="text-center space-y-2 max-w-md mx-auto">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Transforme seus PDFs em áudio
              </h2>
              <p className="text-sm text-slate-400">
                Ouça livros, artigos e documentos diretamente no seu navegador, offline e sem
                custos.
              </p>
            </div>

            <PDFUpload onDocumentLoaded={handleDocumentLoaded} />

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsLibraryOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-indigo-300 hover:text-white border border-slate-800 hover:border-slate-700 text-xs font-semibold transition cursor-pointer shadow-sm"
              >
                <Library className="w-4 h-4 text-indigo-400" />
                Ver Livros Salvos na Biblioteca
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Document Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 flex-shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">
                    {activeDoc.fileName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeDoc.totalPages} página{activeDoc.totalPages > 1 ? 's' : ''} •{' '}
                    {(activeDoc.fileSize / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLibraryOpen(true)}
                  title="Ver todos os livros na biblioteca"
                  className="text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700/70 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-sm"
                >
                  <Library className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Biblioteca</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemoveDocument}
                  title="Remover livro atual"
                  className="text-slate-400 hover:text-rose-400 p-2 rounded-xl hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Visual Progress Bar & Current Text */}
            <ProgressBar
              currentPage={currentPage}
              totalPages={activeDoc.totalPages}
              currentChunkIndex={currentChunkIndex}
              totalChunks={totalChunks}
              currentTextSnippet={currentChunkText}
              onGoToPage={goToPage}
              disabled={totalChunks === 0}
            />

            {/* Audio Controls (Play, Pause, Skip ±10s, Rate, Voice) */}
            <PlayerControls
              isPlaying={isPlaying}
              isPaused={isPaused}
              isFinished={isFinished}
              onPlay={play}
              onPause={pause}
              onResume={resume}
              onRestart={restart}
              onSkipBackward={skipBackward}
              onSkipForward={skipForward}
              rate={rate}
              onRateChange={setRate}
              voices={voiceOptions}
              selectedVoiceId={selectedVoiceId}
              onVoiceChange={setVoice}
              disabled={totalChunks === 0}
            />
          </div>
        )}
      </main>

      {/* Library Modal */}
      <LibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        activeDocId={activeDoc?.id}
        onSelectDocument={handleSelectDocument}
        onUploadNew={handleUploadFromLibrary}
      />

      {/* Footer */}
      <footer className="max-w-3xl w-full mx-auto text-center pt-6 border-t border-slate-850 text-xs text-slate-600">
        PDF Voice • 100% Client-Side • PWA Offline • Sem necessidade de backend
      </footer>
    </div>
  );
}

export default App;
