import { addDays, draftProblem, fromTeamFeedRow, localDate, mondayOf, sampleTeam, type EffortLine, type TeamDraft, type TeamFeedRow, type TeamPost } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

/** The team feed for whoever is signed in. Clients join, post and high-five; the coach posts notes and can remove any post. */
export interface TeamApi {
  live: boolean;
  side: "coach" | "client";
  /** Client: in the team. The coach is always in. */
  joined(): Promise<boolean>;
  join(): Promise<void>;
  leave(): Promise<void>;
  feed(): Promise<TeamPost[]>;
  effort(): Promise<EffortLine[]>;
  post(d: TeamDraft): Promise<void>;
  remove(id: string): Promise<void>;
  five(id: string, on: boolean): Promise<void>;
}

const isMissing = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205" || e?.code === "PGRST202";
export const TEAM_NEEDS_UPDATE = "needs-update";
const err = (e: { code?: string; message: string }) => (isMissing(e) ? new Error(TEAM_NEEDS_UPDATE) : new Error(e.message));

export function liveTeam(db: SupabaseClient, who: { side: "coach" | "client"; coachId: string; me: string }): TeamApi {
  return {
    live: true,
    side: who.side,
    async joined() {
      if (who.side === "coach") return true;
      const { data, error } = await db.from("team_members").select("client_id").eq("coach_id", who.coachId).eq("client_id", who.me).maybeSingle();
      if (error) throw err(error);
      return !!data;
    },
    async join() {
      const { error } = await db.from("team_members").upsert({ coach_id: who.coachId, client_id: who.me });
      if (error) throw err(error);
    },
    async leave() {
      const { error } = await db.from("team_members").delete().eq("coach_id", who.coachId).eq("client_id", who.me);
      if (error) throw err(error);
    },
    async feed() {
      const { data, error } = await db.rpc("team_feed", { p_coach: who.coachId, p_limit: 50 });
      if (error) throw err(error);
      return ((data ?? []) as TeamFeedRow[]).map(fromTeamFeedRow);
    },
    async effort() {
      const { data, error } = await db.rpc("team_effort", { p_coach: who.coachId, p_since: mondayOf(localDate(new Date())) });
      if (error) throw err(error);
      return ((data ?? []) as { name: string; workouts: number; minutes: number; is_me: boolean }[]).map((r) => ({ name: r.name, workouts: Number(r.workouts), minutes: Number(r.minutes), isMe: r.is_me }));
    },
    async post(d) {
      const problem = draftProblem(d);
      if (problem) throw new Error(problem);
      const { error } = await db.from("team_posts").insert({ coach_id: who.coachId, author_id: who.me, kind: d.kind, title: d.title.trim(), detail: d.detail?.trim() || null });
      if (error) throw err(error);
    },
    async remove(id) {
      const { error } = await db.from("team_posts").delete().eq("id", id);
      if (error) throw err(error);
    },
    async five(id, on) {
      const { error } = on
        ? await db.from("team_high_fives").upsert({ post_id: id, user_id: who.me })
        : await db.from("team_high_fives").delete().eq("post_id", id).eq("user_id", who.me);
      if (error) throw err(error);
    },
  };
}

const KEY = "apex-team-v1";
interface DemoState { joined: boolean; posts: TeamPost[]; effort: EffortLine[] }

/** Demo: a sample team in localStorage, shared by the coach and client tabs. Priya is the client. */
export function demoTeam(side: "coach" | "client"): TeamApi {
  const read = (): DemoState => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as DemoState;
    } catch { /* sample */ }
    return { joined: false, ...sampleTeam() };
  };
  const write = (s: DemoState) => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* this visit only */ }
  };
  const update = (fn: (s: DemoState) => DemoState) => write(fn(read()));
  // In the coach tab, Priya's posts aren't "mine" and the coach's are.
  const view = (p: TeamPost): TeamPost => (side === "coach" ? { ...p, isMe: p.isCoach } : p);
  return {
    live: false,
    side,
    async joined() { return side === "coach" || read().joined; },
    async join() { update((s) => ({ ...s, joined: true })); },
    async leave() { update((s) => ({ ...s, joined: false })); },
    async feed() {
      const s = read();
      return side === "client" && !s.joined ? [] : s.posts.map(view);
    },
    async effort() {
      const s = read();
      return s.joined ? s.effort : s.effort.filter((l) => !l.isMe);
    },
    async post(d) {
      const problem = draftProblem(d);
      if (problem) throw new Error(problem);
      const mine: TeamPost = {
        id: `t-${Date.now()}`, kind: d.kind, title: d.title.trim(), detail: d.detail?.trim() || null, at: new Date().toISOString(),
        author: side === "coach" ? "Kamal" : "Priya S.", isCoach: side === "coach", isMe: side === "client", fives: 0, iFived: false,
      };
      update((s) => ({ ...s, posts: [mine, ...s.posts].slice(0, 50) }));
    },
    async remove(id) { update((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== id) })); },
    async five(id, on) {
      update((s) => ({ ...s, posts: s.posts.map((p) => (p.id === id && p.iFived !== on ? { ...p, iFived: on, fives: Math.max(0, p.fives + (on ? 1 : -1)) } : p)) }));
    },
  };
}

/** Demo sample week starts on a Monday; kept so the effort board says which week it is. */
export const effortWeekLabel = (): string => {
  const m = mondayOf(localDate(new Date()));
  const d = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${d(m)} – ${d(addDays(m, 6))}`;
};

const Ctx = createContext<TeamApi | null>(null);
export const TeamProvider = Ctx.Provider;
export const useTeamApi = (): TeamApi | null => useContext(Ctx);
