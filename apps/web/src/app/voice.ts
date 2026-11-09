import { VOICE_MAX_SECONDS, VOICE_TYPES } from "@apex/core";
import { useEffect, useRef, useState } from "react";

/** True when this browser can record audio (every current phone browser can). */
export const canRecord = () => typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/** Records a voice note with the browser's own recorder. Stops by itself at the two-minute limit. No extra libraries. */
export function useVoiceRecorder(onDone: (audio: Blob, seconds: number) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const cancelled = useRef(false);
  const timer = useRef<number | null>(null);
  const done = useRef(onDone);
  done.current = onDone;

  const cleanup = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    rec.current?.stream.getTracks().forEach((t) => t.stop());
    rec.current = null;
    setRecording(false);
  };
  useEffect(() => () => { cancelled.current = true; if (rec.current?.state === "recording") rec.current.stop(); cleanup(); }, []);

  const stop = (send: boolean) => {
    cancelled.current = !send;
    if (rec.current?.state === "recording") rec.current.stop();
    else cleanup();
  };

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = VOICE_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
    const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    cancelled.current = false;
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = () => {
      const secs = (Date.now() - started.current) / 1000;
      const type = (r.mimeType || mimeType || "audio/webm").split(";")[0]!;
      cleanup();
      if (!cancelled.current && chunks.current.length) done.current(new Blob(chunks.current, { type }), secs);
    };
    rec.current = r;
    started.current = Date.now();
    setSeconds(0);
    r.start(250);
    setRecording(true);
    timer.current = window.setInterval(() => {
      const s = (Date.now() - started.current) / 1000;
      setSeconds(s);
      if (s >= VOICE_MAX_SECONDS) stop(true);
    }, 250);
  };

  return { recording, seconds, start, send: () => stop(true), cancel: () => stop(false) };
}
