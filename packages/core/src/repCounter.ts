/* Camera rep counter: counts push-ups and squats from body points the phone's camera finds (pose landmarks),
 * and notes reps that weren't deep enough or where the body line broke. Pure: the screen feeds it one frame at a time.
 * The video never leaves the phone; only the final count is logged to the coach's challenge. */

export type CameraMove = "pushup" | "squat";

export const CAMERA_MOVES: { key: CameraMove; label: string; unit: string; setup: string }[] = [
  { key: "pushup", label: "Push-ups", unit: "push-ups", setup: "Put the phone on the floor about 2 m away, side on, so your whole body is in view." },
  { key: "squat", label: "Squats", unit: "squats", setup: "Stand the phone up about 2 to 3 m away, side on, so you're in view from head to feet." },
];

/** Which move a challenge counts, from its unit ("push-ups", "squats"). Null for anything else. */
export function cameraMoveFor(unit: string): CameraMove | null {
  const u = unit.toLowerCase().replace(/[^a-z]/g, "");
  if (u === "pushups" || u === "pushup" || u === "pressups" || u === "pressup") return "pushup";
  if (u === "squats" || u === "squat") return "squat";
  return null;
}

/** One body point, x and y from 0 to 1 across the picture. */
export interface BodyPoint {
  x: number;
  y: number;
  visibility?: number;
}

/** MediaPipe's 33-point body model: the points this counter reads. */
const P = { lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28 } as const;

/** Angle at b, in degrees, between a and c. */
export function jointAngle(a: BodyPoint, b: BodyPoint, c: BodyPoint): number {
  const ab = Math.atan2(a.y - b.y, a.x - b.x);
  const cb = Math.atan2(c.y - b.y, c.x - b.x);
  let d = Math.abs(((ab - cb) * 180) / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

/** Thresholds per move: the joint angle at the bottom, the top, and the "went part way" line. */
const RULES: Record<CameraMove, { down: number; up: number; partial: number }> = {
  // Elbow angle: 90° or less is a full push-up, back over 155° is locked out.
  pushup: { down: 95, up: 155, partial: 130 },
  // Knee angle: about thighs parallel or lower, back over 160° is standing.
  squat: { down: 100, up: 160, partial: 135 },
};

export type FormFlag = "shallow" | "hips";

export const FLAG_TEXT: Record<FormFlag, { live: string; summary: (n: number) => string }> = {
  shallow: { live: "Go lower", summary: (n) => `${n} rep${n === 1 ? "" : "s"} not deep enough (not counted)` },
  hips: { live: "Keep your body straight", summary: (n) => `${n} rep${n === 1 ? "" : "s"} with hips out of line` },
};

export interface RepState {
  move: CameraMove;
  reps: number;
  phase: "up" | "down";
  /** Lowest joint angle in the current rep. */
  low: number;
  /** Lowest body-line angle (shoulder–hip–ankle) in the current push-up. */
  lineLow: number;
  partials: number;
  hips: number;
  /** The last thing worth telling the client, with the rep it belongs to. */
  cue: FormFlag | null;
  /** False while the body isn't clearly in view. */
  seen: boolean;
  /** The joint angle now, for the on-screen gauge. */
  angle: number | null;
}

export const startReps = (move: CameraMove): RepState => ({ move, reps: 0, phase: "up", low: 180, lineLow: 180, partials: 0, hips: 0, cue: null, seen: false, angle: null });

const visible = (p: BodyPoint | undefined, min = 0.5): p is BodyPoint => !!p && (p.visibility ?? 1) >= min;

/** The side of the body the camera sees best: its three points for the main joint, plus shoulder, hip, ankle. */
function side(points: BodyPoint[], move: CameraMove): { joint: [BodyPoint, BodyPoint, BodyPoint]; line: [BodyPoint, BodyPoint, BodyPoint] | null } | null {
  const pick = (l: boolean) => {
    const sh = points[l ? P.lShoulder : P.rShoulder], el = points[l ? P.lElbow : P.rElbow], wr = points[l ? P.lWrist : P.rWrist];
    const hip = points[l ? P.lHip : P.rHip], kn = points[l ? P.lKnee : P.rKnee], an = points[l ? P.lAnkle : P.rAnkle];
    const joint = move === "pushup" ? [sh, el, wr] : [hip, kn, an];
    if (!joint.every((p) => visible(p))) return null;
    const score = joint.reduce((a, p) => a + (p!.visibility ?? 1), 0);
    const line = visible(sh, 0.4) && visible(hip, 0.4) && visible(an, 0.4) ? ([sh, hip, an] as [BodyPoint, BodyPoint, BodyPoint]) : null;
    return { joint: joint as [BodyPoint, BodyPoint, BodyPoint], line, score };
  };
  const l = pick(true);
  const r = pick(false);
  const best = l && r ? (l.score >= r.score ? l : r) : l ?? r;
  return best ? { joint: best.joint, line: best.line } : null;
}

/**
 * One camera frame in, the new count out. A rep counts when the joint goes past the "down" angle and back past
 * "up". Going only part way down and back up is a partial: not counted, and flagged so the client goes lower.
 */
export function stepReps(s: RepState, points: BodyPoint[] | null): RepState {
  const found = points ? side(points, s.move) : null;
  if (!found) return { ...s, seen: false, angle: null };
  const rule = RULES[s.move];
  const angle = jointAngle(...found.joint);
  const line = s.move === "pushup" && found.line ? jointAngle(...found.line) : 180;
  const next: RepState = { ...s, seen: true, angle, low: Math.min(s.low, angle), lineLow: Math.min(s.lineLow, line) };
  if (s.phase === "up" && angle < rule.down) return { ...next, phase: "down" };
  if (angle > rule.up) {
    if (s.phase === "down") {
      const hipsOff = s.move === "pushup" && next.lineLow < 150;
      return { ...next, phase: "up", reps: s.reps + 1, hips: s.hips + (hipsOff ? 1 : 0), cue: hipsOff ? "hips" : null, low: 180, lineLow: 180 };
    }
    // Back at the top without reaching the bottom: a partial rep, if it really went part way.
    if (next.low < rule.partial) return { ...next, partials: s.partials + 1, cue: "shallow", low: 180, lineLow: 180 };
    return { ...next, low: 180, lineLow: 180 };
  }
  return next;
}

export interface RepResult {
  move: CameraMove;
  reps: number;
  partials: number;
  hips: number;
  seconds: number;
}

/** "23 push-ups in 60 s, counted by camera. 3 not deep enough (not counted)." for the coach. */
export function repResultText(r: RepResult, challengeTitle: string): string {
  const unit = CAMERA_MOVES.find((m) => m.key === r.move)!.unit;
  const notes = [r.partials ? FLAG_TEXT.shallow.summary(r.partials) : null, r.hips ? FLAG_TEXT.hips.summary(r.hips) : null].filter(Boolean);
  return `${challengeTitle}: ${r.reps} ${unit} in ${r.seconds} s, counted by camera.${notes.length ? ` ${notes.join(". ")}.` : " Clean reps throughout."}`;
}
