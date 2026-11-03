import { challengeProblem, fromChallengeRow, localDate, sampleChallenges, toChallengeRow, type BoardLine, type Challenge, type ChallengeLog, type ChallengeRow } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

/** Challenges for whoever is signed in. The coach creates them; clients join, log and see the board. */
export interface ChallengeApi {
  live: boolean;
  side: "coach" | "client";
  load(): Promise<{ challenges: Challenge[]; joined: string[]; logs: ChallengeLog[] }>;
  board(id: string): Promise<BoardLine[]>;
  /** Coach. */
  save(c: Challenge): Promise<void>;
  remove(id: string): Promise<void>;
  /** Client. */
  join(id: string): Promise<void>;
  leave(id: string): Promise<void>;
  log(id: string, day: string, value: number): Promise<void>;
}

const isMissing = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205" || e?.code === "PGRST202";
export const CHALLENGES_NEED_UPDATE = "needs-update";
const err = (e: { code?: string; message: string }) => (isMissing(e) ? new Error(CHALLENGES_NEED_UPDATE) : new Error(e.message));

export function liveChallenges(db: SupabaseClient, who: { side: "coach" | "client"; coachId: string; me: string }): ChallengeApi {
  return {
    live: true,
    side: who.side,
    async load() {
      const since = localDate(new Date(Date.now() - 30 * 86400000));
      const c = await db.from("challenges").select("*").eq("coach_id", who.coachId).gte("ends_on", since).order("starts_on", { ascending: false }).limit(20).returns<ChallengeRow[]>();
      if (c.error) throw err(c.error);
      const challenges = (c.data ?? []).map(fromChallengeRow);
      if (who.side === "coach" || !challenges.length) return { challenges, joined: [], logs: [] };
      const ids = challenges.map((x) => x.id);
      const [m, l] = await Promise.all([
        db.from("challenge_members").select("challenge_id").eq("client_id", who.me).in("challenge_id", ids),
        db.from("challenge_logs").select("challenge_id, day, value").eq("client_id", who.me).in("challenge_id", ids),
      ]);
      const e = m.error ?? l.error;
      if (e) throw err(e);
      return {
        challenges,
        joined: (m.data ?? []).map((r) => r.challenge_id as string),
        logs: (l.data ?? []).map((r) => ({ challengeId: r.challenge_id as string, day: r.day as string, value: Number(r.value) })),
      };
    },
    async board(id) {
      const { data, error } = await db.rpc("challenge_board", { p_challenge: id });
      if (error) throw err(error);
      return ((data ?? []) as { name: string; total: number; is_me: boolean }[]).map((r) => ({ name: r.name, total: Number(r.total), isMe: r.is_me }));
    },
    async save(c) {
      const problem = challengeProblem(c);
      if (problem) throw new Error(problem);
      const { error } = await db.from("challenges").upsert(toChallengeRow(c, who.coachId));
      if (error) throw err(error);
    },
    async remove(id) {
      const { error } = await db.from("challenges").delete().eq("id", id);
      if (error) throw err(error);
    },
    async join(id) {
      const { error } = await db.from("challenge_members").upsert({ challenge_id: id, client_id: who.me });
      if (error) throw err(error);
    },
    async leave(id) {
      const { error } = await db.from("challenge_members").delete().eq("challenge_id", id).eq("client_id", who.me);
      if (error) throw err(error);
    },
    async log(id, day, value) {
      const { error } = await db.from("challenge_logs").upsert({ challenge_id: id, client_id: who.me, day, value });
      if (error) throw err(error);
    },
  };
}

const KEY = "apex-challenges-v1";
interface DemoState { challenges: Challenge[]; boards: Record<string, BoardLine[]>; joined: string[]; logs: ChallengeLog[] }

/** Demo: sample challenges and boards in localStorage, shared by the coach and client tabs. Priya is "me". */
export function demoChallenges(side: "coach" | "client"): ChallengeApi {
  const read = (): DemoState => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as DemoState;
    } catch { /* sample */ }
    return { ...sampleChallenges(localDate(new Date())), joined: ["demo-challenge-1"], logs: [] };
  };
  const write = (s: DemoState) => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* this visit only */ }
  };
  const update = (fn: (s: DemoState) => DemoState) => write(fn(read()));
  const withMe = (s: DemoState, id: string): BoardLine[] => {
    const c = s.challenges.find((x) => x.id === id);
    const others = (s.boards[id] ?? []).filter((l) => !l.isMe);
    if (!s.joined.includes(id) || !c) return others;
    const mine = (s.boards[id] ?? []).find((l) => l.isMe)?.total ?? 0;
    const logged = s.logs.filter((l) => l.challengeId === id).reduce((t, l) => t + l.value, 0);
    return [...others, { name: "Priya S.", total: c.metric === "sessions" ? mine : logged, isMe: side === "client" }];
  };
  return {
    live: false,
    side,
    async load() {
      const s = read();
      return { challenges: s.challenges, joined: s.joined, logs: s.logs };
    },
    async board(id) {
      return withMe(read(), id);
    },
    async save(c) {
      const problem = challengeProblem(c);
      if (problem) throw new Error(problem);
      update((s) => ({ ...s, challenges: s.challenges.some((x) => x.id === c.id) ? s.challenges.map((x) => (x.id === c.id ? c : x)) : [c, ...s.challenges] }));
    },
    async remove(id) {
      update((s) => ({ ...s, challenges: s.challenges.filter((x) => x.id !== id) }));
    },
    async join(id) {
      update((s) => ({ ...s, joined: [...new Set([...s.joined, id])] }));
    },
    async leave(id) {
      update((s) => ({ ...s, joined: s.joined.filter((x) => x !== id) }));
    },
    async log(id, day, value) {
      update((s) => ({ ...s, logs: [...s.logs.filter((l) => !(l.challengeId === id && l.day === day)), { challengeId: id, day, value }] }));
    },
  };
}

const Ctx = createContext<ChallengeApi | null>(null);
export const ChallengeProvider = Ctx.Provider;
export const useChallengeApi = (): ChallengeApi | null => useContext(Ctx);
