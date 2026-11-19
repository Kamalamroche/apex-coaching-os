/* Live sessions: the coach runs one interval timer and every client who joins follows it on their own phone, in step.
 * The coach's phone holds the plan and the controls (start, pause, skip, end); clients only follow. State is sent
 * as plain messages (Supabase Realtime broadcast live, a BroadcastChannel in the demo), so nothing is stored.
 * Pure, so it is unit tested. */

export interface LiveBlock {
  name: string;
  seconds: number;
  kind: "work" | "rest";
}

export interface LivePlan {
  title: string;
  blocks: LiveBlock[];
}

/** What the coach broadcasts. Times are the coach's clock, in ms. */
export interface LiveState {
  plan: LivePlan;
  status: "live" | "paused" | "ended";
  /** The block the coach last moved to. */
  index: number;
  /** When that block ends, while live. */
  endsAt: number;
  /** Ms left in the block, while paused. */
  leftMs: number;
  /** The coach's clock when this was sent, so each phone can correct for its own clock. */
  sentAt: number;
  coach: string;
}

export interface LiveView {
  status: LiveState["status"] | "done";
  index: number;
  block: LiveBlock | null;
  next: LiveBlock | null;
  /** Whole seconds left in this block (rounded up). */
  left: number;
  /** 0 to 1 through this block. */
  progress: number;
  /** "Round 3 of 8", counting work blocks. */
  round: string;
}

export const LIVE_TITLE_MAX = 60;
export const LIVE_MAX_BLOCKS = 120;

export const LIVE_PRESETS: { key: string; title: string; work: number; rest: number; rounds: number; moves: string[] }[] = [
  { key: "hiit", title: "HIIT 40 / 20", work: 40, rest: 20, rounds: 10, moves: ["Squat jumps", "Push-ups", "Mountain climbers", "Reverse lunges", "Plank shoulder taps"] },
  { key: "tabata", title: "Tabata 20 / 10", work: 20, rest: 10, rounds: 8, moves: ["Burpees", "High knees"] },
  { key: "circuit", title: "Strength circuit 45 / 15", work: 45, rest: 15, rounds: 12, moves: ["Goblet squats", "Dumbbell rows", "Glute bridges", "Shoulder press"] },
  { key: "emom", title: "EMOM 12 minutes", work: 60, rest: 0, rounds: 12, moves: ["10 kettlebell swings", "8 push-ups", "12 air squats"] },
];

/**
 * Work and rest blocks from a simple interval recipe. Moves rotate through the rounds; rest after every work block
 * except the last. A 10 second "Get ready" goes first.
 */
export function buildIntervals(r: { title: string; work: number; rest: number; rounds: number; moves: string[] }): LivePlan {
  const moves = r.moves.map((m) => m.trim()).filter(Boolean);
  const list = moves.length ? moves : ["Work"];
  const rounds = Math.max(1, Math.min(60, Math.round(r.rounds)));
  const blocks: LiveBlock[] = [{ name: "Get ready", seconds: 10, kind: "rest" }];
  for (let i = 0; i < rounds; i++) {
    blocks.push({ name: list[i % list.length]!.slice(0, 60), seconds: Math.max(5, Math.round(r.work)), kind: "work" });
    if (r.rest > 0 && i < rounds - 1) blocks.push({ name: "Rest", seconds: Math.max(5, Math.round(r.rest)), kind: "rest" });
  }
  return { title: r.title.trim().slice(0, LIVE_TITLE_MAX) || "Live session", blocks: blocks.slice(0, LIVE_MAX_BLOCKS) };
}

export const planSeconds = (p: LivePlan): number => p.blocks.reduce((a, b) => a + b.seconds, 0);

/** Coach: start from the first block now. */
export function startLive(plan: LivePlan, coach: string, now: number): LiveState {
  return { plan, status: "live", index: 0, endsAt: now + plan.blocks[0]!.seconds * 1000, leftMs: 0, sentAt: now, coach };
}

/** Where the session really is at `now`: the coach only sends changes, so each phone walks forward on its own. */
function position(s: LiveState, now: number): { index: number; leftMs: number } | null {
  if (s.status === "paused") return { index: s.index, leftMs: s.leftMs };
  let index = s.index;
  let endsAt = s.endsAt;
  while (now >= endsAt) {
    index++;
    if (index >= s.plan.blocks.length) return null;
    endsAt += s.plan.blocks[index]!.seconds * 1000;
  }
  return { index, leftMs: endsAt - now };
}

export function pauseLive(s: LiveState, now: number): LiveState {
  const p = position(s, now);
  if (!p || s.status !== "live") return s;
  return { ...s, status: "paused", index: p.index, leftMs: p.leftMs, sentAt: now };
}

export function resumeLive(s: LiveState, now: number): LiveState {
  if (s.status !== "paused") return s;
  return { ...s, status: "live", endsAt: now + s.leftMs, leftMs: 0, sentAt: now };
}

/** Coach: jump to the next block (or back with -1). Past the end ends the session. */
export function skipLive(s: LiveState, now: number, by: 1 | -1 = 1): LiveState {
  const p = position(s, now);
  const index = (p?.index ?? s.plan.blocks.length - 1) + by;
  if (index >= s.plan.blocks.length) return endLive(s, now);
  const i = Math.max(0, index);
  const ms = s.plan.blocks[i]!.seconds * 1000;
  return s.status === "paused" ? { ...s, index: i, leftMs: ms, sentAt: now } : { ...s, status: "live", index: i, endsAt: now + ms, sentAt: now };
}

export const endLive = (s: LiveState, now: number): LiveState => ({ ...s, status: "ended", sentAt: now });

/** What a phone shows at `now` (its own clock), given how far its clock is from the coach's. */
export function liveView(s: LiveState, now: number, offsetMs = 0): LiveView {
  const t = now + offsetMs;
  const total = s.plan.blocks.filter((b) => b.kind === "work").length;
  if (s.status === "ended") return { status: "ended", index: s.plan.blocks.length, block: null, next: null, left: 0, progress: 1, round: "" };
  const p = position(s, t);
  if (!p) return { status: "done", index: s.plan.blocks.length, block: null, next: null, left: 0, progress: 1, round: "" };
  const block = s.plan.blocks[p.index]!;
  const done = s.plan.blocks.slice(0, p.index + 1).filter((b) => b.kind === "work").length;
  const round = block.kind === "work" ? `Round ${done} of ${total}` : done < total ? `Next: round ${done + 1} of ${total}` : "";
  return {
    status: s.status,
    index: p.index,
    block,
    next: s.plan.blocks[p.index + 1] ?? null,
    left: Math.max(0, Math.ceil(p.leftMs / 1000)),
    progress: Math.min(1, Math.max(0, 1 - p.leftMs / (block.seconds * 1000))),
    round,
  };
}

/** A message that arrived is only trusted if it looks like a LiveState. */
export function readLiveState(v: unknown): LiveState | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Partial<LiveState>;
  if (!s.plan || !Array.isArray(s.plan.blocks) || !s.plan.blocks.length || s.plan.blocks.length > LIVE_MAX_BLOCKS) return null;
  if (!s.plan.blocks.every((b) => b && typeof b.name === "string" && typeof b.seconds === "number" && b.seconds > 0 && (b.kind === "work" || b.kind === "rest"))) return null;
  if (s.status !== "live" && s.status !== "paused" && s.status !== "ended") return null;
  if (typeof s.index !== "number" || typeof s.endsAt !== "number" || typeof s.leftMs !== "number" || typeof s.sentAt !== "number") return null;
  return { plan: { title: String(s.plan.title ?? "Live session").slice(0, LIVE_TITLE_MAX), blocks: s.plan.blocks }, status: s.status, index: s.index, endsAt: s.endsAt, leftMs: s.leftMs, sentAt: s.sentAt, coach: String(s.coach ?? "Your coach").slice(0, 60) };
}

/** "0:40", "12:00" */
export const liveClock = (secs: number): string => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
