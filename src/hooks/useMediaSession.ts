import { useEffect, useRef } from 'react';
import type { StoredDocument } from '../types';

interface MediaSessionProps {
  document: StoredDocument | null;
  currentPage: number;
  currentChunkIndex: number;
  totalChunks: number;
  isPlaying: boolean;
  isPaused: boolean;
  rate: number;
  play: () => void;
  pause: () => void;
  resume: () => void;
  skipBackward: () => void;
  skipForward: () => void;
}

export function useMediaSession({
  document,
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
}: MediaSessionProps) {
  // Keep references to latest callbacks so event listeners don't become stale
  const callbacksRef = useRef({ play, pause, resume, skipBackward, skipForward, isPaused });
  callbacksRef.current = { play, pause, resume, skipBackward, skipForward, isPaused };

  // Register MediaSession actions
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const actionHandlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => {
        if (callbacksRef.current.isPaused) {
          callbacksRef.current.resume();
        } else {
          callbacksRef.current.play();
        }
      }],
      ['pause', () => callbacksRef.current.pause()],
      ['stop', () => callbacksRef.current.pause()],
      ['seekbackward', () => callbacksRef.current.skipBackward()],
      ['seekforward', () => callbacksRef.current.skipForward()],
      ['previoustrack', () => callbacksRef.current.skipBackward()],
      ['nexttrack', () => callbacksRef.current.skipForward()],
    ];

    actionHandlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (_) {
        // Some browsers don't support all actions
      }
    });

    return () => {
      actionHandlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (_) {
          // ignore
        }
      });
    };
  }, []);

  // Update MediaSession metadata (Title, Artist, Album, Artwork)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !document) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: document.fileName,
        artist: `Página ${currentPage} de ${document.totalPages}`,
        album: 'PDF Voice',
        artwork: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      });
    } catch (err) {
      console.warn('[useMediaSession] Failed to update metadata:', err);
    }
  }, [document, currentPage]);

  // Update playbackState ('playing' | 'paused' | 'none')
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.playbackState = isPlaying
        ? 'playing'
        : isPaused
        ? 'paused'
        : 'none';
    } catch (_) {
      // ignore
    }
  }, [isPlaying, isPaused]);

  // Update position state for scrub bars on supported lock screens
  useEffect(() => {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    if (totalChunks <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(totalChunks, 1),
        position: Math.min(currentChunkIndex, totalChunks),
        playbackRate: rate,
      });
    } catch (_) {
      // Browsers may throw if position > duration
    }
  }, [currentChunkIndex, totalChunks, rate]);
}
