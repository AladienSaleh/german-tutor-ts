import { useRef, useState, useCallback, useEffect } from 'react';

const MIN_DURATION_MS = 1500;

export interface RecorderState {
  isRecording: boolean;
  audioLevel: number; // 0–1 for waveform bars
}

export function useAudioRecorder(
  onAudioReady: (blob: Blob) => void,
  enabled: boolean,
) {
  const [state, setState] = useState<RecorderState>({ isRecording: false, audioLevel: 0 });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const minTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number>(0);
  const stoppingRef = useRef(false);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    cancelAnimationFrame(frameRef.current);
  }, []);

  const stopRecording = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    if (minTimerRef.current) { clearTimeout(minTimerRef.current); minTimerRef.current = null; }
    recorderRef.current?.stop();
    setState(s => ({ ...s, isRecording: false, audioLevel: 0 }));
    cleanupStream();
    stoppingRef.current = false;
  }, [cleanupStream]);

  const startRecording = useCallback(async () => {
    if (state.isRecording || !enabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const measureLevel = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length / 255;
        setState(s => ({ ...s, audioLevel: avg }));
        frameRef.current = requestAnimationFrame(measureLevel);
      };
      frameRef.current = requestAnimationFrame(measureLevel);

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        cancelAnimationFrame(frameRef.current);
        if (chunksRef.current.length > 0) {
          onAudioReady(new Blob(chunksRef.current, { type: 'audio/webm' }));
        }
        chunksRef.current = [];
      };

      recorder.start();
      startTimeRef.current = Date.now();
      stoppingRef.current = false;
      setState({ isRecording: true, audioLevel: 0 });
    } catch (err) {
      console.error('[Recorder] mic error:', err);
      cleanupStream();
    }
  }, [state.isRecording, enabled, onAudioReady, cleanupStream]);

  const handleRelease = useCallback(() => {
    if (!state.isRecording) return;
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = MIN_DURATION_MS - elapsed;
    if (remaining > 0) {
      minTimerRef.current = setTimeout(stopRecording, remaining);
    } else {
      stopRecording();
    }
  }, [state.isRecording, stopRecording]);

  // Spacebar push-to-talk
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && enabled) { e.preventDefault(); startRecording(); }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); handleRelease(); }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [enabled, startRecording, handleRelease]);

  return { ...state, startRecording, stopRecording: handleRelease };
}
