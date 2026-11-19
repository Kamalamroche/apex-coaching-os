/* Posture and mobility assessments. The coach sends an assessment; the client takes the photos and videos and
 * answers a few simple measures at home; the coach reviews each test, scores it and picks the focus areas.
 * Posture photos are measured on the phone from body points (the same pose model as the rep counter): shoulder and
 * hip level, head position, body line. APEX scores every test itself from what was measured or answered (Data);
 * the coach adds feedback on each test, a note and the focus areas (Coach decision). Focus areas start as an
 * AI suggestion that the coach accepts or changes. Our own test wording.
 * Live: assessments table + private "assessments" bucket (supabase/migrations/20261127090000_assessments.sql).
 * Pure, so it is unit tested. */

import type { BodyPoint } from "./repCounter";
import { insertExercise } from "./workout";
import { exerciseById } from "./library";
import type { Workout } from "./types";

export type TestKey = "posture-front" | "posture-side" | "posture-back" | "overhead-squat" | "toe-touch" | "shoulder-reach" | "knee-to-wall" | "balance";
export type TestGroup = "posture" | "mobility";
export type MediaKind = "photo" | "video";

export type TestInput =
  | { kind: "choice"; label: string; options: string[]; perSide: boolean }
  | { kind: "number"; label: string; unit: "cm" | "s"; perSide: boolean; max: number }
  | { kind: "checks"; label: string; options: string[]; none: string; perSide: false };

export interface AssessmentTest {
  key: TestKey;
  group: TestGroup;
  title: string;
  media: MediaKind | null;
  /** For the client: where to put the phone and what to do. */
  how: string[];
  input: TestInput | null;
  /** For the coach: what to look at. */
  lookFor: string;
  /** The focus area a low score points to. */
  focus: string;
}

/** Things a client can spot in their own overhead squat. Each one costs a point. */
export const SQUAT_FAULTS = ["Heels lifted", "Knees moved in", "Arms dropped forward", "Leaned far forward", "Couldn't get thighs to parallel"];

export const ASSESSMENT_TESTS: AssessmentTest[] = [
  {
    key: "posture-front", group: "posture", title: "Standing posture, front", media: "photo",
    how: ["Fitted clothes, bare feet, hair off the shoulders.", "Phone at hip height, 2 to 3 m away, whole body in the frame.", "Stand tall and relaxed, feet hip-width, arms by your sides. Look straight ahead."],
    input: null, lookFor: "Shoulders and hips level, head straight, knees pointing forward, weight even on both feet.", focus: "Left–right balance",
  },
  {
    key: "posture-side", group: "posture", title: "Standing posture, side", media: "photo",
    how: ["Turn side on to the phone, right side facing it.", "Phone at hip height, 2 to 3 m away, whole body in the frame.", "Stand as you normally do. Don't pull yourself up straight for the photo."],
    input: null, lookFor: "Ear over shoulder, shoulder over hip, hip over ankle. Look for a forward head, rounded upper back or a big arch in the low back.", focus: "Upper back and neck posture",
  },
  {
    key: "posture-back", group: "posture", title: "Standing posture, back", media: "photo",
    how: ["Back to the phone, same distance and height.", "Stand relaxed, feet hip-width, arms by your sides."],
    input: null, lookFor: "Shoulder blades level and flat, spine straight, hips level, heels upright.", focus: "Left–right balance",
  },
  {
    key: "overhead-squat", group: "mobility", title: "Overhead squat", media: "video",
    how: ["Phone side on at hip height, 2 to 3 m away.", "Feet shoulder-width, arms straight up overhead.", "Squat as low as you comfortably can, 5 slow reps. Film from the front too if you can."],
    input: { kind: "checks", label: "What happened? Tick any you noticed.", options: SQUAT_FAULTS, none: "None of these", perSide: false },
    lookFor: "Heels down, knees tracking over toes, arms staying overhead, torso and shins roughly parallel, depth.", focus: "Squat pattern",
  },
  {
    key: "toe-touch", group: "mobility", title: "Toe touch", media: "video",
    how: ["Phone side on at hip height.", "Feet together, knees straight. Slowly reach down as far as you can and hold 2 seconds."],
    input: { kind: "choice", label: "How far did your fingertips reach?", options: ["Knees", "Shins", "Ankles", "Toes", "Floor"], perSide: false },
    lookFor: "Hips moving back, an even curve through the spine, knees staying straight.", focus: "Hamstrings and hips",
  },
  {
    key: "shoulder-reach", group: "mobility", title: "Shoulder reach behind the back", media: "photo",
    how: ["Back to the phone.", "Reach one hand over the shoulder and the other up the back, and try to bring them together. Then swap sides."],
    input: { kind: "choice", label: "How close did your hands get?", options: ["Overlap", "Touching", "Under 5 cm apart", "5 to 10 cm apart", "Over 10 cm apart"], perSide: true },
    lookFor: "The gap on each side, and any shrugging or arching to get there.", focus: "Shoulder mobility",
  },
  {
    key: "knee-to-wall", group: "mobility", title: "Knee to wall (ankle)", media: null,
    how: ["Face a wall in a half-kneel, front foot pointing at the wall.", "Keep the heel down and push the knee forward to touch the wall.", "Move the foot back until the knee only just touches. Measure toe to wall."],
    input: { kind: "number", label: "Toe to wall", unit: "cm", perSide: true, max: 30 },
    lookFor: "Distance each side and the difference between sides.", focus: "Ankle mobility",
  },
  {
    key: "balance", group: "mobility", title: "Single-leg balance", media: null,
    how: ["Stand on one leg, hands on hips, eyes open.", "Time how long you hold it, up to 60 seconds. Then the other leg."],
    input: { kind: "number", label: "Seconds held", unit: "s", perSide: true, max: 60 },
    lookFor: "Time each side and the difference between sides.", focus: "Balance and control",
  },
];

export const testByKey = (k: TestKey): AssessmentTest => ASSESSMENT_TESTS.find((t) => t.key === k)!;

export const ASSESSMENT_SETS: { key: string; title: string; hint: string; tests: TestKey[] }[] = [
  { key: "full", title: "Full start assessment", hint: "Posture and mobility, about 15 minutes", tests: ASSESSMENT_TESTS.map((t) => t.key) },
  { key: "posture", title: "Posture only", hint: "Three photos, about 5 minutes", tests: ["posture-front", "posture-side", "posture-back"] },
  { key: "mobility", title: "Mobility only", hint: "Five tests, about 10 minutes", tests: ["overhead-squat", "toe-touch", "shoulder-reach", "knee-to-wall", "balance"] },
];

/** 0 pain, 1 can't do it well, 2 does it with compensation, 3 clean. */
export type Score = 0 | 1 | 2 | 3;
export const SCORES: { score: Score; label: string }[] = [
  { score: 3, label: "Clean" },
  { score: 2, label: "Compensates" },
  { score: 1, label: "Limited" },
  { score: 0, label: "Pain" },
];

/** One measured value from a posture photo. */
export interface Measure {
  label: string;
  value: number;
  unit: "°";
  /** Worth the coach's attention. */
  flag: boolean;
  /** "Right shoulder higher", "Head ahead of the shoulder" */
  note: string;
}

export interface AssessmentMedia {
  path: string;
  kind: MediaKind;
  /** Something an <img> or <video> can show: a signed link (live) or a local link (demo). */
  url: string | null;
}

/** What the client sends for one test. */
export interface ClientAnswer {
  media: AssessmentMedia | null;
  /** Body points found on a posture photo (x, y from 0 to 1), kept so the coach sees the lines on the photo. */
  points: BodyPoint[] | null;
  /** Width / height of the photo the points belong to. */
  aspect: number | null;
  measures: Measure[];
  /** Answer for the input: one value, or left and right. */
  answer: { value?: string | number | string[]; left?: string | number; right?: string | number } | null;
  /** The client said it hurt. */
  pain: boolean;
}

/** The coach's feedback on one test. */
export interface CoachReview {
  note: string;
}

export interface AssessmentItem extends ClientAnswer, CoachReview {
  key: TestKey;
  /** APEX's score for the test, from the answer. Null until there's something to score. */
  score: Score | null;
}

export interface Assessment {
  id: string;
  createdAt: string;
  title: string;
  tests: TestKey[];
  status: "requested" | "submitted" | "reviewed";
  items: AssessmentItem[];
  submittedAt: string | null;
  reviewedAt: string | null;
  /** The coach's note to the client. */
  summary: string;
  /** Focus areas the coach chose. */
  focus: string[];
  /** Weeks until the coach wants a re-test; 0 for none. */
  retestWeeks: number;
}

export const emptyAnswer = (): ClientAnswer => ({ media: null, points: null, aspect: null, measures: [], answer: null, pain: false });
export const emptyItem = (key: TestKey): AssessmentItem => ({ key, ...emptyAnswer(), score: null, note: "" });
/** The item with APEX's score worked out from its answer. */
export const scored = (i: AssessmentItem): AssessmentItem => ({ ...i, score: suggestScore(i) });
export const answerOf = (i: AssessmentItem): ClientAnswer => ({ media: i.media, points: i.points, aspect: i.aspect, measures: i.measures, answer: i.answer, pain: i.pain });

export const RETEST_WEEKS = [4, 8, 12];

/* ---------- Posture from body points ---------- */

const deg = (r: number) => (r * 180) / Math.PI;
const seen = (p: BodyPoint | undefined, min = 0.5): p is BodyPoint => !!p && (p.visibility ?? 1) >= min;
const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Measures from one posture photo. Points are MediaPipe's 33 (x, y from 0 to 1); `aspect` is width / height,
 * so angles are true on the photo. Front and back: shoulder and hip level. Side: head forward and body line.
 * Returns [] when the body isn't clear enough to measure.
 */
export function postureMeasures(view: "front" | "side" | "back", points: BodyPoint[] | null, aspect: number): Measure[] {
  if (!points) return [];
  const P = (i: number) => points[i];
  const xy = (p: BodyPoint) => ({ x: p.x * aspect, y: p.y });
  if (view !== "side") {
    const out: Measure[] = [];
    const level = (label: string, li: number, ri: number, part: string) => {
      const l = P(li), r = P(ri);
      if (!seen(l) || !seen(r)) return;
      const a = xy(l), b = xy(r);
      const tilt = Math.abs(deg(Math.atan2(a.y - b.y, Math.abs(a.x - b.x))));
      // Smaller y is higher in the picture. MediaPipe's left is the person's own left, whichever way they face.
      const higher = a.y < b.y ? "Left" : "Right";
      out.push({ label, value: r1(tilt), unit: "°", flag: tilt >= 3, note: tilt < 1 ? "Level" : `${higher} ${part} higher` });
    };
    level("Shoulder level", 11, 12, "shoulder");
    level("Hip level", 23, 24, "hip");
    return out;
  }
  // Side on: use the side nearer the camera (the more visible one).
  const vis = (i: number) => P(i)?.visibility ?? 0;
  const left = vis(7) + vis(11) + vis(23) + vis(27) >= vis(8) + vis(12) + vis(24) + vis(28);
  const [ear, sh, hip, ank] = (left ? [7, 11, 23, 27] : [8, 12, 24, 28]).map((i) => P(i));
  const nose = P(0);
  const out: Measure[] = [];
  if (seen(ear) && seen(sh)) {
    const facing = seen(nose, 0.3) ? Math.sign(nose.x - ear.x) || 1 : 1;
    const e = xy(ear), s = xy(sh);
    // Angle of the ear–shoulder line from upright, positive when the ear is ahead of the shoulder.
    const fwd = deg(Math.atan2((e.x - s.x) * facing, s.y - e.y));
    out.push({ label: "Head position", value: r1(Math.abs(fwd)), unit: "°", flag: fwd >= 20, note: fwd >= 20 ? "Head well ahead of the shoulder" : fwd >= 10 ? "Head a little ahead of the shoulder" : "Head over the shoulder" });
  }
  if (seen(sh) && seen(hip) && seen(ank, 0.4)) {
    const s = xy(sh), h = xy(hip), a = xy(ank);
    const at = deg(Math.abs(Math.atan2(s.y - h.y, s.x - h.x) - Math.atan2(a.y - h.y, a.x - h.x)));
    const bend = Math.abs(180 - (at > 180 ? 360 - at : at));
    out.push({ label: "Body line", value: r1(bend), unit: "°", flag: bend >= 10, note: bend >= 10 ? "Shoulder, hip and ankle out of line" : "Shoulder, hip and ankle stacked" });
  }
  return out;
}

/* ---------- Suggested scores and focus areas ---------- */

const TOE = ["Knees", "Shins", "Ankles", "Toes", "Floor"];
const REACH = ["Overlap", "Touching", "Under 5 cm apart", "5 to 10 cm apart", "Over 10 cm apart"];

/** APEX's score for one test, from what was measured or answered. Null when there's nothing to go on. */
export function suggestScore(item: Pick<AssessmentItem, "key" | "pain" | "measures" | "answer">): Score | null {
  if (item.pain) return 0;
  const t = testByKey(item.key);
  if (t.group === "posture") {
    if (!item.measures.length) return null;
    const flags = item.measures.filter((m) => m.flag).length;
    return flags === 0 ? 3 : flags === 1 ? 2 : 1;
  }
  const a = item.answer;
  if (!a) return null;
  const worst = (vals: (string | number | string[] | undefined)[], scoreOf: (v: string | number) => Score | null): Score | null => {
    const s = vals.filter((v): v is string | number => v !== undefined && v !== "" && !Array.isArray(v)).map(scoreOf).filter((x): x is Score => x !== null);
    return s.length ? (Math.min(...s) as Score) : null;
  };
  switch (item.key) {
    case "overhead-squat": {
      const v = a.value;
      if (!Array.isArray(v) || !v.length) return null;
      const faults = v.filter((x) => SQUAT_FAULTS.includes(x)).length;
      return faults === 0 ? 3 : faults === 1 ? 2 : 1;
    }
    case "toe-touch": return worst([a.value], (v) => { const i = TOE.indexOf(String(v)); return i < 0 ? null : i >= 3 ? 3 : i === 2 ? 2 : 1; });
    case "shoulder-reach": return worst([a.left, a.right], (v) => { const i = REACH.indexOf(String(v)); return i < 0 ? null : i <= 1 ? 3 : i === 2 ? 2 : 1; });
    case "knee-to-wall": return worst([a.left, a.right], (v) => { const n = Number(v); return !Number.isFinite(n) ? null : n >= 10 ? 3 : n >= 6 ? 2 : 1; });
    case "balance": return worst([a.left, a.right], (v) => { const n = Number(v); return !Number.isFinite(n) ? null : n >= 30 ? 3 : n >= 15 ? 2 : 1; });
    default: return null;
  }
}

/** Left and right more than 30% apart (and at least 2 units): worth a note. */
export function sideGap(item: AssessmentItem): string | null {
  const a = item.answer;
  if (!a || a.left === undefined || a.right === undefined) return null;
  const l = Number(a.left), r = Number(a.right);
  if (!Number.isFinite(l) || !Number.isFinite(r)) return a.left !== a.right ? `Left: ${a.left}. Right: ${a.right}.` : null;
  const hi = Math.max(l, r);
  if (hi === 0 || Math.abs(l - r) < 2 || Math.abs(l - r) / hi < 0.3) return null;
  return `${l < r ? "Left" : "Right"} side ${Math.abs(l - r)} ${testByKey(item.key).input?.kind === "number" ? (testByKey(item.key).input as { unit: string }).unit : ""} behind`.trim();
}

/** Focus areas (AI suggestion, the coach decides): anything APEX scored 2 or under. */
export function suggestFocus(items: AssessmentItem[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    const s = it.score;
    if (s !== null && s <= 2) {
      const f = testByKey(it.key).focus;
      if (!out.includes(f)) out.push(f);
    }
  }
  return out;
}

export const assessmentScore = (items: AssessmentItem[]): { total: number; max: number } => {
  const scored = items.filter((i) => i.score !== null);
  return { total: scored.reduce((a, i) => a + (i.score ?? 0), 0), max: scored.length * 3 };
};

/** What still stops the client sending it, or null. */
export function submitProblem(a: Assessment): string | null {
  for (const k of a.tests) {
    const t = testByKey(k);
    const it = a.items.find((i) => i.key === k);
    if (t.media && !it?.media) return `Add the ${t.media} for ${t.title.toLowerCase()}.`;
    if (t.input) {
      const ans = it?.answer;
      const ok = t.input.kind === "checks" ? Array.isArray(ans?.value) && ans.value.length > 0 : t.input.perSide ? ans?.left !== undefined && ans.left !== "" && ans?.right !== undefined && ans.right !== "" : ans?.value !== undefined && ans.value !== "";
      if (!ok) return `Answer "${t.input.label.toLowerCase()}" for ${t.title.toLowerCase()}.`;
    }
  }
  return null;
}

/** The message the client gets when the coach finishes the review. */
export function reviewMessage(a: Assessment, coach: string): string {
  const { total, max } = assessmentScore(a.items);
  const focus = a.focus.length ? ` What we'll work on: ${a.focus.join(", ").toLowerCase()}.` : "";
  return `${coach} has reviewed your ${a.title.toLowerCase()}${max ? `: ${total} out of ${max}` : ""}.${focus}${a.summary.trim() ? ` ${a.summary.trim()}` : ""}`;
}

/* ---------- Profile, re-test and correctives ---------- */

/** 0 to 100 from the coach's scores, or null before any test is scored. */
export const assessmentPercent = (items: AssessmentItem[]): number | null => {
  const { total, max } = assessmentScore(items);
  return max ? Math.round((total / max) * 100) : null;
};

const fmt = (v: string | number | undefined, unit = "") => (v === undefined || v === "" ? "–" : `${v}${unit && typeof v === "number" ? ` ${unit}` : unit && !Number.isNaN(Number(v)) ? ` ${unit}` : ""}`);

/** One line of what the client measured or answered: "L 7 cm · R 11 cm", "Toes", "Shoulder 3.4°". */
export function testAnswerText(item: AssessmentItem): string {
  const t = testByKey(item.key);
  if (t.group === "posture") {
    const flagged = item.measures.filter((m) => m.flag);
    const show = flagged.length ? flagged : item.measures.slice(0, 1);
    return show.map((m) => `${m.label} ${m.value}°`).join(" · ") || (item.media ? "Photo" : "–");
  }
  const a = item.answer;
  const unit = t.input?.kind === "number" ? t.input.unit : "";
  if (!a) return item.media ? "Video" : "–";
  if (Array.isArray(a.value)) return a.value.filter((x) => SQUAT_FAULTS.includes(x)).join(", ") || "Clean";
  return t.input?.perSide ? `L ${fmt(a.left, unit)} · R ${fmt(a.right, unit)}` : fmt(a.value, unit);
}

/** Mobility profile rows, one per test with a score (the coach's, or the suggestion until the coach scores). */
export function assessmentProfile(a: Assessment): { key: TestKey; title: string; detail: string; score: Score | null; suggested: boolean }[] {
  return a.items.map((it) => {
    return { key: it.key, title: testByKey(it.key).title, detail: testAnswerText(it), score: it.score, suggested: false };
  });
}

export interface CompareRow {
  label: string;
  before: string;
  after: string;
  /** True when it got better, false when worse, null when the same or not comparable. */
  better: boolean | null;
}

const num = (v: unknown): number | null => (v === undefined || v === "" || v === null || !Number.isFinite(Number(v)) ? null : Number(v));

/** Before and after for a re-test: the score, every posture measure both have, and the numbers both answered. */
export function compareAssessments(before: Assessment, after: Assessment): CompareRow[] {
  const rows: CompareRow[] = [];
  const pb = assessmentPercent(before.items), pa = assessmentPercent(after.items);
  if (pb !== null && pa !== null) rows.push({ label: "Score", before: String(pb), after: String(pa), better: pa === pb ? null : pa > pb });
  for (const b of before.items) {
    const a = after.items.find((x) => x.key === b.key);
    if (!a) continue;
    for (const mb of b.measures) {
      const ma = a.measures.find((m) => m.label === mb.label);
      const where = b.key === "posture-front" ? ", front" : b.key === "posture-back" ? ", back" : "";
      if (ma) rows.push({ label: `${mb.label}${where}`, before: `${mb.value}°`, after: `${ma.value}°`, better: ma.value === mb.value ? null : ma.value < mb.value });
    }
    const t = testByKey(b.key);
    if (t.input?.kind === "number") {
      const unit = t.input.unit;
      for (const side of (t.input.perSide ? ["left", "right"] : ["value"]) as ("left" | "right" | "value")[]) {
        const x = num(b.answer?.[side]), y = num(a.answer?.[side]);
        if (x === null || y === null) continue;
        const label = `${t.key === "knee-to-wall" ? "Ankle" : t.key === "balance" ? "Balance" : t.title}${side === "value" ? "" : side === "left" ? ", left" : ", right"}`;
        rows.push({ label, before: `${x} ${unit}`, after: `${y} ${unit}`, better: x === y ? null : y > x });
      }
    }
  }
  return rows;
}

/** The last reviewed assessment before this one, to compare with. List is newest first. */
export const previousReviewed = (list: Assessment[], a: Assessment): Assessment | null =>
  list.find((x) => x.id !== a.id && x.status === "reviewed" && x.createdAt < a.createdAt) ?? null;

/** When the coach wanted a re-test, from the newest reviewed assessment. Null when none is set or one is already out. */
export function retestDue(list: Assessment[]): { at: string; due: boolean; from: Assessment } | null {
  if (list.some((a) => a.status !== "reviewed")) return null;
  const last = list.find((a) => a.status === "reviewed");
  if (!last?.reviewedAt || !last.retestWeeks) return null;
  const at = new Date(new Date(last.reviewedAt).getTime() + last.retestWeeks * 7 * 86400000);
  return { at: at.toISOString(), due: at.getTime() <= Date.now(), from: last };
}

/** Exercises from the APEX library for each focus area (AI suggestion: the coach picks which go in). */
export const CORRECTIVES: Record<string, number[]> = {
  "Left–right balance": [296, 294, 290],
  "Upper back and neck posture": [323, 341, 364],
  "Squat pattern": [316, 353, 306],
  "Hamstrings and hips": [305, 373, 355],
  "Shoulder mobility": [324, 346, 381],
  "Ankle mobility": [343, 353, 361],
  "Balance and control": [298, 299, 288],
};

/** Library exercise ids for these focus areas, no repeats, in order. */
export const correctivesFor = (focus: string[]): number[] => [...new Set(focus.flatMap((f) => CORRECTIVES[f] ?? []))];

/** Puts the coach's chosen correctives at the top of a workout, as a warm-up: 2 sets, held or slow reps, short rest. */
export function addCorrectives(workout: Workout, ids: number[]): Workout {
  let w = workout;
  const have = new Set(workout.items.map((i) => i.exerciseId));
  ids.filter((id) => !have.has(id)).forEach((id, n) => {
    const ex = exerciseById(id);
    w = insertExercise(w, ex, n);
    const hold = ex.type === "Stretching" || ex.type === "Balance";
    w = { ...w, items: w.items.map((it, j) => (j === n ? { ...it, sets: 2, reps: hold ? "30s" : "8", rpe: 5, restSeconds: 30, lastTime: "", note: "From your assessment. Each side." } : it)) };
  });
  return w;
}

/* ---------- Store ---------- */

export interface AssessmentState {
  /** Newest first. */
  list: Assessment[];
  /** "needs-update": the database doesn't have the table yet (the SQL hasn't run). */
  status: "loading" | "ready" | "needs-update" | "error";
  error?: string;
}

export interface AssessmentRequest {
  title: string;
  tests: TestKey[];
  retestWeeks: number;
}

export interface AssessmentReview {
  reviews: Partial<Record<TestKey, CoachReview>>;
  summary: string;
  focus: string[];
  /** True sends it to the client; false saves a draft. */
  done: boolean;
}

export interface AssessmentStore {
  get(): AssessmentState;
  subscribe(listener: () => void): () => void;
  /** Coach: send an assessment. */
  request(r: AssessmentRequest): Promise<void>;
  /** Client: save one test, with a new photo or video when there is one. */
  saveAnswer(id: string, key: TestKey, answer: Omit<ClientAnswer, "media">, file?: Blob | null): Promise<void>;
  /** Client: send it to the coach. */
  submit(id: string): Promise<void>;
  /** Coach: feedback on each test, a note and the focus areas. */
  review(id: string, r: AssessmentReview): Promise<void>;
  /** Coach: take back an assessment the client hasn't sent yet. */
  remove(id: string): Promise<void>;
}

export const mediaKindOf = (type: string): MediaKind => (type.startsWith("video/") ? "video" : "photo");

export function emptyAssessmentStore(): AssessmentStore {
  const state: AssessmentState = { list: [], status: "ready" };
  return { get: () => state, subscribe: () => () => {}, request: async () => {}, saveAnswer: async () => {}, submit: async () => {}, review: async () => {}, remove: async () => {} };
}

/* ---------- Rows ---------- */

export interface AssessmentRow {
  id: string;
  client_id: string;
  title: string;
  tests: TestKey[];
  status: Assessment["status"];
  answers: Partial<Record<TestKey, ClientAnswer>> | null;
  review: Partial<Record<TestKey, CoachReview>> | null;
  summary: string | null;
  focus: string[] | null;
  retest_weeks: number | null;
  created_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export const fromAssessmentRow = (r: AssessmentRow, urls: Map<string, string>): Assessment => ({
  id: r.id, title: r.title, tests: r.tests, status: r.status, createdAt: r.created_at, submittedAt: r.submitted_at, reviewedAt: r.reviewed_at,
  summary: r.summary ?? "", focus: r.focus ?? [], retestWeeks: r.retest_weeks ?? 0,
  items: r.tests.map((k) => {
    const a = { ...emptyAnswer(), ...(r.answers?.[k] ?? {}) };
    const rv = r.review?.[k];
    return scored({ key: k, ...a, media: a.media ? { ...a.media, url: urls.get(a.media.path) ?? null } : null, score: null, note: rv?.note ?? "" });
  }),
});

/** An answer as stored: no signed link, points rounded. */
export const answerForRow = (a: ClientAnswer): ClientAnswer => ({
  ...a,
  media: a.media ? { path: a.media.path, kind: a.media.kind, url: null } : null,
  points: a.points ? a.points.map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000, visibility: Math.round((p.visibility ?? 1) * 100) / 100 })) : null,
});

export const MAX_ASSESSMENT_MB = 50;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ASSESSMENT_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export function assessmentFileProblem(f: { size: number; type: string }, kind: MediaKind): string | null {
  const ok = kind === "photo" ? PHOTO_TYPES : ASSESSMENT_VIDEO_TYPES;
  if (!ok.includes(f.type)) return kind === "photo" ? "That isn't a photo APEX can read. Take it with the camera, or pick a JPEG or PNG." : "That video format isn't supported. MP4 or MOV both work.";
  if (f.size > MAX_ASSESSMENT_MB * 1024 * 1024) return `That file is over ${MAX_ASSESSMENT_MB} MB. Film a shorter clip.`;
  if (f.size === 0) return "That file is empty. Try again.";
  return null;
}

export const assessmentPath = (clientId: string, assessmentId: string, key: TestKey, type: string): string =>
  `${clientId}/${assessmentId}/${key}-${Date.now().toString(36)}.${type === "image/png" ? "png" : type === "image/webp" ? "webp" : type.startsWith("image/") ? "jpg" : type === "video/quicktime" ? "mov" : type === "video/webm" ? "webm" : "mp4"}`;

/* ---------- Demo ---------- */

/** Made-up body points for the demo's posture photos (no real photos ship with the app). */
export function demoBody(view: "front" | "side" | "back", o: { shoulderDrop?: number; hipDrop?: number; headFwd?: number } = {}): BodyPoint[] {
  const pts: BodyPoint[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.05 }));
  const put = (i: number, x: number, y: number) => { pts[i] = { x, y, visibility: 0.95 }; };
  if (view === "side") {
    // Facing right in the picture; head forward moves the ear (and nose) ahead of the shoulder.
    const fwd = o.headFwd ?? 0;
    put(0, 0.54 + fwd, 0.17); put(8, 0.48 + fwd, 0.18); put(12, 0.48, 0.3); put(24, 0.48, 0.53); put(26, 0.485, 0.72); put(28, 0.48, 0.9);
    return pts;
  }
  const flip = view === "back" ? -1 : 1;
  const L = (dx: number) => 0.5 + dx * flip;
  put(0, 0.5, 0.15); put(7, L(0.04), 0.16); put(8, L(-0.04), 0.16);
  put(11, L(0.1), 0.3); put(12, L(-0.1), 0.3 + (o.shoulderDrop ?? 0));
  put(13, L(0.12), 0.43); put(14, L(-0.12), 0.43); put(15, L(0.13), 0.55); put(16, L(-0.13), 0.55);
  put(23, L(0.07), 0.53); put(24, L(-0.07), 0.53 + (o.hipDrop ?? 0));
  put(25, L(0.07), 0.72); put(26, L(-0.07), 0.72); put(27, L(0.07), 0.9); put(28, L(-0.07), 0.9);
  return pts;
}

const ASPECT = 0.75;
const posed = (view: "front" | "side" | "back", o: Parameters<typeof demoBody>[1]): Pick<ClientAnswer, "points" | "aspect" | "measures"> => {
  const points = demoBody(view, o);
  return { points, aspect: ASPECT, measures: postureMeasures(view, points, ASPECT) };
};

/** Priya: a reviewed start assessment in September and a re-test waiting for the coach. */
export function sampleAssessments(now = new Date()): Assessment[] {
  const day = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
  const full = ASSESSMENT_TESTS.map((t) => t.key);
  const item = (key: TestKey, a: Partial<ClientAnswer>, note = ""): AssessmentItem => scored({ ...emptyItem(key), media: testByKey(key).media ? { path: `demo/${key}`, kind: testByKey(key).media!, url: null } : null, ...a, note });
  const before: Assessment = {
    id: "demo-assess-1", createdAt: day(57), title: "Full start assessment", tests: full, status: "reviewed", submittedAt: day(56), reviewedAt: day(56), retestWeeks: 8,
    summary: "Good base. Ankles and upper back are what hold your squat back, so every session starts with ten minutes on them.",
    focus: ["Ankle mobility", "Upper back and neck posture", "Balance and control"],
    items: [
      item("posture-front", posed("front", { shoulderDrop: 0.012, hipDrop: 0.002 }), "Right shoulder sits a little low. Carry and press work on the right first."),
      item("posture-side", posed("side", { headFwd: 0.04 }), "Head drifts forward. Upper back work."),
      item("posture-back", posed("back", { shoulderDrop: 0.01 })),
      item("overhead-squat", { answer: { value: ["Heels lifted", "Arms dropped forward"] } }, "Heels lift near the bottom, arms drop forward."),
      item("toe-touch", { answer: { value: "Shins" } }),
      item("shoulder-reach", { answer: { left: "Touching", right: "Under 5 cm apart" } }),
      item("knee-to-wall", { answer: { left: 7, right: 11 } }, "Left ankle is the tight one."),
      item("balance", { answer: { left: 18, right: 41 } }),
    ],
  };
  const after: Assessment = {
    id: "demo-assess-2", createdAt: day(2), title: "Re-test", tests: full, status: "submitted", submittedAt: day(0.2), reviewedAt: null, retestWeeks: 8, summary: "", focus: [],
    items: [
      item("posture-front", posed("front", { shoulderDrop: 0.004 })),
      item("posture-side", posed("side", { headFwd: 0.017 })),
      item("posture-back", posed("back", { shoulderDrop: 0.003 })),
      item("overhead-squat", { answer: { value: ["Heels lifted"] } }),
      item("toe-touch", { answer: { value: "Toes" } }),
      item("shoulder-reach", { answer: { left: "Touching", right: "Touching" } }),
      item("knee-to-wall", { answer: { left: 10, right: 11 } }),
      item("balance", { answer: { left: 41, right: 45 } }),
    ],
  };
  return [after, before];
}

/** Demo store: in memory for this visit. `toUrl` turns a picked photo or video into something the page can show. */
export function createDemoAssessmentStore(toUrl: (b: Blob) => string | null = () => null, now = new Date(), side: "coach" | "client" = "coach"): AssessmentStore {
  const sample = sampleAssessments(now);
  // The client's demo opens with the re-test still to do, so the steps and camera can be tried.
  if (side === "client") sample[0] = { ...sample[0]!, status: "requested", submittedAt: null, items: sample[0]!.items.map((i) => (i.key === "posture-front" ? i : emptyItem(i.key))) };
  let state: AssessmentState = { list: sample, status: "ready" };
  const listeners = new Set<() => void>();
  const update = (fn: (l: Assessment[]) => Assessment[]) => {
    state = { ...state, list: fn(state.list) };
    listeners.forEach((l) => l());
  };
  const edit = (id: string, fn: (a: Assessment) => Assessment) => update((l) => l.map((a) => (a.id === id ? fn(a) : a)));
  return {
    get: () => state,
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
    async request(r) {
      const a: Assessment = { id: `demo-assess-${Date.now()}`, createdAt: new Date().toISOString(), title: r.title, tests: r.tests, status: "requested", items: r.tests.map(emptyItem), submittedAt: null, reviewedAt: null, summary: "", focus: [], retestWeeks: r.retestWeeks };
      update((l) => [a, ...l]);
    },
    async saveAnswer(id, key, answer, file) {
      if (file) { const p = assessmentFileProblem({ size: file.size, type: file.type }, mediaKindOf(file.type)); if (p) throw new Error(p); }
      edit(id, (a) => ({ ...a, items: a.items.map((i) => (i.key === key ? scored({ ...i, ...answer, media: file ? { path: `demo/${id}/${key}`, kind: mediaKindOf(file.type), url: toUrl(file) } : i.media }) : i)) }));
    },
    async submit(id) {
      const a = state.list.find((x) => x.id === id);
      const p = a && submitProblem(a);
      if (p) throw new Error(p);
      edit(id, (x) => ({ ...x, status: "submitted", submittedAt: new Date().toISOString() }));
    },
    async review(id, r) {
      edit(id, (a) => ({
        ...a, summary: r.summary.trim(), focus: r.focus,
        items: a.items.map((i) => ({ ...i, note: r.reviews[i.key]?.note ?? i.note })),
        ...(r.done ? { status: "reviewed" as const, reviewedAt: new Date().toISOString() } : {}),
      }));
    },
    async remove(id) { update((l) => l.filter((a) => a.id !== id || a.status !== "requested")); },
  };
}
