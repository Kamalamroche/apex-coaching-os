import { Icons } from "@apex/ui";
import { useEffect, useRef, useState } from "react";
import { introSeen, markIntroSeen } from "./Intro";

const SEEN_KEY = "apex.client.welcome";

/** True once the client has passed the welcome screen in this browser tab. Storage can be blocked
 *  (private mode, in-app browsers), so failures simply show the screen again. */
export function welcomeSeen(): boolean {
  try { return sessionStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
}

function markSeen() {
  try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* storage blocked: nothing to remember */ }
}

/**
 * Client welcome: the APEX brand reel plays once, full screen, and stops on its end card (APEX, Coaching OS).
 * The sign-in actions fade in on that end card. Browsers only autoplay muted video, so it starts silent with
 * a sound button; Skip jumps to the end card. If the reel was already seen in this tab (for example on the
 * landing page) or the person prefers reduced motion, the end card shows straight away.
 */
export function Welcome({ onContinue, demo }: { onContinue: () => void; demo: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reelSeen] = useState(introSeen);
  const [ended, setEnded] = useState(reelSeen);
  const [muted, setMuted] = useState(true);
  const go = () => { markSeen(); markIntroSeen(); onContinue(); };

  const finish = () => {
    markIntroSeen();
    setEnded(true);
    const v = ref.current;
    if (v) { v.pause(); if (Number.isFinite(v.duration)) v.currentTime = Math.max(0, v.duration - 0.05); }
  };

  useEffect(() => {
    const v = ref.current;
    if (!v || ended) return;
    v.muted = true;
    v.play().catch(() => { /* autoplay refused: the first frame stays and Skip still works */ });
    // Only on mount: later changes to `ended` come from the reel itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused && !ended) void v.play().catch(() => undefined);
  };

  return (
    <div className={"wel wel-reel" + (ended ? " is-ended" : "")}>
      {reelSeen
        ? <img className="wel-video" src="/intro/apex-intro-end.jpg" alt="APEX Coaching OS" />
        : <video ref={ref} className="wel-video" src="/intro/apex-intro.mp4" poster="/intro/apex-intro-poster.jpg"
            playsInline muted autoPlay preload="auto" onEnded={finish} onError={finish} aria-label="APEX brand intro" />}
      {!ended && (
        <div className="intro-bar">
          <button className="intro-pill" onClick={toggleSound} aria-label={muted ? "Turn sound on" : "Turn sound off"}>
            {muted ? <Icons.muted width={16} height={16} /> : <Icons.sound width={16} height={16} />}
          </button>
          <button className="intro-pill" onClick={finish}>Skip <Icons.forward width={14} height={14} /></button>
        </div>
      )}
      <div className="wel-actions" aria-hidden={!ended}>
        <button className="wel-btn" onClick={go} tabIndex={ended ? 0 : -1}>{demo ? "Open my training" : "Get started"} <Icons.arrow width={14} height={14} /></button>
        {!demo && <button className="wel-alt" onClick={go} tabIndex={ended ? 0 : -1}>I already have an account</button>}
      </div>
    </div>
  );
}
