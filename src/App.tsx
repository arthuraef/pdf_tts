import { useState, useEffect } from 'react';
import { Headphones, BookOpen, Trash2 } from 'lucide-react';
import { PDFUpload } from './components/PDFUpload';
import { PlayerControls } from './components/PlayerControls';
import { ProgressBar } from './components/ProgressBar';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { useTTS } from './hooks/useTTS';
import { getActiveDocument, clearActiveDocument } from './storage/db';
import type { StoredDocument } from './types';

export function App() {
  const [activeDoc, setActiveDoc] = useState<StoredDocument | null>(null);
  const [isReady, setIsReady] = useState(false);

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
    setRate,
    setVoice,
  } = useTTS(activeDoc);

  const handleDocumentLoaded = (doc: StoredDocument) => {
    setActiveDoc(doc);
  };

  const handleRemoveDocument = async () => {
    pause();
    await clearActiveDocument();
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

        <PWAInstallPrompt />
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

              <button
                onClick={handleRemoveDocument}
                title="Trocar documento"
                className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-medium"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Trocar</span>
              </button>
            </div>

            {/* Visual Progress Bar & Current Text */}
            <ProgressBar
              currentPage={currentPage}
              totalPages={activeDoc.totalPages}
              currentChunkIndex={currentChunkIndex}
              totalChunks={totalChunks}
              currentTextSnippet={currentChunkText}
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

      {/* Footer */}
      <footer className="max-w-3xl w-full mx-auto text-center pt-6 border-t border-slate-850 text-xs text-slate-600">
        PDF Voice • 100% Client-Side • PWA Offline • Sem necessidade de backend
      </footer>
    </div>
  );
}

export default App;
