'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export function useSound(
  url: string,
  { volume = 1, playbackRate = 1, loop = false }: { volume?: number; playbackRate?: number, loop?: boolean } = {}
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audioEl = new Audio(url);
    audioRef.current = audioEl;

    return () => {
      audioEl.pause();
      audioRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);
  
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = loop;
    }
  }, [loop]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => {
        // Autoplay was prevented. This is a common browser policy.
        console.warn('Audio play was prevented:', error);
      });
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  return { play, stop };
}
