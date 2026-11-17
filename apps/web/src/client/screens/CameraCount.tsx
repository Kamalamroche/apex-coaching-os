import { CAMERA_MOVES, FLAG_TEXT, repResultText, startReps, stepReps, type CameraMove, type BodyPoint, type RepState } from "@apex/core";
import { Icons, RepCamOverlay, RepCamResult } from "@apex/ui";
import { useEffect, useRef, useState } from "react";

/* The camera rep counter for a coach's push-up or squat challenge. MediaPipe's pose model runs in the browser,
   loaded from APEX's own site (public/pose, public/pose-model). Nothing from the camera is uploaded: only the
   final count goes to the challenge, and a one-line note goes to the coach. */

type PoseLandmarker = import("@mediapipe/tasks-vision").PoseLandmarker;

let loading: Promise<PoseLandmarker> | null = null;
function loadPose(): Promise<PoseLandmarker> {
  loading ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks("/pose");
    const make = (delegate: "GPU" | "CPU") => PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: "/pose-model/pose_landmarker_lite.task", delegate },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    // Older phones without WebGL2: fall back to the processor.
    return make("GPU").catch(() => make("CPU"));
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

export const cameraCountSupported = (): boolean => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

const LIMITS = [{ s: 60, label: "60 seconds" }, { s: 120, label: "2 minutes" }, { s: 0, label: "No limit" }];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** Depth bar: 0 standing tall or arms locked, 1 at full depth. */
const depthOf = (move: CameraMove, angle: number | null) => {
  if (angle === null) return null;
  const [top, bottom] = move === "pushup" ? [160, 90] : [165, 95];
  return Math.max(0, Math.min(1, (top - angle) / (top - bottom)));
};

type Stage = "setup" | "loading" | "live" | "done";

export function CameraCount({ move, title, coach, onLog, onClose }: { move: CameraMove; title: string; coach: string; onLog: (reps: number, note: string) => Promise<void>; onClose: () => void }) {
  const m = CAMERA_MOVES.find((x) => x.key === move)!;
  const [stage, setStage] = useState<Stage>("setup");
  const [limit, setLimit] = useState(60);
  const [voice, setVoice] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [state, setState] = useState<RepState>(() => startReps(move));
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [logging, setLogging] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const live = useRef({ state: startReps(move), started: 0, counting: false });

  const stopCamera = () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => stopCamera, []);

  const say = (text: string) => {
    if (!voice || typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 1.1;
    speechSynthesis.speak(u);
  };

  const finish = () => {
    live.current.counting = false;
    stopCamera();
    setStage("done");
  };

  const begin = async () => {
    setProblem(null);
    setStage("loading");
    try {
      const [pose, media] = await Promise.all([
        loadPose(),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } }, audio: false }),
      ]);
      stream.current = media;
      const v = video.current!;
      v.srcObject = media;
      await v.play();
      const fresh = startReps(move);
      live.current = { state: fresh, started: 0, counting: false };
      setState(fresh);
      setElapsed(0);
      setStage("live");
      // 3, 2, 1, go: time to get into position.
      for (let n = 3; n >= 0; n--) {
        setCountdown(n);
        say(n ? String(n) : "Go");
        await new Promise((r) => setTimeout(r, n ? 1000 : 500));
      }
      setCountdown(null);
      live.current.started = performance.now();
      live.current.counting = true;
      const ink = getComputedStyle(document.documentElement).getPropertyValue("--act").trim() || "orange";
      let last = -1;
      const tick = () => {
        if (!stream.current) return;
        const now = performance.now();
        if (v.readyState >= 2 && v.currentTime !== last) {
          last = v.currentTime;
          const res = pose.detectForVideo(v, now);
          const pts = (res.landmarks[0] ?? null) as BodyPoint[] | null;
          const before = live.current.state;
          const next = stepReps(before, pts);
          live.current.state = next;
          if (next.reps > before.reps) say(String(next.reps));
          else if (next.partials > before.partials) say(FLAG_TEXT.shallow.live);
          setState(next);
          draw(canvas.current, v, pts, ink);
        }
        const secs = (now - live.current.started) / 1000;
        setElapsed(secs);
        if (limit && secs >= limit) { say(`Time. ${live.current.state.reps}`); finish(); return; }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    } catch (e) {
      stopCamera();
      setStage("setup");
      const name = (e as { name?: string })?.name;
      setProblem(name === "NotAllowedError" ? "APEX needs the camera to count. Allow it in your browser settings and try again." : "The camera counter couldn't start on this phone. You can still type your number.");
    }
  };

  const seconds = Math.round(limit ? Math.min(limit, elapsed) : elapsed);
  const result = { move, reps: state.reps, partials: state.partials, hips: state.hips, seconds };
  const notes = [state.partials ? FLAG_TEXT.shallow.summary(state.partials) : null, state.hips ? FLAG_TEXT.hips.summary(state.hips) : null].filter((x): x is string => !!x);

  return (
    <div className="rc-shell" role="dialog" aria-label={`${m.label} counter`}>
      <video ref={video} className="rc-video" playsInline muted style={{ visibility: stage === "live" ? "visible" : "hidden" }} />
      <canvas ref={canvas} className="rc-canvas" style={{ visibility: stage === "live" ? "visible" : "hidden" }} />
      {(stage === "setup" || stage === "loading") && (
        <div className="rc-setup card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="eyebrow">{title}</div>
            <button className="btn ghost" style={{ padding: "6px 10px" }} onClick={onClose} aria-label="Close"><Icons.close width={16} height={16} /></button>
          </div>
          <h2 className="h2">Count my {m.label.toLowerCase()}</h2>
          <div className="small">{m.setup}</div>
          <div className="small">Only full-depth reps count. You'll hear each number, and a nudge if you need to go lower.</div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label="How long">
            {LIMITS.map((l) => <button key={l.s} type="button" className={`chip ${limit === l.s ? "on" : ""}`} aria-pressed={limit === l.s} onClick={() => setLimit(l.s)}>{l.label}</button>)}
          </div>
          <button type="button" className={`chip ${voice ? "on" : ""}`} aria-pressed={voice} style={{ alignSelf: "flex-start" }} onClick={() => setVoice(!voice)}><Icons.headphones width={14} height={14} /> Count out loud</button>
          {problem && <div className="tiny" style={{ color: "var(--warn)" }}>{problem}</div>}
          <button className="btn act block" disabled={stage === "loading"} onClick={begin}><Icons.camera width={18} height={18} /> {stage === "loading" ? "Starting the camera…" : "Start"}</button>
          <div className="tiny">The video stays on your phone. Only the count is saved.</div>
        </div>
      )}
      {stage === "live" && (
        <RepCamOverlay
          v={{ reps: state.reps, depth: depthOf(move, state.angle), cue: state.cue ? FLAG_TEXT[state.cue].live : null, clock: clock(limit ? Math.max(0, limit - elapsed) : elapsed), countdown, seen: state.seen, unit: m.unit }}
          onStop={finish}
        />
      )}
      {stage === "done" && (
        <RepCamResult
          r={{ reps: state.reps, unit: m.unit, seconds, notes, coach }}
          logging={logging}
          onAgain={() => setStage("setup")}
          onLog={() => { setLogging(true); onLog(state.reps, repResultText(result, title)).finally(() => setLogging(false)); }}
        />
      )}
    </div>
  );
}

/** The few body lines that matter, drawn over the camera so the client can see they're being tracked. */
const BONES: [number, number][] = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
function draw(c: HTMLCanvasElement | null, v: HTMLVideoElement, pts: BodyPoint[] | null, ink: string) {
  if (!c) return;
  if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
  const g = c.getContext("2d");
  if (!g) return;
  g.clearRect(0, 0, c.width, c.height);
  if (!pts) return;
  g.lineWidth = Math.max(3, c.width / 160);
  g.lineCap = "round";
  g.strokeStyle = ink;
  g.fillStyle = ink;
  const ok = (i: number) => (pts[i]?.visibility ?? 0) > 0.5;
  for (const [a, b] of BONES) {
    if (!ok(a) || !ok(b)) continue;
    g.beginPath();
    g.moveTo(pts[a]!.x * c.width, pts[a]!.y * c.height);
    g.lineTo(pts[b]!.x * c.width, pts[b]!.y * c.height);
    g.stroke();
  }
  for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    if (!ok(i)) continue;
    g.beginPath();
    g.arc(pts[i]!.x * c.width, pts[i]!.y * c.height, g.lineWidth * 1.4, 0, Math.PI * 2);
    g.fill();
  }
}
