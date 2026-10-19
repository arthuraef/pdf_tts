import { useState, useEffect } from 'react';
import { Headphones, BookOpen, Trash2, Library } from 'lucide-react';
import { PDFUpload } from './components/PDFUpload';
import { PlayerControls } from './components/PlayerControls';
import { ProgressBar } from './components/ProgressBar';
import { OscarControls } from './components/OscarControls';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { LibraryModal } from './components/LibraryModal';
import { PocketModeModal } from './components/PocketModeModal';
import { ChapterDrawer } from './components/ChapterDrawer';
import { HighlightsModal } from './components/HighlightsModal';
import { useTTS } from './hooks/useTTS';
import { useOscarEngine } from './hooks/useOscarEngine';
import { useMediaSession } from './hooks/useMediaSession';
import { getActiveDocument, deleteDocument, setActiveDocId } from './storage/db';
import type { StoredDocument } from './types';

export function App() {
  const [activeDoc, setActiveDoc] = useState<StoredDocument | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isPocketModeOpen, setIsPocketModeOpen] = useState(false);
  const [isChaptersOpen, setIsChaptersOpen] = useState(false);
  const [isHighlightsOpen, setIsHighlightsOpen] = useState(false);
  const [isOscarMode, setIsOscarMode] = useState(true);

  // Restore existing document from IndexedDB on startup
  useEffect(() => {
    getActiveDocument().then((doc) => {
      if (doc) {
        setActiveDoc(doc);
      }
      setIsReady(true);
    });
  }, []);

  // Hook do Oscar Engine HD
  const oscar = useOscarEngine(isOscarMode ? activeDoc : null);

  // Hook nativo clássico do Web Speech API (fallback ou escolha do usuário)
  const native = useTTS(!isOscarMode ? activeDoc : null);

  // Unifica a interface do motor ativo
  const active = isOscarMode ? oscar : native;

  // Cálculo de tempo estimado de conclusão em minutos
  const wordsRemaining = (activeDoc?.pages.slice(active.currentPage - 1) || []).reduce(
    (acc, p) => acc + p.text.split(/\s+/).filter(Boolean).length,
    0
  );
  const estimatedMinutes = wordsRemaining > 0 ? Math.max(1, Math.ceil(wordsRemaining / (150 * active.rate))) : 0;

  // Sync background playback and lockscreen media controls
  useMediaSession({
    document: activeDoc,
    currentPage: active.currentPage,
    currentChunkIndex: active.currentChunkIndex,
    totalChunks: active.totalChunks,
    isPlaying: active.isPlaying,
    isPaused: active.isPaused,
    rate: active.rate,
    play: active.play,
    pause: active.pause,
    resume: active.resume,
    skipBackward: active.skipBackward,
    skipForward: active.skipForward,
    onHighlight: oscar.highlightCurrent,
  });

  const handleDocumentLoaded = (doc: StoredDocument) => {
    setActiveDoc(doc);
  };

  const handleSelectDocument = (doc: StoredDocument) => {
    active.pause();
    setActiveDocId(doc.id ?? null);
    setActiveDoc(doc);
  };

  const handleUploadFromLibrary = () => {
    active.pause();
    setActiveDoc(null);
  };

  const handleRemoveDocument = async () => {
    active.pause();
    if (activeDoc?.id) {
      await deleteDocument(activeDoc.id);
    }
    setActiveDoc(null);
  };

  const handleToggleOscarMode = () => {
    active.pause();
    setIsOscarMode((prev) => !prev);
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
            <p className="text-xs text-slate-400">OscarVoice Engine v3.0 • 100% Client-Side</p>
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
                Transforme seus PDFs em audiolivros de cinema
              </h2>
              <p className="text-sm text-slate-400">
                Ouça livros e apostilas com voz humana neural, áudio 3D e ritmo inteligente no seu navegador.
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

            {/* Painel de Controle de Superpoderes do Oscar Engine */}
            <OscarControls
              isOscarActive={isOscarMode}
              onToggleOscar={handleToggleOscarMode}
              bionicEnabled={oscar.bionicEnabled}
              onToggleBionic={oscar.toggleBionic}
              spatialAudioEnabled={oscar.spatialAudioEnabled}
              onToggleSpatialAudio={oscar.toggleSpatialAudio}
              breathEnabled={oscar.breathEnabled}
              onToggleBreath={oscar.toggleBreath}
              isOfflineFallback={oscar.isOfflineFallback}
              currentRole={oscar.currentChunkRole}
              voices={oscar.availableVoices}
              selectedVoiceId={oscar.selectedVoiceId}
              onVoiceChange={oscar.setVoice}
              onPreviewVoice={oscar.previewVoice}
              voiceStyle={oscar.voiceStyle}
              voiceStylesList={oscar.voiceStylesList}
              onVoiceStyleChange={oscar.setVoiceStyle}
              onPreviewStyle={oscar.previewStyle}
              onExportAudio={oscar.exportAudio}
              disabled={active.totalChunks === 0}
            />

            {/* Visual Progress Bar & Spotify-lyrics focused view */}
            <ProgressBar
              currentPage={active.currentPage}
              totalPages={activeDoc.totalPages}
              currentChunkIndex={active.currentChunkIndex}
              totalChunks={active.totalChunks}
              currentTextSnippet={active.currentChunkText}
              previousTextSnippet={isOscarMode ? oscar.previousChunkText : undefined}
              nextTextSnippet={isOscarMode ? oscar.nextChunkText : undefined}
              highlightWord={isOscarMode ? oscar.highlightWord : null}
              onGoToPage={active.goToPage}
              disabled={active.totalChunks === 0}
            />

            {/* Audio Controls (Play, Pause, Skip ±1 Frase, Rate, Pocket Mode, Highlights, Chapters) */}
            <PlayerControls
              isPlaying={active.isPlaying}
              isPaused={active.isPaused}
              isFinished={active.isFinished}
              onPlay={active.play}
              onPause={active.pause}
              onResume={active.resume}
              onRestart={active.restart}
              onSkipBackward={active.skipBackward}
              onSkipForward={active.skipForward}
              rate={active.rate}
              onRateChange={active.setRate}
              voices={!isOscarMode ? native.voiceOptions : []}
              selectedVoiceId={!isOscarMode ? native.selectedVoiceId : ''}
              onVoiceChange={!isOscarMode ? native.setVoice : () => {}}
              estimatedMinutes={estimatedMinutes}
              onTogglePocketMode={() => setIsPocketModeOpen(true)}
              onHighlightCurrent={isOscarMode ? oscar.highlightCurrent : undefined}
              hasChapters={Boolean(activeDoc.chapters && activeDoc.chapters.length > 0)}
              onOpenChapters={() => setIsChaptersOpen(true)}
              onOpenHighlights={() => setIsHighlightsOpen(true)}
              disabled={active.totalChunks === 0}
            />
          </div>
        )}
      </main>

      {/* Pocket Mode Modal (AMOLED) */}
      {activeDoc && (
        <PocketModeModal
          isOpen={isPocketModeOpen}
          onClose={() => setIsPocketModeOpen(false)}
          title={activeDoc.fileName}
          currentPage={active.currentPage}
          totalPages={activeDoc.totalPages}
          currentText={active.currentChunkText}
          isPlaying={active.isPlaying}
          isPaused={active.isPaused}
          estimatedMinutes={estimatedMinutes}
          onPlayToggle={() => {
            if (active.isPlaying) active.pause();
            else active.resume();
          }}
          onSkipBackward={active.skipBackward}
          onSkipForward={active.skipForward}
          onHighlight={oscar.highlightCurrent}
        />
      )}

      {/* Chapters Outline Drawer */}
      {activeDoc?.chapters && (
        <ChapterDrawer
          isOpen={isChaptersOpen}
          onClose={() => setIsChaptersOpen(false)}
          chapters={activeDoc.chapters}
          currentPage={active.currentPage}
          onSelectChapter={active.goToPage}
        />
      )}

      {/* Highlights Modal */}
      <HighlightsModal
        isOpen={isHighlightsOpen}
        onClose={() => setIsHighlightsOpen(false)}
        docId={activeDoc?.id}
        onJumpToPage={active.goToPage}
      />

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
        PDF Voice • OscarVoice Engine v3.0 • 100% Client-Side • PWA Offline • Custo Marginal Zero
      </footer>
    </div>
  );
}

export default App;
