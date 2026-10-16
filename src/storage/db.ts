import Dexie, { type Table } from 'dexie';
import type { StoredDocument, PlaybackState } from '../types';

export class PDFVoiceDatabase extends Dexie {
  documents!: Table<StoredDocument, number>;
  playbackStates!: Table<PlaybackState, number>;

  constructor() {
    super('PDFVoiceDB');
    this.version(1).stores({
      documents: '++id, fileName, updatedAt',
      playbackStates: '++id, docId, updatedAt',
    });
  }
}

export const db = new PDFVoiceDatabase();

export async function saveDocument(
  fileName: string,
  fileSize: number,
  pages: { pageNumber: number; text: string }[]
): Promise<number> {
  const existing = await db.documents.orderBy('id').first();
  const docData: StoredDocument = {
    fileName,
    fileSize,
    totalPages: pages.length,
    pages,
    createdAt: existing ? existing.createdAt : new Date(),
    updatedAt: new Date(),
  };

  if (existing?.id) {
    await db.documents.put({ ...docData, id: existing.id });
    return existing.id;
  } else {
    return await db.documents.add(docData);
  }
}

export async function getActiveDocument(): Promise<StoredDocument | undefined> {
  return await db.documents.orderBy('id').last();
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
}

export async function getPlaybackProgress(docId: number): Promise<PlaybackState | undefined> {
  return await db.playbackStates.where('docId').equals(docId).first();
}

export async function clearActiveDocument(): Promise<void> {
  await db.documents.clear();
  await db.playbackStates.clear();
}
