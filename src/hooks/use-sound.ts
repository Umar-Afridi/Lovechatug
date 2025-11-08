'use client';

import { useState, useEffect, useCallback } from 'react';

export function useSound(
  url: string,
  { volume = 1, playbackRate = 1 }: { volume?: number; playbackRate?: number } = {}
) {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audioEl = new Audio(url);
    setAudio(audioEl);

    return () => {
      audioEl.pause();
      setAudio(null);
    };
  }, [url]);

  useEffect(() => {
    if (audio) {
      audio.volume = volume;
    }
  }, [audio, volume]);

  useEffect(() => {
    if (audio) {
      audio.playbackRate = playbackRate;
    }
  }, [audio, playbackRate]);

  const play = useCallback(() => {
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(error => {
        // Autoplay was prevented. This is a common browser policy.
        console.warn('Audio play was prevented:', error);
      });
    }
  }, [audio]);

  return play;
}
