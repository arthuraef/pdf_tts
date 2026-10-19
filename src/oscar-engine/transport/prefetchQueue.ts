/**
 * Esteira Rolante "Zero Silêncio" (prefetchQueue.ts)
 * Implementa o padrão Producer-Consumer com Lookahead = 3,
 * cache persistente no IndexedDB e descarte de buffers antigos para evitar Memory Leaks.
 */

import type { ActingScoreChunk } from '../types';
import { edgeNeuralClient, type WordBoundaryEvent } from './edgeNeuralClient';
import { getCachedAudio, saveAudioToCache } from '../../storage/db';

export interface PreparedChunkAudio {
  chunkId: string;
  audioBuffer: AudioBuffer | null;
  wordBoundaries: WordBoundaryEvent[];
  isFallback: boolean; // Se true, reproduz via Web Speech API nativa
}

export class PrefetchQueue {
  private chunks: ActingScoreChunk[] = [];
  private audioCtx: AudioContext | null = null;
  private ramCache = new Map<string, PreparedChunkAudio>();
  private inFlightRequests = new Set<string>();
  private lookahead: number = 3;
  private maxRamItems: number = 5;

  constructor(audioCtx?: AudioContext) {
    if (audioCtx) {
      this.audioCtx = audioCtx;
    }
  }

  public setAudioContext(audioCtx: AudioContext): void {
    this.audioCtx = audioCtx;
  }

  public setChunks(chunks: ActingScoreChunk[]): void {
    this.clear();
    this.chunks = chunks;
  }

  public clear(): void {
    // 🛡️ Lei 1: Limpeza ativa da memória RAM
    for (const item of this.ramCache.values()) {
      item.audioBuffer = null;
    }
    this.ramCache.clear();
    this.inFlightRequests.clear();
  }

  /**
   * Obtém o áudio preparado para o chunk atual.
   * Dispara imediatamente o pré-carregamento dos próximos chunks (N+1, N+2, N+3).
   */
  public async getOrFetch(index: number, docId: number = 1): Promise<PreparedChunkAudio> {
    if (index < 0 || index >= this.chunks.length) {
      throw new Error(`Índice fora do intervalo da fila: ${index}`);
    }

    const chunk = this.chunks[index];

    // Despeja chunks antigos da RAM para manter no máximo 5 itens
    this.pruneOldRamEntries(index);

    // Dispara o pré-carregamento dos próximos chunks em background
    this.triggerPrefetch(index + 1, docId);

    // Se já estiver na RAM, retorna instantaneamente
    if (this.ramCache.has(chunk.id)) {
      return this.ramCache.get(chunk.id)!;
    }

    // Se não estiver na RAM, carrega agora (do IndexedDB ou da rede)
    const prepared = await this.loadSingleChunk(chunk, docId);
    this.ramCache.set(chunk.id, prepared);
    return prepared;
  }

  /**
   * Dispara o pré-carregamento dos próximos chunks até a janela de Lookahead.
   */
  public triggerPrefetch(startIndex: number, docId: number): void {
    const endIndex = Math.min(this.chunks.length, startIndex + this.lookahead);

    for (let i = startIndex; i < endIndex; i++) {
      const targetChunk = this.chunks[i];
      if (!this.ramCache.has(targetChunk.id) && !this.inFlightRequests.has(targetChunk.id)) {
        this.inFlightRequests.add(targetChunk.id);

        this.loadSingleChunk(targetChunk, docId)
          .then((prepared) => {
            this.ramCache.set(targetChunk.id, prepared);
          })
          .catch((err) => {
            console.warn(`Pré-carregamento falhou para chunk ${targetChunk.id}:`, err);
            // Salva na RAM como fallback nativo para não travar na hora de tocar
            this.ramCache.set(targetChunk.id, {
              chunkId: targetChunk.id,
              audioBuffer: null,
              wordBoundaries: [],
              isFallback: true,
            });
          })
          .finally(() => {
            this.inFlightRequests.delete(targetChunk.id);
          });
      }
    }
  }

  /**
   * Carrega um único chunk: tenta do IndexedDB; se não houver, baixa da rede e salva no cache.
   */
  private async loadSingleChunk(
    chunk: ActingScoreChunk,
    docId: number
  ): Promise<PreparedChunkAudio> {
    // 1. Tenta carregar do cache local IndexedDB (Cachê Inteligente)
    const cachedBlob = await getCachedAudio(chunk.id);
    if (cachedBlob && this.audioCtx) {
      try {
        const arrayBuffer = await cachedBlob.arrayBuffer();
        const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
        return {
          chunkId: chunk.id,
          audioBuffer,
          wordBoundaries: [],
          isFallback: false,
        };
      } catch (err) {
        console.warn('Erro ao decodificar áudio do cache local:', err);
      }
    }

    // 2. Se não estiver no cache, baixa via Edge Neural TTS com timeout de 2s
    try {
      const result = await edgeNeuralClient.synthesizeSSML(chunk.ssmlPayload, 2000);

      // Salva no IndexedDB em background
      saveAudioToCache(
        chunk.id,
        docId,
        chunk.pageNumber,
        chunk.chunkIndex,
        result.audioBlob
      ).catch(() => {});

      let decodedBuffer: AudioBuffer | null = null;
      if (this.audioCtx) {
        const arrayBuffer = await result.audioBlob.arrayBuffer();
        decodedBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      }

      return {
        chunkId: chunk.id,
        audioBuffer: decodedBuffer,
        wordBoundaries: result.wordBoundaries,
        isFallback: false,
      };
    } catch (err) {
      // 🛡️ Lei 2: Se estourar 2000ms ou cair a rede, aciona o fallback nativo
      return {
        chunkId: chunk.id,
        audioBuffer: null,
        wordBoundaries: [],
        isFallback: true,
      };
    }
  }

  /**
   * 🛡️ Lei 1: Mantém no máximo maxRamItems na memória RAM, liberando o Garbage Collector.
   */
  private pruneOldRamEntries(currentIndex: number): void {
    const keepIds = new Set<string>();

    const start = Math.max(0, currentIndex - 1);
    const end = Math.min(this.chunks.length, currentIndex + this.maxRamItems - 1);

    for (let i = start; i < end; i++) {
      keepIds.add(this.chunks[i].id);
    }

    for (const [id, item] of this.ramCache.entries()) {
      if (!keepIds.has(id)) {
        item.audioBuffer = null;
        this.ramCache.delete(id);
      }
    }
  }
}
