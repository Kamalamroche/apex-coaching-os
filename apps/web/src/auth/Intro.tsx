import { Icons } from "@apex/ui";
import { useEffect, useRef, useState } from "react";

const SEEN_KEY = "apex.client.intro";

/** True when the brand intro should be skipped: already seen in this tab, or the person prefers reduced motion.
 *  Storage can be blocked (private mode, in-app browsers); then the intro simply shows again. */
export function introSeen(): boolean {
  try {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch { return false; }
}

function markSeen() {
  try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* storage blocked: nothing to remember */ }
}

/**
 * APEX brand reel before the welcome screen. Browsers only autoplay muted video, so it starts silent
 * with a sound button; Skip, the end of the reel, or a playback error all continue to the welcome screen.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const done = () => { markSeen(); onDone(); };

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => { /* autoplay refused: the poster stays and Skip still works */ });
  }, []);

  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused) void v.play().catch(() => undefined);
  };

  return (
    <div className="intro">
      <video ref={ref} className="intro-video" src="/intro/apex-intro.mp4" poster="/intro/apex-intro-poster.jpg"
        playsInline muted autoPlay preload="auto" onEnded={done} onError={done} aria-label="APEX brand intro" />
      <div className="intro-bar">
        <button className="intro-pill" onClick={toggleSound} aria-label={muted ? "Turn sound on" : "Turn sound off"}>
          {muted ? <Icons.muted width={16} height={16} /> : <Icons.sound width={16} height={16} />}
        </button>
        <button className="intro-pill" onClick={done}>Skip <Icons.forward width={14} height={14} /></button>
      </div>
    </div>
  );
}
