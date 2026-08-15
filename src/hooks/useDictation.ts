'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_CLIP_SECONDS } from '@/lib/transcription';

export type DictationState = 'idle' | 'recording' | 'transcribing';

/**
 * Safari's MediaRecorder produces mp4/aac rather than webm/opus, and rejects a
 * mimeType it does not support outright, so the format is negotiated rather
 * than assumed. Whisper accepts both, but the filename extension has to match
 * what was actually recorded or the API rejects the upload.
 */
const CANDIDATE_TYPES = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4', extension: 'mp4' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
];

function pickAudioFormat(): { mimeType: string; extension: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return CANDIDATE_TYPES.find((c) => MediaRecorder.isTypeSupported(c.mimeType)) ?? null;
}

export interface UseDictationOptions {
  /** Receives the transcript. Append rather than replace, so dictation adds to what is typed. */
  onTranscript: (text: string) => void;
}

export interface UseDictation {
  state: DictationState;
  error: string | null;
  /** Seconds recorded so far, for the live countdown. */
  elapsed: number;
  isSupported: boolean;
  toggle: () => void;
  clearError: () => void;
}

export function useDictation({ onTranscript }: UseDictationOptions): UseDictation {
  const [state, setState] = useState<DictationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isSupported, setIsSupported] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // onTranscript is typically an inline arrow from the parent; holding it in a
  // ref keeps stop/start callbacks stable instead of re-created every render.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // getUserMedia and MediaRecorder are absent during SSR and on insecure
  // origins, so support is resolved after mount rather than at module scope.
  useEffect(() => {
    setIsSupported(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        pickAudioFormat() !== null
    );
  }, []);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    // 'inactive' means it already stopped — calling stop() again throws.
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, [clearTimers]);

  const start = useCallback(async () => {
    setError(null);

    const format = pickAudioFormat();
    if (!format) {
      setError('Your browser does not support voice recording.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Covers both an outright block and a dismissed prompt; the browser does
      // not reliably distinguish them.
      setError('Microphone access was denied.');
      return;
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: format.mimeType,
      audioBitsPerSecond: 32000,
    });
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = async () => {
      clearTimers();
      // Release the mic so the browser's recording indicator goes away rather
      // than lingering for the whole session.
      stream.getTracks().forEach((track) => track.stop());

      const blob = new Blob(chunksRef.current, { type: format.mimeType });
      chunksRef.current = [];

      // Nothing worth sending — a tap rather than a recording.
      if (blob.size < 1024) {
        setState('idle');
        setElapsed(0);
        return;
      }

      setState('transcribing');

      try {
        // Posted as the raw body, with the container in the query string: one
        // part, no multipart encoding on either side.
        const response = await fetch(`/api/transcribe?ext=${format.extension}`, {
          method: 'POST',
          headers: { 'Content-Type': format.mimeType },
          body: blob,
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Transcription failed.');
        } else if (data.text) {
          onTranscriptRef.current(data.text);
        }
      } catch {
        setError('Could not reach the transcription service.');
      } finally {
        setState('idle');
        setElapsed(0);
      }
    };

    recorder.start();
    setState('recording');
    setElapsed(0);

    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    // Server rejects anything longer, so stop here rather than letting the user
    // record a clip that will be thrown away.
    stopTimeoutRef.current = setTimeout(stop, MAX_CLIP_SECONDS * 1000);
  }, [clearTimers, stop]);

  const toggle = useCallback(() => {
    if (state === 'recording') stop();
    else if (state === 'idle') void start();
    // 'transcribing' is deliberately inert — the request is already in flight.
  }, [state, start, stop]);

  // Unmounting mid-recording would otherwise leave the microphone open.
  useEffect(() => {
    return () => {
      clearTimers();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [clearTimers]);

  return {
    state,
    error,
    elapsed,
    isSupported,
    toggle,
    clearError: useCallback(() => setError(null), []),
  };
}
