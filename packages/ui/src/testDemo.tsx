import type { TestKey } from "@apex/core";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./motion";
import "./assessment.css";

/* Drawn, looping demos of each assessment test: a flat two-tone APEX athlete (orange kit, black trainers, ponytail) moves
   through the test with true body proportions, and the phone shows where it should stand. Our own drawing. */

type XY = [number, number];
type Pose = Record<string, XY>;
type Kind = "side" | "front" | "back";

const add = (a: XY, b: XY): XY => [a[0] + b[0], a[1] + b[1]];
const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]];
const mul = (a: XY, k: number): XY => [a[0] * k, a[1] * k];
const len = (a: XY) => Math.hypot(a[0], a[1]) || 1;
const lerp = (a: XY, b: XY, t: number): XY => add(a, mul(sub(b, a), t));
const f = (n: number) => Math.round(n * 10) / 10;

/** A limb: a tapered capsule from a (radius ra) to b (radius rb). */
function limb(a: XY, b: XY, ra: number, rb: number): string {
  const d = sub(b, a), u = mul(d, 1 / len(d)), n: XY = [-u[1], u[0]];
  const p1 = add(a, mul(n, ra)), p2 = add(b, mul(n, rb)), p3 = sub(b, mul(n, rb)), p4 = sub(a, mul(n, ra));
  return `M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}A${rb} ${rb} 0 0 0 ${f(p3[0])} ${f(p3[1])}L${f(p4[0])} ${f(p4[1])}A${ra} ${ra} 0 0 0 ${f(p1[0])} ${f(p1[1])}Z`;
}

/** A smooth closed outline through points (Catmull-Rom as cubic curves). */
function blob(pts: XY[]): string {
  const n = pts.length;
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!, p1 = pts[i]!, p2 = pts[(i + 1) % n]!, p3 = pts[(i + 2) % n]!;
    const c1 = add(p1, mul(sub(p2, p0), 1 / 6)), c2 = sub(p2, mul(sub(p3, p1), 1 / 6));
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + "Z";
}

/** Side-on torso (facing right): chest in front, shoulder blades and glutes behind, following the spine. */
function sideTorso(sh: XY, hip: XY): { top: string; shorts: string } {
  const d = sub(hip, sh), u = mul(d, 1 / len(d)), front: XY = [u[1], -u[0]];
  const at = (t: number, off: number) => add(lerp(sh, hip, t), mul(front, off));
  const top = blob([at(-0.08, 3), at(0.1, 9.5), at(0.3, 11), at(0.55, 8.5), at(0.8, 8), at(0.8, -8.5), at(0.6, -7), at(0.32, -10), at(0.04, -9.5)]);
  const shorts = blob([at(0.76, 8.4), at(1.0, 10), at(1.16, 8.5), at(1.2, -8), at(1.04, -12.5), at(0.86, -10.5), at(0.76, -8.8)]);
  return { top, shorts };
}

function frontTorso(p: Pose): { top: string; shorts: string } {
  const ls = p.lSh!, rs = p.rSh!, lh = p.lHip!, rh = p.rHip!;
  const lw = lerp(ls, lh, 0.68), rw = lerp(rs, rh, 0.68);
  const top = blob([add(ls, [2, -3]), add(lerp(ls, rs, 0.5), [0, -4]), add(rs, [-2, -3]), add(rs, [1, 6]), add(rw, [-2, 0]), add(lerp(rs, rh, 0.86), [-1, 2]), add(lerp(ls, lh, 0.86), [1, 2]), add(lw, [2, 0]), add(ls, [-1, 6])]);
  const shorts = blob([add(lerp(ls, lh, 0.84), [-1, 0]), add(lerp(rs, rh, 0.84), [1, 0]), add(rh, [5, 4]), add(lerp(rh, p.rKn!, 0.38), [5, 0]), add(lerp(rh, p.rKn!, 0.4), [-6, 0]), add(lerp(lerp(lh, rh, 0.5), lerp(p.lKn!, p.rKn!, 0.5), 0.12), [0, 0]), add(lerp(lh, p.lKn!, 0.4), [6, 0]), add(lerp(lh, p.lKn!, 0.38), [-5, 0]), add(lh, [-5, 4])]);
  return { top, shorts };
}

function Athlete({ p, kind }: { p: Pose; kind: Kind }) {
  const head = p.head!;
  if (kind === "side") {
    const { top, shorts } = sideTorso(p.sh!, p.hip!);
    const neckBase = add(p.sh!, mul(sub(p.sh!, p.hip!), 1 / len(sub(p.sh!, p.hip!)) * 4) as XY);
    const leg = (hip: XY, kn: XY, an: XY, toe: XY, far: boolean) => (
      <g className={far ? "td-far" : undefined}>
        <path d={limb(hip, kn, 8.6, 5.8)} className="td-skin" />
        <path d={limb(kn, an, 5.6, 3.6)} className="td-skin" />
        <path d={limb(add(an, [-3, 1.5]), toe, 4.4, 2.8)} className="td-shoe" />
      </g>
    );
    const arm = (el: XY, ha: XY, far: boolean) => (
      <g className={far ? "td-far" : undefined}>
        <path d={limb(p.sh!, el, 5, 3.8)} className="td-skin" />
        <path d={limb(el, ha, 3.7, 2.7)} className="td-skin" />
        <circle cx={ha[0]} cy={ha[1]} r={3.3} className="td-skin" />
      </g>
    );
    const facing = sub(head, neckBase), fu = mul(facing, 1 / len(facing)), fwd: XY = [fu[1] * -1, fu[0]];
    const forward: XY = fwd[0] < 0 ? [-fwd[0], -fwd[1]] : fwd;
    return (
      <>
        {arm(p.el2!, p.ha2!, true)}
        {leg(p.hip!, p.kn2!, p.an2!, p.toe2!, true)}
        <path d={shorts} className="td-cloth" />
        {leg(p.hip!, p.kn!, p.an!, p.toe!, false)}
        <path d={limb(p.hip!, lerp(p.hip!, p.kn!, 0.4), 9.4, 8.2)} className="td-cloth" />
        <path d={limb(neckBase, head, 3.8, 3.8)} className="td-skin" />
        <path d={top} className="td-cloth" />
        <path d={limb(add(head, add(mul(forward, -7), mul(fu, 2))), add(head, add(mul(forward, -13), mul(fu, -12))), 3.8, 2.4)} className="td-hair" />
        <circle cx={head[0]} cy={head[1]} r={10.8} className="td-hair" />
        <circle cx={head[0] + forward[0] * 2.6 - fu[0] * 1.6} cy={head[1] + forward[1] * 2.6 - fu[1] * 1.6} r={9.4} className="td-skin" />
        {arm(p.el!, p.ha!, false)}
      </>
    );
  }
  const { top, shorts } = frontTorso(p);
  const neck: XY = lerp(p.lSh!, p.rSh!, 0.5);
  const leg = (hip: XY, kn: XY, an: XY, side: 1 | -1) => (
    <g>
      <path d={limb(hip, kn, 8.2, 5.6)} className="td-skin" />
      <path d={limb(kn, an, 5.6, 3.6)} className="td-skin" />
      <ellipse cx={an[0] + side * 2} cy={an[1] + 5} rx={5.4} ry={3.6} className="td-shoe" />
    </g>
  );
  const arm = (sh: XY, el: XY, ha: XY) => (
    <g>
      <path d={limb(sh, el, 5, 3.8)} className="td-skin" />
      <path d={limb(el, ha, 3.7, 2.7)} className="td-skin" />
      <circle cx={ha[0]} cy={ha[1]} r={3.2} className="td-skin" />
    </g>
  );
  // From behind, the hands that reach behind the back go over the top.
  const behind = kind === "back";
  return (
    <>
      {leg(p.lHip!, p.lKn!, p.lAn!, -1)}
      {leg(p.rHip!, p.rKn!, p.rAn!, 1)}
      <path d={shorts} className="td-cloth" />
      {!behind && <>{arm(p.lSh!, p.lEl!, p.lHa!)}{arm(p.rSh!, p.rEl!, p.rHa!)}</>}
      <path d={limb(add(neck, [0, 2]), head, 4, 4)} className="td-skin" />
      <path d={top} className="td-cloth" />
      {behind && <>{arm(p.lSh!, p.lEl!, p.lHa!)}{arm(p.rSh!, p.rEl!, p.rHa!)}</>}
      {behind ? (
        <>
          <circle cx={head[0]} cy={head[1]} r={10.8} className="td-hair" />
          <path d={limb(add(head, [0, 4]), add(head, [0.5, 19]), 3.4, 2.2)} className="td-hair" />
        </>
      ) : (
        <>
          <circle cx={head[0]} cy={head[1] - 0.6} r={10.8} className="td-hair" />
          <ellipse cx={head[0]} cy={head[1] + 2} rx={8.4} ry={9.6} className="td-skin" />
        </>
      )}
    </>
  );
}

/* ---------- Poses: a 1.70 m athlete, 8 heads tall, standing on y = 214 ---------- */

const side = (p: Pose): Pose => ({ ...p, el2: p.el2 ?? add(p.el!, [-3, 0]), ha2: p.ha2 ?? add(p.ha!, [-3, 0]), kn2: p.kn2 ?? add(p.kn!, [-3, 0]), an2: p.an2 ?? add(p.an!, [-3, 0]), toe2: p.toe2 ?? add(p.toe!, [-3, 0]) });
const STAND: Pose = { head: [101, 37], sh: [99, 64], el: [98, 93], ha: [100, 118], hip: [99, 118], kn: [101, 165], an: [99, 208], toe: [113, 211] };
const FRONT: Pose = {
  head: [100, 37], lSh: [84, 64], rSh: [116, 64], lEl: [82, 92], rEl: [118, 92], lHa: [81, 119], rHa: [119, 119],
  lHip: [90, 118], rHip: [110, 118], lKn: [92, 165], rKn: [108, 165], lAn: [93, 207], rAn: [107, 207],
};
const HANDS_ON_HIPS: Pose = { ...FRONT, lEl: [70, 94], lHa: [86, 114], rEl: [130, 94], rHa: [114, 114] };

interface Demo { kind: Kind; frames: { pose: Pose; hold: number }[]; phone: "front" | "side"; caption: string; wall?: boolean }

const DEMOS: Record<TestKey, Demo> = {
  "posture-front": { kind: "front", phone: "front", caption: "Face the phone. Stand tall and relaxed, arms by your sides.", frames: [{ pose: FRONT, hold: 1800 }, { pose: { ...FRONT, head: [100, 36.4] }, hold: 1800 }] },
  "posture-side": { kind: "side", phone: "side", caption: "Right side to the phone. Stand as you normally do.", frames: [{ pose: side(STAND), hold: 1800 }, { pose: side({ ...STAND, head: [101.4, 36.4] }), hold: 1800 }] },
  "posture-back": { kind: "back", phone: "front", caption: "Back to the phone. Arms by your sides, feet hip-width.", frames: [{ pose: FRONT, hold: 1800 }, { pose: { ...FRONT, head: [100, 36.4] }, hold: 1800 }] },
  "overhead-squat": {
    kind: "side", phone: "side", caption: "Arms straight up. Squat as low as is comfortable, heels down. 5 slow reps.",
    frames: [
      { pose: side({ ...STAND, el: [101, 36], ha: [102, 11] }), hold: 500 },
      // Bottom: thighs about parallel, knees over the toes, heels down, torso and shins leaning about the same, arms in line with the torso.
      { pose: side({ head: [118, 113], sh: [111, 138], el: [119, 111], ha: [126, 86], hip: [80, 166], kn: [122, 168], an: [99, 208], toe: [113, 211] }), hold: 600 },
    ],
  },
  "toe-touch": {
    kind: "side", phone: "side", caption: "Feet together, knees straight. Reach down slowly and hold for 2 seconds.",
    frames: [
      { pose: side(STAND), hold: 700 },
      // Hips back, legs straight, an even curve through the back, fingertips at the toes.
      { pose: side({ head: [128, 176], sh: [125, 150], el: [124, 178], ha: [116, 203], hip: [88, 116], kn: [94, 163], an: [99, 208], toe: [113, 211] }), hold: 1500 },
    ],
  },
  "shoulder-reach": {
    kind: "back", phone: "front", caption: "Back to the phone. One hand over the shoulder, one up the back. Then swap.",
    frames: [
      { pose: FRONT, hold: 500 },
      { pose: { ...FRONT, lEl: [86, 33], lHa: [99, 74], rEl: [124, 96], rHa: [102, 86] }, hold: 1500 },
      { pose: FRONT, hold: 500 },
      { pose: { ...FRONT, rEl: [114, 33], rHa: [101, 74], lEl: [76, 96], lHa: [98, 86] }, hold: 1500 },
    ],
  },
  "knee-to-wall": {
    kind: "side", phone: "side", wall: true, caption: "Half-kneel facing a wall. Heel down, push the knee forward to touch the wall.",
    frames: [
      { pose: { head: [94, 74], sh: [93, 101], el: [101, 128], ha: [117, 146], el2: [97, 128], ha2: [113, 146], hip: [92, 155], kn: [125, 160], an: [124, 208], toe: [138, 211], kn2: [86, 205], an2: [52, 206], toe2: [46, 211] }, hold: 600 },
      { pose: { head: [101, 76], sh: [100, 103], el: [111, 129], ha: [129, 148], el2: [107, 129], ha2: [125, 148], hip: [98, 157], kn: [146, 170], an: [124, 208], toe: [138, 211], kn2: [86, 205], an2: [52, 206], toe2: [46, 211] }, hold: 1000 },
    ],
  },
  balance: {
    kind: "front", phone: "front", caption: "Hands on hips, eyes open. Lift one foot and hold. Then the other side.",
    frames: [
      { pose: HANDS_ON_HIPS, hold: 400 },
      { pose: { ...HANDS_ON_HIPS, rKn: [110, 150], rAn: [112, 186] }, hold: 1800 },
      { pose: HANDS_ON_HIPS, hold: 400 },
      { pose: { ...HANDS_ON_HIPS, lKn: [90, 150], lAn: [88, 186] }, hold: 1800 },
    ],
  },
};

const MOVE = 1200;
const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
const mix = (a: Pose, b: Pose, t: number): Pose => Object.fromEntries(Object.keys(a).map((k) => [k, lerp(a[k]!, b[k] ?? a[k]!, t)]));

function poseAt(d: Demo, ms: number): Pose {
  const cycle = d.frames.reduce((s, x) => s + x.hold + MOVE, 0);
  let t = ms % cycle;
  for (let i = 0; i < d.frames.length; i++) {
    const fr = d.frames[i]!, next = d.frames[(i + 1) % d.frames.length]!;
    if (t < fr.hold) return fr.pose;
    t -= fr.hold;
    if (t < MOVE) return mix(fr.pose, next.pose, ease(t / MOVE));
    t -= MOVE;
  }
  return d.frames[0]!.pose;
}

/** A looping drawn demo of one test, with the phone where it should go. */
export function TestDemo({ test, height = 250, frame }: { test: TestKey; height?: number; /** Fixed time in ms, for a still. */ frame?: number }) {
  const d = DEMOS[test];
  const still = useReducedMotion();
  const [ms, setMs] = useState(0);
  const start = useRef(0);
  useEffect(() => {
    if (still || frame !== undefined) return;
    let raf = 0;
    start.current = performance.now();
    const tick = (now: number) => { setMs(now - start.current); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [test, still, frame]);
  // Reduced motion: hold the key position of the move instead of looping.
  const p = frame !== undefined ? poseAt(d, frame) : still ? d.frames[Math.min(1, d.frames.length - 1)]!.pose : poseAt(d, ms);
  return (
    <figure className="td" style={{ height }} aria-label={`How to do it: ${d.caption}`}>
      <svg viewBox="10 4 180 222" preserveAspectRatio="xMidYMid meet" role="img">
        <ellipse cx={100} cy={214} rx={42} ry={3.2} className="td-shadow" />
        <line x1="14" y1="214" x2="186" y2="214" className="td-floor" />
        {d.wall && <rect x="151" y="30" width="8" height="184" rx="1" className="td-wall" />}
        {d.phone === "side" ? (
          <g transform="translate(26 104)"><line x1="5" y1="20" x2="-3" y2="110" className="td-stand" /><line x1="5" y1="20" x2="13" y2="110" className="td-stand" /><rect width="10" height="20" rx="2.5" className="td-phone" /></g>
        ) : (
          <g transform="translate(160 104)"><line x1="7" y1="20" x2="-1" y2="110" className="td-stand" /><line x1="7" y1="20" x2="15" y2="110" className="td-stand" /><rect width="14" height="20" rx="2.5" className="td-phone" /><circle cx="7" cy="4.5" r="1.5" className="td-lens" /></g>
        )}
        <Athlete p={p} kind={d.kind} />
      </svg>
      <figcaption className="small">{d.caption}</figcaption>
    </figure>
  );
}
