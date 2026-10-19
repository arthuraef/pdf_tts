import Dexie, { type Table } from 'dexie';
import type { StoredDocument, PlaybackState, DocumentWithProgress } from '../types';

export interface AudioCacheItem {
  id: string; // Hash único do chunk
  docId: number;
  pageNumber: number;
  chunkIndex: number;
  audioBlob: Blob;
  timestamp: number;
}

export class PDFVoiceDatabase extends Dexie {
  documents!: Table<StoredDocument, number>;
  playbackStates!: Table<PlaybackState, number>;
  audioCache!: Table<AudioCacheItem, string>;

  constructor() {
    super('PDFVoiceDB');
    this.version(1).stores({
      documents: '++id, fileName, updatedAt',
      playbackStates: '++id, docId, updatedAt',
    });
    this.version(2).stores({
      documents: '++id, fileName, updatedAt',
      playbackStates: '++id, docId, updatedAt',
      audioCache: 'id, docId, pageNumber, timestamp',
    });
  }
}

export const db = new PDFVoiceDatabase();

const ACTIVE_DOC_STORAGE_KEY = 'pdf_voice_active_doc_id';

export function getActiveDocId(): number | null {
  try {
    const val = localStorage.getItem(ACTIVE_DOC_STORAGE_KEY);
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

export function setActiveDocId(id: number | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(ACTIVE_DOC_STORAGE_KEY);
    } else {
      localStorage.setItem(ACTIVE_DOC_STORAGE_KEY, id.toString());
    }
  } catch {
    // ignore
  }
}

export async function saveDocument(
  fileName: string,
  fileSize: number,
  pages: { pageNumber: number; text: string }[]
): Promise<number> {
  // Check if a document with the exact same name and size already exists
  const existing = await db.documents
    .where('fileName')
    .equals(fileName)
    .filter((doc) => doc.fileSize === fileSize)
    .first();

  const docData: StoredDocument = {
    fileName,
    fileSize,
    totalPages: pages.length,
    pages,
    createdAt: existing ? existing.createdAt : new Date(),
    updatedAt: new Date(),
  };

  let id: number;
  if (existing?.id) {
    await db.documents.update(existing.id, {
      ...docData,
      updatedAt: new Date(),
    });
    id = existing.id;
  } else {
    id = await db.documents.add(docData);
  }

  setActiveDocId(id);
  return id;
}

export async function getAllDocuments(): Promise<StoredDocument[]> {
  return await db.documents.orderBy('updatedAt').reverse().toArray();
}

export async function getDocumentById(id: number): Promise<StoredDocument | undefined> {
  return await db.documents.get(id);
}

export async function getActiveDocument(): Promise<StoredDocument | undefined> {
  const activeId = getActiveDocId();
  if (activeId) {
    const doc = await db.documents.get(activeId);
    if (doc) return doc;
  }
  // Fallback: get the most recently updated document
  const recent = await db.documents.orderBy('updatedAt').reverse().first();
  if (recent?.id) {
    setActiveDocId(recent.id);
  }
  return recent;
}

export async function deleteDocument(id: number): Promise<void> {
  await db.documents.delete(id);
  await db.playbackStates.where('docId').equals(id).delete();

  if (getActiveDocId() === id) {
    setActiveDocId(null);
  }
}

export async function getAllDocumentsWithProgress(): Promise<DocumentWithProgress[]> {
  const docs = await db.documents.orderBy('updatedAt').reverse().toArray();
  const result: DocumentWithProgress[] = [];

  for (const doc of docs) {
    if (!doc.id) continue;
    const progress = await db.playbackStates.where('docId').equals(doc.id).first();
    let percentage = 0;
    if (progress && doc.totalPages > 0) {
      percentage = Math.min(100, Math.round(((progress.pageIndex + 1) / doc.totalPages) * 100));
    }
    result.push({
      ...doc,
      progress,
      progressPercentage: percentage,
    });
  }

  return result;
}

export async function savePlaybackProgress(
  docId: number,
  pageIndex: number,
  chunkIndex: number,
  playbackRate: number
): Promise<void> {
  const existing = await db.playbackStates.where('docId').equals(docId).first();
  const stateData: PlaybackState = {
    docId,
    pageIndex,
    chunkIndex,
    playbackRate,
    updatedAt: new Date(),
  };

  if (existing?.id) {
    await db.playbackStates.update(existing.id, stateData);
  } else {
    await db.playbackStates.add(stateData);
  }

  // Touch the document's updatedAt so it becomes the most recently read
  try {
    await db.documents.update(docId, { updatedAt: new Date() });
  } catch {
    // ignore
  }
}

export async function getPlaybackProgress(docId: number): Promise<PlaybackState | undefined> {
  return await db.playbackStates.where('docId').equals(docId).first();
}

export async function clearActiveDocument(): Promise<void> {
  const activeId = getActiveDocId();
  if (activeId) {
    await deleteDocument(activeId);
  }
}

/**
 * Busca áudio no cache local por ID.
 */
export async function getCachedAudio(id: string): Promise<Blob | null> {
  try {
    const item = await db.audioCache.get(id);
    if (item) {
      // Atualiza timestamp para controle LRU
      await db.audioCache.update(id, { timestamp: Date.now() });
      return item.audioBlob;
    }
  } catch (err) {
    console.warn('Erro ao ler cache de áudio:', err);
  }
  return null;
}

/**
 * Salva chunk de áudio no cache local, garantindo limite LRU de 50 entradas.
 */
export async function saveAudioToCache(
  id: string,
  docId: number,
  pageNumber: number,
  chunkIndex: number,
  audioBlob: Blob
): Promise<void> {
  try {
    await db.audioCache.put({
      id,
      docId,
      pageNumber,
      chunkIndex,
      audioBlob,
      timestamp: Date.now(),
    });

    // Controle LRU: se passar de 50 chunks, remove os mais antigos
    const count = await db.audioCache.count();
    if (count > 50) {
      const excess = count - 50;
      const oldestKeys = await db.audioCache.orderBy('timestamp').limit(excess).primaryKeys();
      await db.audioCache.bulkDelete(oldestKeys);
    }
  } catch (err) {
    console.warn('Erro ao salvar no cache de áudio:', err);
  }
}

/**
 * Remove chunks cacheados de um documento específico.
 */
export async function clearAudioCacheForDoc(docId: number): Promise<void> {
  try {
    await db.audioCache.where('docId').equals(docId).delete();
  } catch (err) {
    console.warn('Erro ao limpar cache de áudio do doc:', err);
  }
}

