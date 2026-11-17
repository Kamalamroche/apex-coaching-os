/* Hands-free workouts: what the coach voice says, and what the client can say back. Rule-based, no AI: a fixed set of
   phrases and commands, so it behaves the same every time. Pure, so it is unit tested. The app speaks and listens with
   the phone's own speech features. */

export type VoiceCommand =
  | { kind: "done"; reps?: number; kg?: number }
  | { kind: "start" }
  | { kind: "restMore"; seconds: number }
  | { kind: "skipRest" }
  | { kind: "next" }
  | { kind: "back" }
  | { kind: "repeat" }
  | { kind: "cues" }
  | { kind: "finish" }
  | { kind: "stop" };

const SMALL: Record<string, number> = {
  zero: 0, one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8, ate: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** Turns spoken number words into digits: "twenty five" → "25", "one hundred and ten" → "110", "a minute" stays. */
export function wordsToDigits(text: string): string {
  const toks = text.toLowerCase().replace(/[^\p{L}\p{N}.\s-]/gu, " ").replace(/-/g, " ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let acc: number | null = null;
  const flush = () => { if (acc !== null) { out.push(String(acc)); acc = null; } };
  for (const t of toks) {
    if (t in SMALL && !(acc === null && (t === "to" || t === "too" || t === "for" || t === "won" || t === "ate"))) {
      const v = SMALL[t]!;
      const joins: boolean = acc !== null && ((acc >= 100 && acc % 100 === 0 && v < 100) || (acc >= 20 && acc % 10 === 0 && v < 10));
      acc = joins ? acc! + v : (flush(), v);
      continue;
    }
    if (t === "hundred" && acc !== null) { acc *= 100; continue; }
    if (t === "and" && acc !== null && acc >= 100) continue;
    flush();
    out.push(t);
  }
  flush();
  return out.join(" ");
}

const has = (t: string, re: RegExp) => re.test(t);

/** What the client said, as a command. Null when it isn't one, so chatter in the gym is ignored. */
export function parseVoiceCommand(heard: string): VoiceCommand | null {
  const t = ` ${wordsToDigits(heard)} `;
  if (has(t, / (stop listening|hands free off|turn off) /)) return { kind: "stop" };
  if (has(t, / (finish|end) (the )?(workout|session) | i'?m finished | finish workout /)) return { kind: "finish" };
  if (has(t, / skip( the)? rest | (no|end) rest | i'?m ready | ready /)) return { kind: "skipRest" };
  const num = /(\d+)/.exec(t);
  if (num && has(t, / (more|extra|add|extend|longer) /) && !has(t, / (done|reps?|kg|kilos?) /)) {
    const n = Number(num[1]);
    return { kind: "restMore", seconds: Math.min(600, has(t, / (minutes?|mins?) /) ? n * 60 : n) };
  }
  if (has(t, / (more|longer|extend) rest | rest (more|longer) | (another|one more) minute | a minute more /)) return { kind: "restMore", seconds: has(t, /minute/) ? 60 : 30 };
  if (has(t, / (next|skip)( exercise)? /) && !has(t, / next set /)) return { kind: "next" };
  if (has(t, / (go back|previous|back) /)) return { kind: "back" };
  if (has(t, / (repeat|say (that|it) again|again|what'?s next|where am i) /)) return { kind: "repeat" };
  if (has(t, / (cues?|tips?|how do i|form|technique) /)) return { kind: "cues" };
  if (has(t, / (start|go|begin)( the)?( timer| set)? /) && !has(t, / done /)) return { kind: "start" };
  if (has(t, / (done|finished|complete|completed|got it|that'?s it|logged?) /) || has(t, / \d+ (reps?|wraps?|raps?|times) /)) {
    const reps = /(\d+)\s*(?:reps?|wraps?|raps?|times)/.exec(t)?.[1] ?? /(?:done|finished|did|got)\s+(\d+)(?!\s*(?:kg|kilo|kilos|pounds|lb))/.exec(t)?.[1];
    const kg = /(?:at|with)\s+(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|pounds|lbs?)/.exec(t);
    const kgN = kg ? Number(kg[1] ?? kg[2]) : undefined;
    return { kind: "done", ...(reps ? { reps: Number(reps) } : {}), ...(kgN !== undefined && kgN > 0 ? { kg: kgN } : {}) };
  }
  return null;
}

/* ---------- What the coach voice says ---------- */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "1 minute 30", "45 seconds". */
export function spokenTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (!m) return plural(s, "second");
  return s ? `${plural(m, "minute")} ${s}` : plural(m, "minute");
}

/** "5 reps" / "40 seconds" / "200 metres" for a target written by the coach. */
export function spokenTarget(reps: string): string {
  const r = reps.trim();
  const secs = /^(\d+)\s*s$/i.exec(r);
  if (secs) return `${secs[1]} seconds`;
  const m = /^(\d+)\s*m$/i.exec(r);
  if (m) return `${m[1]} metres`;
  const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(r);
  if (range) return `${range[1]} to ${range[2]} reps`;
  return /^\d+$/.test(r) ? plural(Number(r), "rep") : r;
}

export interface SpokenSet {
  exercise: string;
  /** 1-based. */
  set: number;
  sets: number;
  reps: string;
  /** Load as the client sees it, e.g. "100 kilos"; null for bodyweight. */
  load: string | null;
  circuit?: boolean;
}

/** Said when an exercise comes up: what it is, and the set to do now. */
export function introLine(s: SpokenSet, note?: string | null): string {
  const what = `${s.circuit ? "Round" : "Set"} ${s.set} of ${s.sets}: ${spokenTarget(s.reps)}${s.load ? ` at ${s.load}` : ""}.`;
  return [`${s.exercise}.`, what, note ? `Coach says: ${note}` : null, /^\d+\s*s$/i.test(s.reps.trim()) ? "Say start when you're ready." : "Say done when you finish."]
    .filter(Boolean).join(" ");
}

/** Said when a set is logged. */
export function loggedLine(reps: number | null, load: string | null): string {
  return `Logged${reps ? ` ${plural(reps, "rep")}` : ""}${load ? ` at ${load}` : ""}.`;
}

/** Said as the rest starts, and what's next after it. */
export function restStartLine(seconds: number, next: SpokenSet | null): string {
  return `Rest ${spokenTime(seconds)}.${next ? ` Next: ${next.exercise === "" ? "" : `${next.exercise}, `}${spokenTarget(next.reps)}${next.load ? ` at ${next.load}` : ""}.` : ""}`;
}

/** What to say at a given number of seconds left in a rest, or null to stay quiet. */
export function restTickLine(left: number, total: number): string | null {
  if (left === 30 && total >= 75) return "30 seconds.";
  if (left === 10) return "10 seconds. Get ready.";
  if (left === 3) return "3";
  if (left === 2) return "2";
  if (left === 1) return "1";
  if (left === 0) return "Go.";
  return null;
}

/** The help line: what the client can say. */
export const VOICE_HELP = "You can say: done, or done 8 reps. Rest 30 more. Skip rest. Next. Back. Repeat. Tips. Finish workout.";

/** The cues, read out. */
export const cuesLine = (exercise: string, cues: string[]): string =>
  cues.length ? `${exercise} tips. ${cues.slice(0, 4).map((c) => c.replace(/\.?$/, ".")).join(" ")}` : `No tips for ${exercise} yet.`;
