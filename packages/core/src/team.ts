import { distanceText, type CardioWeek } from "./story";
import type { Milestone } from "./levels";
import { heroForWorkout, type HeroImage } from "./hero";

/* Team: a private feed for one coach and the clients who join it. Clients choose what to post (a workout, a milestone,
   their week's distance); everyone can give a high five. Never body numbers or photos. The effort board ranks effort
   only. Mirrors supabase/migrations/20261109090000_team.sql. Pure, so it is unit tested. */

export type TeamPostKind = "workout" | "milestone" | "distance" | "streak" | "level" | "note";

export interface TeamPost {
  id: string;
  kind: TeamPostKind;
  title: string;
  detail: string | null;
  /** ISO time. */
  at: string;
  /** "Priya S." */
  author: string;
  isCoach: boolean;
  isMe: boolean;
  fives: number;
  iFived: boolean;
}

/** What a client is about to post: they see it before it goes. */
export interface TeamDraft {
  kind: TeamPostKind;
  title: string;
  detail: string | null;
}

export interface EffortLine {
  name: string;
  workouts: number;
  minutes: number;
  isMe: boolean;
}

export const TEAM_TITLE_MAX = 80;
export const TEAM_DETAIL_MAX = 160;

export function draftProblem(d: TeamDraft): string | null {
  const t = d.title.trim();
  if (!t) return "Write something first.";
  if (t.length > TEAM_TITLE_MAX) return `Keep it under ${TEAM_TITLE_MAX} characters.`;
  if (d.detail && d.detail.length > TEAM_DETAIL_MAX) return `Keep the detail under ${TEAM_DETAIL_MAX} characters.`;
  return null;
}

/** A finished workout: name, sets and personal bests. No weights. */
export function workoutDraft(w: { workoutName: string; sets: number; minutes: number; prs: number }): TeamDraft {
  const bits = [`${w.sets} sets`, `${w.minutes} min`, w.prs ? `${w.prs} personal best${w.prs === 1 ? "" : "s"}` : ""].filter(Boolean);
  return { kind: "workout", title: `Finished ${w.workoutName}`.slice(0, TEAM_TITLE_MAX), detail: bits.join(" · ") };
}

export function milestoneDraft(m: Pick<Milestone, "title" | "sub">): TeamDraft {
  return { kind: "milestone", title: `Reached ${m.title}`.slice(0, TEAM_TITLE_MAX), detail: m.sub.slice(0, TEAM_DETAIL_MAX) };
}

export function distanceDraft(rows: CardioWeek[], label: string): TeamDraft | null {
  if (!rows.length) return null;
  const top = rows[0]!;
  const others = rows.slice(1, 3).map((r) => `${r.label.toLowerCase()} ${distanceText(r.metres, r.sport)}`);
  return {
    kind: "distance",
    title: `${distanceText(top.metres, top.sport)} ${top.label.toLowerCase()} this week`,
    detail: [label, ...others].join(" · ").slice(0, TEAM_DETAIL_MAX),
  };
}

export function levelDraft(level: number, name: string): TeamDraft {
  return { kind: "level", title: `Up to level ${level}: ${name}`.slice(0, TEAM_TITLE_MAX), detail: null };
}

/** "Priya S." from "Priya Sharma", as the team sees names. Mirrors public.team_name(). */
export function teamName(full: string | null | undefined): string {
  const t = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!t.length) return "Someone";
  if (t.length === 1) return t[0]!;
  return `${t[0]} ${t[t.length - 1]![0]!.toUpperCase()}.`;
}

/** "Just now", "12 min", "3 h", "Yesterday", "4 Nov". */
export function agoText(iso: string, now = new Date()): string {
  const ms = now.getTime() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 60_000) return "Just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  if (h < 48) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Effort first by workouts, then minutes; ties share a place. */
export function rankEffort(lines: EffortLine[]): (EffortLine & { place: number })[] {
  const sorted = [...lines].sort((a, b) => b.workouts - a.workouts || b.minutes - a.minutes || a.name.localeCompare(b.name));
  let place = 0;
  return sorted.map((l, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.workouts !== l.workouts || prev.minutes !== l.minutes) place = i + 1;
    return { ...l, place };
  });
}

/** Gives or takes back my high five, as the screen shows it before the server answers. */
export function toggleFive(posts: TeamPost[], id: string): TeamPost[] {
  return posts.map((p) => (p.id === id ? { ...p, iFived: !p.iFived, fives: Math.max(0, p.fives + (p.iFived ? -1 : 1)) } : p));
}

/* ---------- How a post is drawn ---------- */

/** The studio photo behind a workout or distance post; null for posts drawn as a big number or a note. */
export function heroForPost(p: Pick<TeamPost, "kind" | "title">): HeroImage | null {
  const t = p.title.toLowerCase();
  if (p.kind === "workout") {
    const name = t.replace(/^finished\s+/, "");
    const hero = heroForWorkout({ name, items: [] });
    if (hero !== "dumbbell") return hero;
    if (/upper|push|pull|chest|back|arms|shoulder/.test(name)) return "upper";
    if (/lower|legs?\b|glute/.test(name)) return "lower";
    return "dumbbell";
  }
  if (p.kind === "distance") return /\bswim/.test(t) ? "swim" : /\bride|\bcycl/.test(t) ? "ride" : /\brow/.test(t) ? "ski" : "run";
  return null;
}

/** The big number a milestone, distance, streak or level post leads with: "Reached 25 workouts" → 25 workouts. */
export function postFigure(p: Pick<TeamPost, "kind" | "title">): { value: string; unit: string } | null {
  if (p.kind === "level") {
    const m = /level\s+(\d+)(?::\s*(.+))?/i.exec(p.title);
    return m ? { value: m[1]!, unit: m[2]?.trim() || "Level" } : null;
  }
  if (p.kind === "workout" || p.kind === "note") return null;
  const m = /(\d[\d,]*(?:\.\d+)?)\s*(.*)$/.exec(p.title);
  if (!m) return null;
  const unit = m[2]!.replace(/\s*this week$/i, "").trim();
  return { value: m[1]!, unit: unit || p.title };
}

/* ---------- Rows ---------- */

export interface TeamFeedRow {
  id: string;
  kind: TeamPostKind;
  title: string;
  detail: string | null;
  created_at: string;
  author: string;
  is_coach: boolean;
  is_me: boolean;
  fives: number;
  i_fived: boolean;
}

export const fromTeamFeedRow = (r: TeamFeedRow): TeamPost => ({
  id: r.id, kind: r.kind, title: r.title, detail: r.detail, at: r.created_at, author: r.author,
  isCoach: r.is_coach, isMe: r.is_me, fives: Number(r.fives) || 0, iFived: !!r.i_fived,
});

/* ---------- Sample ---------- */

/** A believable small team for the demo. "Priya S." is the client in the demo. */
export function sampleTeam(now = new Date()): { posts: TeamPost[]; effort: EffortLine[] } {
  const ago = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
  const post = (id: string, kind: TeamPostKind, author: string, title: string, detail: string | null, h: number, fives: number, extra: Partial<TeamPost> = {}): TeamPost =>
    ({ id, kind, title, detail, at: ago(h), author, isCoach: false, isMe: false, fives, iFived: false, ...extra });
  return {
    posts: [
      post("t1", "milestone", "Sam O.", "Reached 25 workouts", "Every one of them logged.", 1.5, 4),
      post("t2", "distance", "Lena M.", "21.4 km run this week", "27 Oct – 2 Nov · swim 1,800 m", 5, 6, { iFived: true }),
      post("t3", "note", "Kamal", "Big week, team. Three of you hit new bests on the squat. Rest well this weekend.", null, 9, 7, { isCoach: true }),
      post("t4", "workout", "Josh T.", "Finished Upper B", "20 sets · 55 min · 1 personal best", 22, 3),
      post("t5", "level", "Amira K.", "Up to level 4: Committed", null, 30, 5),
      post("t6", "workout", "Priya S.", "Finished Lower A", "18 sets · 52 min · 2 personal bests", 48, 5, { isMe: true }),
    ],
    effort: [
      { name: "Lena M.", workouts: 4, minutes: 312, isMe: false },
      { name: "Priya S.", workouts: 4, minutes: 268, isMe: true },
      { name: "Sam O.", workouts: 3, minutes: 190, isMe: false },
      { name: "Josh T.", workouts: 3, minutes: 175, isMe: false },
      { name: "Amira K.", workouts: 2, minutes: 140, isMe: false },
    ],
  };
}
