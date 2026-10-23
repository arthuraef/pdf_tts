import { useState, useEffect, useCallback } from 'react';
import { Headphones, ArrowLeft, Trash2, Smartphone, BookOpen, Star, Sliders } from 'lucide-react';
import { BookshelfView } from './components/BookshelfView';
import { BookCover } from './components/BookCover';
import { PlayerControls } from './components/PlayerControls';
import { ProgressBar } from './components/ProgressBar';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { PocketModeModal } from './components/PocketModeModal';
import { ChapterDrawer } from './components/ChapterDrawer';
import { HighlightsModal } from './components/HighlightsModal';
import { VoiceStudioModal } from './components/VoiceStudioModal';
import { useOscarEngine } from './hooks/useOscarEngine';
import { useMediaSession } from './hooks/useMediaSession';
import {
  getActiveDocument,
  getAllDocumentsWithProgress,
  deleteDocument,
  setActiveDocId,
} from './storage/db';
import type { StoredDocument, DocumentWithProgress } from './types';

export function App() {
  // A tela inicial SEMPRE abre na Biblioteca
  const [currentView, setCurrentView] = useState<'library' | 'player'>('library');
  const [documents, setDocuments] = useState<DocumentWithProgress[]>([]);
  const [activeDoc, setActiveDoc] = useState<StoredDocument | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Modais auxiliares
  const [isPocketModeOpen, setIsPocketModeOpen] = useState(false);
  const [isChaptersOpen, setIsChaptersOpen] = useState(false);
  const [isHighlightsOpen, setIsHighlightsOpen] = useState(false);
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);

  // Recarrega lista completa de documentos com progresso
  const loadDocuments = useCallback(async () => {
    try {
      const docs = await getAllDocumentsWithProgress();
      setDocuments(docs);
      return docs;
    } catch (e) {
      console.warn('[App] Erro ao carregar documentos:', e);
      return [];
    }
  }, []);

  // Inicialização: carrega livros da estante e documento ativo
  useEffect(() => {
    async function init() {
      const docs = await loadDocuments();
      const current = await getActiveDocument();
      if (current) {
        setActiveDoc(current);
      } else if (docs.length > 0) {
        setActiveDoc(docs[0]);
      }
      setIsReady(true);
    }
    init();
  }, [loadDocuments]);

  // Motor Oscar HD Neural sempre ativo por padrão (sem switches visíveis)
  const oscar = useOscarEngine(activeDoc);

  // Tempo estimado restante
  const wordsRemaining = (activeDoc?.pages.slice(oscar.currentPage - 1) || []).reduce(
    (acc, p) => acc + p.text.split(/\s+/).filter(Boolean).length,
    0
  );
  const estimatedMinutes =
    wordsRemaining > 0 ? Math.max(1, Math.ceil(wordsRemaining / (150 * oscar.rate))) : 0;

  // Background playback & lockscreen media controls
  useMediaSession({
    document: activeDoc,
    currentPage: oscar.currentPage,
    currentChunkIndex: oscar.currentChunkIndex,
    totalChunks: oscar.totalChunks,
    isPlaying: oscar.isPlaying,
    isPaused: oscar.isPaused,
    rate: oscar.rate,
    play: oscar.play,
    pause: oscar.pause,
    resume: oscar.resume,
    skipBackward: oscar.skipBackward,
    skipForward: oscar.skipForward,
    onHighlight: oscar.highlightCurrent,
  });

  // Manipulador quando um livro é selecionado na Biblioteca
  const handleSelectDocument = (doc: StoredDocument) => {
    oscar.pause();
    setActiveDoc(doc);
    if (doc.id) {
      setActiveDocId(doc.id);
    }
    // Entra na tela de player
    setCurrentView('player');
  };

  // Manipulador quando um novo PDF é carregado
  const handleDocumentUploaded = async (doc: StoredDocument) => {
    oscar.pause();
    setActiveDoc(doc);
    if (doc.id) {
      setActiveDocId(doc.id);
    }
    await loadDocuments();
    // Transiciona direto para o player do livro carregado
    setCurrentView('player');
  };

  // Excluir livro da biblioteca
  const handleDeleteDocument = async (id: number) => {
    oscar.pause();
    await deleteDocument(id);
    const updated = await loadDocuments();
    if (activeDoc?.id === id) {
      setActiveDoc(updated.length > 0 ? updated[0] : null);
      if (updated.length === 0) {
        setCurrentView('library');
      }
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-850">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white m-0">PDF Voice</h1>
            <p className="text-xs text-slate-400 font-mono">100% Client-Side • Som de Cinema</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentView === 'player' ? (
            <button
              type="button"
              onClick={() => setCurrentView('library')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 transition text-xs font-semibold cursor-pointer shadow-sm"
              title="Voltar para a biblioteca de livros"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-400" />
              <span>Biblioteca</span>
            </button>
          ) : (
            activeDoc && (
              <button
                type="button"
                onClick={() => setCurrentView('player')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 transition text-xs font-semibold cursor-pointer shadow-sm"
                title="Ir para o player do livro em andamento"
              >
                <Headphones className="w-4 h-4 text-indigo-400" />
                <span>Player</span>
              </button>
            )
          )}

          <PWAInstallPrompt />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl w-full mx-auto my-auto py-6 sm:py-8">
        {currentView === 'library' ? (
          /* TELA 1: BIBLIOTECA (Aberta por padrão com função de adicionar novos PDFs) */
          <BookshelfView
            documents={documents}
            activeDocId={activeDoc?.id}
            onSelectDocument={handleSelectDocument}
            onDocumentUploaded={handleDocumentUploaded}
            onDeleteDocument={handleDeleteDocument}
          />
        ) : !activeDoc ? (
          /* Se nenhum livro estiver carregado, volta para a biblioteca */
          <div className="text-center py-12 space-y-4">
            <p className="text-slate-400">Nenhum livro selecionado no momento.</p>
            <button
              type="button"
              onClick={() => setCurrentView('library')}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
            >
              Ir para a Biblioteca
            </button>
          </div>
        ) : (
          /* TELA 2: PLAYER DE ÁUDIO & LEITURA (Inspirada nas referências 2, 3 e 4) */
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
            {/* Top Player Action Bar */}
            <div className="flex items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl px-4 py-3">
              <button
                type="button"
                onClick={() => setCurrentView('library')}
                className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-400" />
                <span>Biblioteca</span>
              </button>

              <div className="flex items-center gap-2">
                {activeDoc.chapters && activeDoc.chapters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsChaptersOpen(true)}
                    className="p-2 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition cursor-pointer"
                    title="Capítulos e Índice"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsHighlightsOpen(true)}
                  className="p-2 rounded-xl text-amber-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                  title="Ver Frases Grifadas"
                >
                  <Star className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsVoiceStudioOpen(true)}
                  className="p-2 rounded-xl text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 transition cursor-pointer"
                  title="VoiceStudio • Aprimorador de Voz HD"
                >
                  <Sliders className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsPocketModeOpen(true)}
                  className="p-2 rounded-xl text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 transition cursor-pointer"
                  title="Modo Bolso (AMOLED)"
                >
                  <Smartphone className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => activeDoc.id && handleDeleteDocument(activeDoc.id)}
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                  title="Remover livro"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Hero Stage: 3D Book Cover & Full Title Wrapping */}
            <div className="flex flex-col items-center text-center space-y-4 pt-2">
              <BookCover
                title={activeDoc.fileName}
                coverUrl={activeDoc.coverUrl}
                size="hero"
              />

              <div className="space-y-1.5 max-w-xl px-2">
                {/* Nome completo do livro com quebra de linha natural (break-words) */}
                <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-white tracking-tight leading-snug break-words">
                  {activeDoc.fileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')}
                </h2>

                <p className="text-xs sm:text-sm text-slate-400 font-sans">
                  Página {oscar.currentPage} de {activeDoc.totalPages}
                  {estimatedMinutes > 0 && ` • ~${estimatedMinutes} min restantes`}
                </p>
              </div>
            </div>

            {/* Visual Scrubber & Focused Karaoke Lyrics View */}
            <ProgressBar
              currentPage={oscar.currentPage}
              totalPages={activeDoc.totalPages}
              currentChunkIndex={oscar.currentChunkIndex}
              totalChunks={oscar.totalChunks}
              currentTextSnippet={oscar.currentChunkText}
              previousTextSnippet={oscar.previousChunkText}
              nextTextSnippet={oscar.nextChunkText}
              highlightWord={oscar.highlightWord}
              onGoToPage={oscar.goToPage}
              disabled={oscar.totalChunks === 0}
            />

            {/* Audio Controls (3 Narration Styles, Circular Play Button, Skip 1 Frase, Speed Pills) */}
            <PlayerControls
              isPlaying={oscar.isPlaying}
              isPaused={oscar.isPaused}
              isFinished={oscar.isFinished}
              onPlay={oscar.play}
              onPause={oscar.pause}
              onResume={oscar.resume}
              onRestart={oscar.restart}
              onSkipBackward={oscar.skipBackward}
              onSkipForward={oscar.skipForward}
              rate={oscar.rate}
              onRateChange={oscar.setRate}
              voiceStyle={oscar.voiceStyle}
              voiceStylesList={oscar.voiceStylesList}
              onVoiceStyleChange={oscar.setVoiceStyle}
              onHighlightCurrent={oscar.highlightCurrent}
              onOpenVoiceStudio={() => setIsVoiceStudioOpen(true)}
              selectedModelLabel={
                oscar.activeVoiceModel
                  ? `${oscar.activeVoiceModel.emoji} ${oscar.activeVoiceModel.label.split('(')[0].trim()}`
                  : 'Google Brasil HD'
              }
              selectedModelId={oscar.selectedModelId}
              availableVoiceModels={oscar.availableVoiceModels}
              onSelectModel={oscar.setModel}
              disabled={oscar.totalChunks === 0}
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
          currentPage={oscar.currentPage}
          totalPages={activeDoc.totalPages}
          currentText={oscar.currentChunkText}
          isPlaying={oscar.isPlaying}
          isPaused={oscar.isPaused}
          estimatedMinutes={estimatedMinutes}
          onPlayToggle={() => {
            if (oscar.isPlaying) oscar.pause();
            else oscar.resume();
          }}
          onSkipBackward={oscar.skipBackward}
          onSkipForward={oscar.skipForward}
          onHighlight={oscar.highlightCurrent}
        />
      )}

      {/* Chapters Outline Drawer */}
      {activeDoc?.chapters && (
        <ChapterDrawer
          isOpen={isChaptersOpen}
          onClose={() => setIsChaptersOpen(false)}
          chapters={activeDoc.chapters}
          currentPage={oscar.currentPage}
          onSelectChapter={oscar.goToPage}
        />
      )}

      {/* Highlights Modal */}
      <HighlightsModal
        isOpen={isHighlightsOpen}
        onClose={() => setIsHighlightsOpen(false)}
        docId={activeDoc?.id}
        onJumpToPage={oscar.goToPage}
      />

      {/* VoiceStudio Enhancer Modal */}
      <VoiceStudioModal
        isOpen={isVoiceStudioOpen}
        onClose={() => setIsVoiceStudioOpen(false)}
        config={oscar.voiceStudioConfig}
        onChangeConfig={oscar.setVoiceStudioConfig}
        onSelectPreset={oscar.setVoiceStudioPreset}
        onPreview={oscar.previewVoiceStudio}
        selectedVoiceName={
          oscar.availableVoices.find((v) => v.id === oscar.selectedVoiceId)?.label ||
          'Google Brasil (Online)'
        }
        selectedVoiceId={oscar.selectedVoiceId}
        availableVoices={oscar.availableVoices}
        onSelectVoice={oscar.setVoice}
        selectedModelId={oscar.selectedModelId}
        onSelectModel={oscar.setModel}
      />

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center pt-6 border-t border-slate-850 text-xs text-slate-500 font-mono">
        PDF Voice • OscarVoice Engine v3.0 • 100% Client-Side • Custo Marginal Zero
      </footer>
    </div>
  );
}

export default App;
