import { useRef, useState, useCallback, useEffect } from 'react';

// Copied verbatim from the original Python project's App.tsx audio logic.
// Uses plain HTMLAudioElement with data URIs — no AudioContext, no unlock dance.
// The original project works with this approach on localhost.

export function unlockAudio(): void {
  // No-op — kept so call-sites in App.tsx don't break.
  // The original project doesn't need any unlock; autoplay works on localhost.
}

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const queue = useRef<string[]>([]);          // base64 WAV strings (same as original)
  const playing = useRef(false);               // isPlayingRef in original
  const current = useRef<HTMLAudioElement | null>(null); // currentAudioRef in original

  const playNext = useCallback(() => {
    if (queue.current.length === 0 || playing.current) return;
    playing.current = true;
    setIsPlaying(true);

    const b64 = queue.current.shift()!;
    const audio = new Audio(`data:audio/wav;base64,${b64}`);
    current.current = audio;

    audio.onended = () => {
      playing.current = false;
      current.current = null;
      if (queue.current.length === 0) setIsPlaying(false);
      playNext();
    };
    audio.onerror = () => {
      playing.current = false;
      current.current = null;
      if (queue.current.length === 0) setIsPlaying(false);
      playNext();
    };
    audio.play().catch(() => {
      playing.current = false;
      current.current = null;
      if (queue.current.length === 0) setIsPlaying(false);
      playNext();
    });
  }, []);

  // enqueue receives raw base64 string, exactly like original:
  // audioQueue.current.push(data.data); playNextAudio();
  const enqueue = useCallback((b64: string) => {
    queue.current.push(b64);
    if (!playing.current) playNext();
  }, [playNext]);

  const interrupt = useCallback(() => {
    queue.current = [];
    if (current.current) {
      current.current.pause();
      current.current.src = '';
      current.current = null;
    }
    playing.current = false;
    setIsPlaying(false);
  }, []);

  useEffect(() => () => { interrupt(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isPlaying, enqueue, interrupt };
}
