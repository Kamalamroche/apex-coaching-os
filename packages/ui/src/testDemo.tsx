import type { TestKey } from "@apex/core";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./motion";
import "./assessment.css";

/* Drawn, looping demos of each assessment test: a flat APEX figure shows where the phone goes and the movement,
   before the client tries it. Our own drawing, no video. */

type XY = [number, number];
type Pose = Record<string, XY>;
type Kind = "side" | "front";

const SIDE_BONES: [string, string, number, boolean][] = [
  ["sh", "el2", 8, true], ["el2", "ha2", 7, true], ["hip", "kn2", 10, true], ["kn2", "an2", 9, true], ["an2", "toe2", 6, true],
  ["neck", "hip", 15, false], ["hip", "kn", 10, false], ["kn", "an", 9, false], ["an", "toe", 6, false], ["sh", "el", 8, false], ["el", "ha", 7, false],
];
const FRONT_BONES: [string, string, number, boolean][] = [
  ["neck", "pel", 15, false], ["lSh", "rSh", 9, false], ["lHip", "rHip", 11, false],
  ["lSh", "lEl", 8, false], ["lEl", "lHa", 7, false], ["rSh", "rEl", 8, false], ["rEl", "rHa", 7, false],
  ["lHip", "lKn", 10, false], ["lKn", "lAn", 9, false], ["rHip", "rKn", 10, false], ["rKn", "rAn", 9, false],
];

/** Side on, facing right. Far limbs follow the near ones unless a pose sets them. */
const side = (p: Pose): Pose => ({ ...p, el2: p.el2 ?? [p.el![0] - 4, p.el![1]], ha2: p.ha2 ?? [p.ha![0] - 4, p.ha![1]], kn2: p.kn2 ?? [p.kn![0] - 4, p.kn![1]], an2: p.an2 ?? [p.an![0] - 4, p.an![1]], toe2: p.toe2 ?? [p.toe![0] - 4, p.toe![1]] });
const STAND: Pose = { head: [100, 40], neck: [100, 57], sh: [100, 64], el: [100, 98], ha: [102, 128], hip: [100, 128], kn: [101, 172], an: [100, 216], toe: [114, 218] };
const FRONT: Pose = {
  head: [100, 40], neck: [100, 57], pel: [100, 126], lSh: [81, 66], rSh: [119, 66], lEl: [77, 98], rEl: [123, 98], lHa: [75, 128], rHa: [125, 128],
  lHip: [90, 128], rHip: [110, 128], lKn: [90, 172], rKn: [110, 172], lAn: [90, 216], rAn: [110, 216],
};

interface Demo { kind: Kind; frames: { pose: Pose; hold: number }[]; phone: "front" | "side"; caption: string; wall?: boolean; back?: boolean }

const DEMOS: Record<TestKey, Demo> = {
  "posture-front": { kind: "front", phone: "front", caption: "Face the phone. Stand tall and relaxed, arms by your sides.", frames: [{ pose: FRONT, hold: 1600 }, { pose: { ...FRONT, head: [100, 39], lHa: [74, 127], rHa: [126, 127] }, hold: 1600 }] },
  "posture-side": { kind: "side", phone: "side", caption: "Right side to the phone. Stand as you normally do.", frames: [{ pose: side(STAND), hold: 1600 }, { pose: side({ ...STAND, head: [101, 39] }), hold: 1600 }] },
  "posture-back": { kind: "front", phone: "front", back: true, caption: "Back to the phone. Arms by your sides, feet hip-width.", frames: [{ pose: FRONT, hold: 1600 }, { pose: { ...FRONT, head: [100, 39] }, hold: 1600 }] },
  "overhead-squat": {
    kind: "side", phone: "side", caption: "Arms straight up. Squat as low as is comfortable, 5 slow reps.",
    frames: [
      { pose: side({ ...STAND, el: [102, 32], ha: [104, 2] }), hold: 500 },
      { pose: side({ head: [127, 104], neck: [121, 121], sh: [118, 127], el: [130, 96], ha: [141, 66], hip: [78, 176], kn: [118, 181], an: [100, 216], toe: [114, 218] }), hold: 500 },
    ],
  },
  "toe-touch": {
    kind: "side", phone: "side", caption: "Feet together, knees straight. Reach down slowly and hold for 2 seconds.",
    frames: [
      { pose: side(STAND), hold: 600 },
      { pose: side({ head: [139, 190], neck: [133, 177], sh: [129, 171], el: [128, 196], ha: [122, 214], hip: [88, 126], kn: [95, 171], an: [100, 216], toe: [114, 218] }), hold: 1400 },
    ],
  },
  "shoulder-reach": {
    kind: "front", phone: "front", back: true, caption: "Back to the phone. One hand over the shoulder, one up the back. Then swap.",
    frames: [
      { pose: { ...FRONT, lEl: [84, 30], lHa: [96, 76], rEl: [126, 112], rHa: [106, 90] }, hold: 1300 },
      { pose: FRONT, hold: 400 },
      { pose: { ...FRONT, rEl: [116, 30], rHa: [104, 76], lEl: [74, 112], lHa: [94, 90] }, hold: 1300 },
      { pose: FRONT, hold: 400 },
    ],
  },
  "knee-to-wall": {
    kind: "side", phone: "side", wall: true, caption: "Half-kneel facing a wall. Heel down, push the knee forward to touch the wall.",
    frames: [
      { pose: { head: [96, 82], neck: [95, 99], sh: [94, 106], el: [104, 136], ha: [118, 160], el2: [100, 136], ha2: [114, 160], hip: [92, 168], kn: [124, 176], an: [128, 216], toe: [142, 218], kn2: [84, 214], an2: [48, 214], toe2: [42, 218] }, hold: 500 },
      { pose: { head: [104, 84], neck: [103, 101], sh: [102, 108], el: [116, 138], ha: [134, 164], el2: [112, 138], ha2: [130, 164], hip: [100, 170], kn: [149, 184], an: [128, 216], toe: [142, 218], kn2: [84, 214], an2: [48, 214], toe2: [42, 218] }, hold: 900 },
    ],
  },
  balance: {
    kind: "front", phone: "front", caption: "Hands on hips, eyes open. Lift one foot and hold. Then the other side.",
    frames: [
      { pose: { ...FRONT, lEl: [70, 104], lHa: [88, 124], rEl: [130, 104], rHa: [112, 124] }, hold: 400 },
      { pose: { ...FRONT, lEl: [70, 104], lHa: [88, 124], rEl: [130, 104], rHa: [112, 124], rKn: [114, 160], rAn: [118, 192] }, hold: 1800 },
      { pose: { ...FRONT, lEl: [70, 104], lHa: [88, 124], rEl: [130, 104], rHa: [112, 124] }, hold: 400 },
      { pose: { ...FRONT, lEl: [70, 104], lHa: [88, 124], rEl: [130, 104], rHa: [112, 124], lKn: [86, 160], lAn: [82, 192] }, hold: 1800 },
    ],
  },
};

const MOVE = 1100;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const mix = (a: Pose, b: Pose, t: number): Pose => Object.fromEntries(Object.keys(a).map((k) => [k, [a[k]![0] + ((b[k] ?? a[k]!)[0] - a[k]![0]) * t, a[k]![1] + ((b[k] ?? a[k]!)[1] - a[k]![1]) * t] as XY]));

function poseAt(d: Demo, ms: number): Pose {
  const cycle = d.frames.reduce((s, f) => s + f.hold + MOVE, 0);
  let t = ms % cycle;
  for (let i = 0; i < d.frames.length; i++) {
    const f = d.frames[i]!, next = d.frames[(i + 1) % d.frames.length]!;
    if (t < f.hold) return f.pose;
    t -= f.hold;
    if (t < MOVE) return mix(f.pose, next.pose, ease(t / MOVE));
    t -= MOVE;
  }
  return d.frames[0]!.pose;
}

/** A looping drawn demo of one test, with the phone where it should go. */
export function TestDemo({ test, height = 240 }: { test: TestKey; height?: number }) {
  const d = DEMOS[test];
  const still = useReducedMotion();
  const [ms, setMs] = useState(0);
  const start = useRef(0);
  useEffect(() => {
    if (still) return;
    let raf = 0;
    start.current = performance.now();
    const tick = (now: number) => { setMs(now - start.current); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [test, still]);
  // Reduced motion: hold the key position of the move instead of looping.
  const p = still ? d.frames[Math.min(1, d.frames.length - 1)]!.pose : poseAt(d, ms);
  const bones = d.kind === "side" ? SIDE_BONES : FRONT_BONES;
  return (
    <figure className="td" style={{ height }} aria-label={`How to do it: ${d.caption}`}>
      <svg viewBox="0 -24 200 254" preserveAspectRatio="xMidYMid meet" role="img">
        <line x1="10" y1="221" x2="190" y2="221" className="td-floor" />
        {d.wall && <line x1="154" y1="40" x2="154" y2="221" className="td-wall" />}
        {d.phone === "side" ? (
          <g className="td-phone" transform="translate(18 112)"><rect width="12" height="22" rx="3" /><line x1="6" y1="22" x2="6" y2="109" className="td-stand" /></g>
        ) : (
          <g className="td-phone" transform="translate(162 112)"><rect width="16" height="22" rx="3" /><circle cx="8" cy="5" r="1.6" className="td-lens" /><line x1="8" y1="22" x2="8" y2="109" className="td-stand" /></g>
        )}
        {bones.map(([a, b, w, far]) => p[a] && p[b] ? <line key={`${a}${b}`} x1={p[a]![0]} y1={p[a]![1]} x2={p[b]![0]} y2={p[b]![1]} strokeWidth={w} className={far ? "td-far" : "td-near"} /> : null)}
        <circle cx={p.head![0]} cy={p.head![1]} r={13} className="td-head" />
        {d.kind === "side" && !d.back && <circle cx={p.head![0] + 6} cy={p.head![1] - 2} r={1.6} className="td-eye" />}
      </svg>
      <figcaption className="small">{d.caption}</figcaption>
    </figure>
  );
}
