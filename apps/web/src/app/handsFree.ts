import { parseVoiceCommand, type VoiceCommand } from "@apex/core";
import { useCallback, useEffect, useRef, useState } from "react";

/* Hands-free: the phone talks (speechSynthesis) and listens (SpeechRecognition). Both are built into phone browsers,
   so there is nothing to install and nothing leaves the phone except what the browser's own recogniser needs.
   The mic pauses while the coach voice speaks, so it never hears itself. */

interface RecResult { isFinal: boolean; 0: { transcript: string } }
interface RecEvent { resultIndex: number; results: ArrayLike<RecResult> }
interface Rec {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: RecEvent) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecCtor = new () => Rec;

const recCtor = (): RecCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const handsFreeSupport = () => ({
  speak: typeof window !== "undefined" && "speechSynthesis" in window,
  listen: !!recCtor(),
});

/** Picks a British voice when the phone has one. */
function pickVoice(): SpeechSynthesisVoice | null {
  const all = window.speechSynthesis.getVoices();
  return all.find((v) => v.lang === "en-GB" && /natural|premium|enhanced/i.test(v.name)) ?? all.find((v) => v.lang === "en-GB") ?? all.find((v) => v.lang.startsWith("en")) ?? null;
}

export interface HandsFree {
  supported: { speak: boolean; listen: boolean };
  listening: boolean;
  /** The last thing heard, for the screen. */
  heard: string;
  /** Says it, after anything already being said. */
  say: (text: string, opts?: { interrupt?: boolean }) => void;
  /** "denied" when the mic was refused. */
  micProblem: string | null;
}

/** Speaks and listens while `on`. Every recognised phrase that is a command goes to onCommand. */
export function useHandsFree(on: boolean, onCommand: (c: VoiceCommand, heard: string) => void): HandsFree {
  const supported = useRef(handsFreeSupport()).current;
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [micProblem, setMicProblem] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);
  const wantOn = useRef(on);
  const speaking = useRef(0);
  const cmd = useRef(onCommand);
  cmd.current = onCommand;
  wantOn.current = on;

  const startRec = useCallback(() => {
    const R = recCtor();
    if (!R || !wantOn.current || speaking.current > 0 || rec.current) return;
    const r = new R();
    r.lang = "en-GB";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (!res.isFinal) continue;
        const text = res[0].transcript.trim();
        if (!text) continue;
        setHeard(text);
        const c = parseVoiceCommand(text);
        if (c) cmd.current(c, text);
      }
    };
    r.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { setMicProblem("denied"); wantOn.current = false; } };
    // Phones stop listening after a pause; start again while hands-free is on.
    r.onend = () => { rec.current = null; setListening(false); if (wantOn.current && speaking.current === 0) setTimeout(startRec, 250); };
    try { r.start(); rec.current = r; setListening(true); } catch { rec.current = null; }
  }, []);

  const stopRec = useCallback(() => {
    const r = rec.current;
    rec.current = null;
    setListening(false);
    if (r) { r.onend = null; try { r.abort(); } catch { /* already stopped */ } }
  }, []);

  const say = useCallback((text: string, opts?: { interrupt?: boolean }) => {
    if (!supported.speak || !text) return;
    const s = window.speechSynthesis;
    if (opts?.interrupt) { s.cancel(); speaking.current = 0; }
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "en-GB";
    u.rate = 1.02;
    speaking.current += 1;
    stopRec();
    const done = () => { speaking.current = Math.max(0, speaking.current - 1); if (speaking.current === 0) setTimeout(startRec, 200); };
    u.onend = done;
    u.onerror = done;
    s.speak(u);
  }, [supported.speak, startRec, stopRec]);

  useEffect(() => {
    if (on) { setMicProblem(null); startRec(); }
    else { stopRec(); speaking.current = 0; }
    return () => { stopRec(); };
  }, [on, startRec, stopRec]);

  return { supported, listening, heard, say, micProblem };
}

/** Keeps the screen awake while `on`, so the workout keeps running in a pocket. Asks again when the page comes back. */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } };
    if (!on || !nav.wakeLock) return;
    let lock: { release(): Promise<void> } | null = null;
    let live = true;
    const get = () => { nav.wakeLock!.request("screen").then((l) => { if (live) lock = l; else void l.release(); }).catch(() => { /* not allowed now */ }); };
    get();
    const vis = () => { if (document.visibilityState === "visible") get(); };
    document.addEventListener("visibilitychange", vis);
    return () => { live = false; document.removeEventListener("visibilitychange", vis); void lock?.release().catch(() => {}); };
  }, [on]);
}
