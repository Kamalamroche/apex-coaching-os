/* APEX Twin: once a week it drafts each client's next-week adjustment and a short message in the
   coach's own words, and the coach approves, edits or rejects every one. Nothing reaches a client
   without the coach's tap. Rule-based, like progression.ts and copilot.ts: every draft says why.
   Guardrails: anything that mentions pain or injury is never answered here, it goes to the coach to write.
   Live: twin_voice and twin_decisions (supabase/migrations/20261106090000_twin.sql). Pure, so it is unit tested. */

import { addDays } from "./lifestyle";
import { exerciseById } from "./library";
import { DAY_NAMES } from "./program";
import { progressWorkout, roundLoad } from "./progression";
import type { Program, ProgramDay } from "./types";

/* ---------- What the Twin reads ---------- */

export interface TwinSignals {
  clientId: string;
  name: string;
  /** When coaching started (ISO). */
  startedAt: string;
  /** Finished sessions in the last 28 days. */
  sessions: { finishedAt: string; rpe: number | null; note: string }[];
  /** Training days a week in the current program; 0 when there is no program yet. */
  plannedPerWeek: number;
  /** Check-ins in the last 21 days, any order. Scales are 1-5; sleep in hours. */
  checkIns: { at: string; energy: number | null; mood: number | null; stress: number | null; sleepHours: number | null; text: string }[];
  /** What the client wrote to the coach in the last 21 days. */
  clientMessages: { at: string; text: string }[];
}

export type TwinSituation = "injury" | "quiet" | "missed" | "tired" | "progress" | "steady" | "new" | "noprogram";
export type TwinAdjustKind = "progress" | "hold" | "lighter" | "deload" | "none";

export interface TwinFlag {
  text: string;
  /** Data = a fact from what was logged; Insight = what the Twin reads into it. */
  label: "Data" | "Insight";
  tone: "crit" | "warn" | "good";
}

export interface TwinDraft {
  clientId: string;
  name: string;
  situation: TwinSituation;
  /** Goes to the top of the queue. */
  attention: boolean;
  /** 0-100. */
  churnRisk: number;
  flags: TwinFlag[];
  adjust: TwinAdjustKind;
  /** One line for the card, e.g. "Lighter week: one set fewer on every exercise". */
  adjustText: string;
  /** null when the coach has to write it (pain or injury mentioned). */
  message: string | null;
  done: number;
  planned: number;
}

const DAY = 86400000;
const daysSince = (iso: string, now: Date) => (now.getTime() - Date.parse(iso)) / DAY;

/* ---------- Pain and injury ---------- */

const PAIN = /\b(pain(ful)?|hurts?|hurting|hurt|injur(y|ies|ed)|sprain(ed)?|strain(ed)?|tweak(ed)?|niggle|twinge|physio|doctor|gp|a&e|swollen|swelling|dizzy|faint(ed)?|chest)\b/i;
const NO_PAIN = /\b(no|without|zero|not in any)\s+(pain|niggles?|injur(y|ies))\b/i;

/** The first recent phrase that mentions pain or injury, or null. "No pain" doesn't count. */
export function painMention(texts: string[]): string | null {
  for (const t of texts) {
    const clean = t.replace(NO_PAIN, "");
    const m = PAIN.exec(clean);
    if (!m) continue;
    const start = Math.max(0, clean.lastIndexOf(".", m.index) + 1);
    const end = clean.indexOf(".", m.index);
    const sentence = clean.slice(start, end === -1 ? undefined : end).trim();
    return sentence.length > 90 ? `${sentence.slice(0, 87)}…` : sentence;
  }
  return null;
}

/* ---------- Reading the week ---------- */

export function readWeek(s: TwinSignals, now: Date): Omit<TwinDraft, "message"> {
  const flags: TwinFlag[] = [];
  const recent = (iso: string, days: number) => daysSince(iso, now) <= days;
  const done = s.sessions.filter((x) => recent(x.finishedAt, 7)).length;
  const before = s.sessions.filter((x) => !recent(x.finishedAt, 14) && recent(x.finishedAt, 28)).length;
  const last14 = s.sessions.filter((x) => recent(x.finishedAt, 14)).length;
  const planned = s.plannedPerWeek;
  const isNew = daysSince(s.startedAt, now) < 14;

  const lastHeard = [...s.sessions.map((x) => x.finishedAt), ...s.clientMessages.map((x) => x.at), ...s.checkIns.map((x) => x.at)].sort().at(-1) ?? null;
  const quietDays = lastHeard ? Math.floor(daysSince(lastHeard, now)) : Math.floor(daysSince(s.startedAt, now));
  const quiet = quietDays >= 10 && !isNew;

  const latest = [...s.checkIns].sort((a, b) => b.at.localeCompare(a.at)).find((c) => recent(c.at, 10));
  const tiredBits: string[] = [];
  if (latest) {
    if (latest.energy !== null && latest.energy <= 2) tiredBits.push(`energy ${latest.energy}/5`);
    if (latest.mood !== null && latest.mood <= 2) tiredBits.push(`mood ${latest.mood}/5`);
    if (latest.stress !== null && latest.stress >= 4) tiredBits.push(`stress ${latest.stress}/5`);
    if (latest.sleepHours !== null && latest.sleepHours < 6) tiredBits.push(`${latest.sleepHours} h sleep`);
  }
  const tired = tiredBits.length > 0;

  const texts = [
    ...s.clientMessages.filter((m) => recent(m.at, 14)).map((m) => m.text),
    ...s.checkIns.filter((c) => recent(c.at, 14)).map((c) => c.text),
    ...s.sessions.filter((x) => recent(x.finishedAt, 14)).map((x) => x.note),
  ].filter(Boolean);
  const pain = painMention(texts);

  const rpes = s.sessions.filter((x) => recent(x.finishedAt, 7) && x.rpe !== null).map((x) => x.rpe as number);
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

  // Churn risk: going quiet, skipping, a falling trend and low mood all add up.
  let churn = 0;
  if (quiet) churn += 40;
  if (planned && !isNew) churn += done === 0 ? 30 : done <= planned - 2 ? 15 : 0;
  if (before >= 2 && last14 <= before / 2) churn += 20;
  if (tired) churn += 10;
  if (!s.checkIns.some((c) => recent(c.at, 14)) && !isNew) churn += 10;
  churn = Math.min(100, churn);

  if (pain) flags.push({ text: `Mentions pain: "${pain}"`, label: "Data", tone: "crit" });
  if (quiet) flags.push({ text: `Quiet for ${quietDays} days`, label: "Data", tone: "crit" });
  if (planned) flags.push({ text: `${done} of ${planned} sessions last 7 days`, label: "Data", tone: done >= planned ? "good" : done === 0 ? "crit" : "warn" });
  if (tired) flags.push({ text: `Check-in: ${tiredBits.join(", ")}`, label: "Data", tone: "warn" });
  if (avgRpe !== null) flags.push({ text: `Average session effort RPE ${Math.round(avgRpe * 10) / 10}`, label: "Data", tone: avgRpe > 8.5 ? "warn" : "good" });
  if (churn >= 50) flags.push({ text: `High risk of leaving (${churn}/100)`, label: "Insight", tone: "crit" });
  else if (before >= 2 && last14 <= before / 2) flags.push({ text: `Training dropped from ${before} to ${last14} sessions a fortnight`, label: "Insight", tone: "warn" });

  let situation: TwinSituation;
  if (pain) situation = "injury";
  else if (!planned) situation = "noprogram";
  else if (quiet) situation = "quiet";
  else if (isNew) situation = "new";
  else if (done === 0 || done <= planned - 2) situation = "missed";
  else if (tired) situation = "tired";
  else if (done >= planned && (avgRpe === null || avgRpe <= 8.5)) situation = "progress";
  else situation = "steady";

  const adjust: TwinAdjustKind = ({ injury: "none", noprogram: "none", quiet: "lighter", new: "hold", missed: "lighter", tired: "deload", progress: "progress", steady: "hold" } as const)[situation];
  return {
    clientId: s.clientId, name: s.name, situation, adjust, adjustText: ADJUST_TEXT[situation === "injury" ? "injury" : adjust],
    attention: situation === "injury" || situation === "quiet" || churn >= 50 || (planned > 0 && done === 0 && !isNew),
    churnRisk: churn, flags, done, planned,
  };
}

const ADJUST_TEXT: Record<TwinAdjustKind | "injury", string> = {
  progress: "Progress: add load where every rep was hit last time",
  hold: "Hold: same programme next week",
  lighter: "Lighter week: one set fewer on every exercise",
  deload: "Deload: 10% lighter on every loaded exercise",
  none: "No change",
  injury: "No change until you've spoken to them",
};

/* ---------- The coach's voice ---------- */

export interface TwinVoice {
  /** How messages end, e.g. "Kamal" or "Coach K". */
  signOff: string;
  /** The coach's own wording per situation, learnt from edits. Placeholders: {first} {done} {planned} {coach}. */
  phrases: Partial<Record<TwinSituation, string>>;
}

export const DEFAULT_PHRASES: Record<Exclude<TwinSituation, "injury">, string> = {
  progress: "Hi {first}, {done} of {planned} sessions done and they moved well. I've added a little weight where you earned it. Same focus next week: clean reps first. {coach}",
  steady: "Hi {first}, solid week. Next week stays the same so you can own these weights before we push on. Shout if anything feels off. {coach}",
  missed: "Hi {first}, last week got busy ({done} of {planned} sessions). I've made next week a bit lighter so it's easier to fit in. Which days work best for you? {coach}",
  quiet: "Hi {first}, just checking in, I haven't heard from you for a bit. No pressure at all. I've made next week shorter so it's easy to get going again. {coach}",
  tired: "Hi {first}, your check-in says you're running low, so I've eased next week off. Recover well and we'll build again after. Prioritise sleep where you can. {coach}",
  new: "Hi {first}, great start. Next week builds on the same sessions. Tell me how the weights feel so I can fine-tune them. {coach}",
  noprogram: "Hi {first}, I'm putting your programme together now. Anything you'd like me to know before you start? {coach}",
};

export const SITUATION_TITLE: Record<TwinSituation, string> = {
  injury: "Mentions pain or injury",
  quiet: "Gone quiet",
  missed: "Missed sessions",
  tired: "Running low",
  progress: "Ready to progress",
  steady: "Steady week",
  new: "New client",
  noprogram: "No programme yet",
};

export const firstOf = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

export function fillPhrase(phrase: string, v: { first: string; done: number; planned: number; coach: string }): string {
  return phrase
    .replace(/\s*\{coach\}/g, v.coach.trim() ? `\n${v.coach.trim()}` : "")
    .replace(/\{first\}/g, v.first)
    .replace(/\{done\}/g, String(v.done))
    .replace(/\{planned\}/g, String(v.planned))
    .trim();
}

/** The draft message, in the coach's words where the Twin has learnt them. Never for pain or injury. */
export function draftMessage(d: Omit<TwinDraft, "message">, voice: TwinVoice): string | null {
  if (d.situation === "injury") return null;
  const phrase = voice.phrases[d.situation] ?? DEFAULT_PHRASES[d.situation];
  return fillPhrase(phrase, { first: firstOf(d.name), done: d.done, planned: d.planned, coach: voice.signOff });
}

export function draftWeek(signals: TwinSignals[], voice: TwinVoice, now: Date): TwinDraft[] {
  const order: TwinSituation[] = ["injury", "quiet", "missed", "tired", "noprogram", "new", "progress", "steady"];
  return signals
    .map((s) => {
      const d = readWeek(s, now);
      return { ...d, message: draftMessage(d, voice) };
    })
    .sort((a, b) => Number(b.attention) - Number(a.attention) || order.indexOf(a.situation) - order.indexOf(b.situation) || b.churnRisk - a.churnRisk || a.name.localeCompare(b.name));
}

/** Turns an edited message back into a reusable phrase, so next week's draft starts from the coach's wording. */
export function learnPhrase(edited: string, d: Pick<TwinDraft, "name" | "done" | "planned">, signOff: string): string {
  const first = firstOf(d.name);
  let p = edited.trim();
  if (signOff.trim()) {
    const so = signOff.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    p = p.replace(new RegExp(`\\s*${so}\\s*$`), " {coach}");
  }
  if (first) p = p.replace(new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), "{first}");
  if (d.planned) p = p.replace(new RegExp(`\\b${d.done} (of|out of|/) ${d.planned}\\b`, "g"), "{done} $1 {planned}");
  return p;
}

/* ---------- Changing the program ---------- */

/** The week the adjustment goes into: the next one, or the current one when the program has no more weeks. */
export const twinTargetWeek = (program: Program, currentWeek: number): number => (currentWeek < program.weeks ? currentWeek + 1 : currentWeek);

export function applyTwinAdjust(program: Program, week: number, kind: TwinAdjustKind): Program {
  if (kind === "none" || kind === "hold") return program;
  return {
    ...program,
    days: program.days.map((d): ProgramDay => {
      if (d.week !== week) return d;
      if (kind === "progress") return { ...d, items: progressWorkout(d).workout.items };
      if (kind === "lighter") return { ...d, items: d.items.map((it) => (it.sets > 1 ? { ...it, sets: it.sets - 1, ...(it.setPlan && it.setPlan.length > 1 ? { setPlan: it.setPlan.slice(0, -1) } : {}) } : it)) };
      return {
        ...d,
        items: d.items.map((it) => {
          if (!it.kg) return it;
          const ex = exerciseById(it.exerciseId);
          return { ...it, kg: roundLoad(it.kg * 0.9, ex), ...(it.setPlan ? { setPlan: it.setPlan.map((s) => ({ ...s, kg: s.kg ? roundLoad(s.kg * 0.9, ex) : s.kg })) } : {}) };
        }),
      };
    }),
  };
}

/** What the adjustment changes, one line per exercise, for the coach to see before approving. */
export function twinChanges(before: Program, after: Program, week: number): string[] {
  const lines: string[] = [];
  for (const d of after.days.filter((x) => x.week === week)) {
    const b = before.days.find((x) => x.key === d.key);
    if (!b) continue;
    for (const it of d.items) {
      const was = b.items.find((x) => x.key === it.key);
      if (!was) continue;
      const bits: string[] = [];
      if (was.kg !== it.kg) bits.push(`${was.kg} → ${it.kg} kg`);
      if (was.sets !== it.sets) bits.push(`${was.sets} → ${it.sets} sets`);
      if (was.reps !== it.reps) bits.push(`reps ${was.reps} → ${it.reps}`);
      if (bits.length) lines.push(`${DAY_NAMES[d.dayIndex] ?? d.name} · ${exerciseById(it.exerciseId).name}: ${bits.join(", ")}`);
    }
  }
  return lines;
}

/* ---------- Decisions ---------- */

export type TwinStatus = "approved" | "edited" | "rejected";

export interface TwinDecision {
  clientId: string;
  weekOf: string;
  situation: TwinSituation;
  adjust: TwinAdjustKind;
  status: TwinStatus;
  drafted: string | null;
  sent: string | null;
  decidedAt: string;
}

/** Monday of the week `now` falls in, YYYY-MM-DD (local). */
export function weekOf(now: Date): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const back = (now.getDay() + 6) % 7;
  return addDays(d, -back);
}

/** "Approved without edits" across decided drafts, the number the 4-week test watches. */
export function twinStats(decisions: TwinDecision[]): { decided: number; approved: number; edited: number; rejected: number; asIsPct: number | null } {
  const approved = decisions.filter((d) => d.status === "approved").length;
  const edited = decisions.filter((d) => d.status === "edited").length;
  const rejected = decisions.filter((d) => d.status === "rejected").length;
  const decided = approved + edited + rejected;
  return { decided, approved, edited, rejected, asIsPct: decided ? Math.round((approved / decided) * 100) : null };
}

export interface TwinDecisionRow {
  coach_id: string;
  client_id: string;
  week_of: string;
  situation: TwinSituation;
  adjust: TwinAdjustKind;
  status: TwinStatus;
  drafted: string | null;
  sent: string | null;
  decided_at: string;
}

export const fromTwinDecisionRow = (r: TwinDecisionRow): TwinDecision => ({
  clientId: r.client_id, weekOf: r.week_of, situation: r.situation, adjust: r.adjust, status: r.status, drafted: r.drafted, sent: r.sent, decidedAt: r.decided_at,
});

export const toTwinDecisionRow = (d: TwinDecision, coachId: string): TwinDecisionRow => ({
  coach_id: coachId, client_id: d.clientId, week_of: d.weekOf, situation: d.situation, adjust: d.adjust, status: d.status, drafted: d.drafted, sent: d.sent, decided_at: d.decidedAt,
});

/* ---------- Demo ---------- */

export const DEMO_TWIN_STORE_CLIENT = "demo-priya";

/** A week of sample signals covering each situation, around `now`. */
export function sampleTwinSignals(now: Date): TwinSignals[] {
  const ago = (days: number, hour = 8) => new Date(now.getTime() - days * DAY + hour * 3600000 - 12 * 3600000).toISOString();
  const s = (days: number[], rpe = 7.5, note = "") => days.map((d) => ({ finishedAt: ago(d), rpe, note }));
  const ci = (days: number, energy: number, mood: number, stress: number, sleepHours: number, text = "") => ({ at: ago(days), energy, mood, stress, sleepHours, text });
  return [
    { clientId: DEMO_TWIN_STORE_CLIENT, name: "Priya Sharma", startedAt: ago(70), plannedPerWeek: 3, sessions: s([1, 3, 5, 8, 10, 12, 15, 17, 19]), checkIns: [ci(2, 4, 4, 2, 7.5, "Felt strong on squats")], clientMessages: [{ at: ago(1), text: "Loved Monday's session!" }] },
    { clientId: "demo-james", name: "James Kowalski", startedAt: ago(120), plannedPerWeek: 4, sessions: s([1, 2, 4, 6, 8, 9, 11, 13], 8), checkIns: [ci(3, 4, 4, 2, 7, "")], clientMessages: [] },
    { clientId: "demo-sarah", name: "Sarah Mitchell", startedAt: ago(90), plannedPerWeek: 3, sessions: s([12, 16, 18, 20, 23, 25]), checkIns: [ci(13, 2, 2, 4, 5.5, "Work is mad at the moment")], clientMessages: [{ at: ago(12), text: "Sorry, crazy week" }] },
    { clientId: "demo-omar", name: "Omar Taylor", startedAt: ago(60), plannedPerWeek: 3, sessions: s([2, 4, 6, 9, 11], 7.5, ""), checkIns: [ci(2, 3, 3, 3, 7, "Left knee was sore after lunges, a bit of pain going downstairs.")], clientMessages: [] },
    { clientId: "demo-lena", name: "Lena Rossi", startedAt: ago(80), plannedPerWeek: 3, sessions: s([2, 4, 6, 9, 11, 13]), checkIns: [ci(1, 2, 3, 4, 5, "Not sleeping well, new job")], clientMessages: [] },
    { clientId: "demo-marcus", name: "Marcus Webb", startedAt: ago(40), plannedPerWeek: 4, sessions: s([3, 9, 10, 12, 14, 16, 17]), checkIns: [ci(4, 3, 3, 3, 7, "")], clientMessages: [] },
    { clientId: "demo-ella", name: "Ella Brooks", startedAt: ago(8), plannedPerWeek: 3, sessions: s([2, 5]), checkIns: [], clientMessages: [{ at: ago(2), text: "Thanks for the plan!" }] },
  ];
}
