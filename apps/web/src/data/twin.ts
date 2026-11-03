import {
  applyTwinAdjust, fromTwinDecisionRow, sampleTwinSignals, toTwinDecisionRow, twinChanges, twinTargetWeek, DEMO_TWIN_STORE_CLIENT,
  type ApexStore, type TwinAdjustKind, type TwinDecision, type TwinDecisionRow, type TwinDraft, type TwinSignals, type TwinVoice,
} from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";
import type { LiveClient } from "./coach";
import { createSupabaseStore, type LiveStore } from "./supabaseStore";

/** APEX Twin for the coach: the signals behind each draft, the coach's voice, and what they decided. */
export interface TwinApi {
  live: boolean;
  signals(now: Date): Promise<TwinSignals[]>;
  voice(): Promise<TwinVoice>;
  saveVoice(v: TwinVoice): Promise<void>;
  decisions(sinceWeek: string): Promise<TwinDecision[]>;
  /** The exact program changes the adjustment would make. */
  preview(clientId: string, kind: TwinAdjustKind): Promise<string[]>;
  /** Approve: change the program, send the message, record the decision. */
  approve(draft: TwinDraft, message: string | null, decision: TwinDecision): Promise<void>;
  reject(decision: TwinDecision): Promise<void>;
}

const isMissing = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";
export const TWIN_NEEDS_UPDATE = "needs-update";
const err = (e: { code?: string; message: string }) => (isMissing(e) ? new Error(TWIN_NEEDS_UPDATE) : new Error(e.message));
const DAY = 86400000;

/** Opens a client's program just long enough to change it. */
async function withClientStore<T>(db: SupabaseClient, ids: { coachId: string; clientId: string }, fn: (s: LiveStore) => Promise<T>): Promise<T> {
  const store = createSupabaseStore(db, { coachId: ids.coachId, clientId: ids.clientId, me: ids.coachId });
  try {
    await new Promise<void>((resolve, reject) => {
      const check = () => {
        const st = store.status();
        if (st === "ready" || st === "no-program") { unsub(); resolve(); }
        if (st === "error") { unsub(); reject(new Error(store.error() ?? "Couldn't load the program")); }
      };
      const unsub = store.subscribe(check);
      check();
    });
    return await fn(store);
  } finally {
    store.close();
  }
}

const programChange = (store: ApexStore, kind: TwinAdjustKind) => {
  const { program, workout, activeDay } = store.get();
  const week = twinTargetWeek(program, workout.week);
  return { before: program, after: applyTwinAdjust(program, week, kind), week, activeDay };
};

export function liveTwin(db: SupabaseClient, coachId: string, clients: () => LiveClient[]): TwinApi {
  return {
    live: true,
    async signals(now) {
      const list = clients();
      const ids = list.map((c) => c.id);
      if (!ids.length) return [];
      const since28 = new Date(now.getTime() - 28 * DAY).toISOString();
      const since21 = new Date(now.getTime() - 21 * DAY).toISOString();
      const [sessions, checkIns, messages, programs] = await Promise.all([
        db.from("sessions").select("client_id, finished_at, session_rpe, note").in("client_id", ids).gte("finished_at", since28).not("finished_at", "is", null).limit(2000),
        db.from("check_ins").select("client_id, submitted_at, energy, mood, stress, sleep_hours, note, wins, struggles").in("client_id", ids).gte("submitted_at", since21).limit(1000),
        db.from("messages").select("client_id, sender_id, body, created_at").eq("coach_id", coachId).in("client_id", ids).gte("created_at", since21).limit(3000),
        db.from("programs").select("id, client_id, weeks, current_version").in("client_id", ids).eq("coach_id", coachId),
      ]);
      for (const r of [sessions, checkIns, messages, programs]) if (r.error) throw err(r.error);
      // Training days a week: workouts in each client's current version, spread over its weeks.
      const versions = (programs.data ?? []).map((p) => p.current_version as string | null).filter((v): v is string => !!v);
      const perVersion = new Map<string, number>();
      if (versions.length) {
        const { data, error } = await db.from("workouts").select("program_version_id").in("program_version_id", versions).limit(5000);
        if (error) throw err(error);
        for (const w of data ?? []) perVersion.set(w.program_version_id as string, (perVersion.get(w.program_version_id as string) ?? 0) + 1);
      }
      const latestProgram = new Map<string, { weeks: number; version: string | null }>();
      for (const p of programs.data ?? []) latestProgram.set(p.client_id as string, { weeks: Number(p.weeks) || 1, version: p.current_version as string | null });
      return list.map((c): TwinSignals => {
        const prog = latestProgram.get(c.id);
        const days = prog?.version ? perVersion.get(prog.version) ?? 0 : 0;
        return {
          clientId: c.id,
          name: c.name,
          startedAt: c.startedAt,
          plannedPerWeek: days ? Math.max(1, Math.round(days / prog!.weeks)) : 0,
          sessions: (sessions.data ?? []).filter((s) => s.client_id === c.id).map((s) => ({ finishedAt: s.finished_at as string, rpe: s.session_rpe === null ? null : Number(s.session_rpe), note: (s.note as string | null) ?? "" })),
          checkIns: (checkIns.data ?? []).filter((x) => x.client_id === c.id).map((x) => ({
            at: x.submitted_at as string, energy: x.energy as number | null, mood: x.mood as number | null, stress: x.stress as number | null,
            sleepHours: x.sleep_hours === null ? null : Number(x.sleep_hours), text: [x.note, x.struggles, x.wins].filter(Boolean).join(". "),
          })),
          clientMessages: (messages.data ?? []).filter((m) => m.client_id === c.id && m.sender_id === c.id).map((m) => ({ at: m.created_at as string, text: m.body as string })),
        };
      });
    },
    async voice() {
      const { data, error } = await db.from("twin_voice").select("sign_off, phrases").eq("coach_id", coachId).maybeSingle();
      if (error) throw err(error);
      return { signOff: (data?.sign_off as string | undefined) ?? "", phrases: (data?.phrases as TwinVoice["phrases"] | undefined) ?? {} };
    },
    async saveVoice(v) {
      const { error } = await db.from("twin_voice").upsert({ coach_id: coachId, sign_off: v.signOff.trim().slice(0, 60), phrases: v.phrases, updated_at: new Date().toISOString() });
      if (error) throw err(error);
    },
    async decisions(sinceWeek) {
      const { data, error } = await db.from("twin_decisions").select("*").eq("coach_id", coachId).gte("week_of", sinceWeek).returns<TwinDecisionRow[]>();
      if (error) throw err(error);
      return (data ?? []).map(fromTwinDecisionRow);
    },
    async preview(clientId, kind) {
      if (kind === "none" || kind === "hold") return [];
      return withClientStore(db, { coachId, clientId }, async (store) => {
        if (store.status() === "no-program") return [];
        const c = programChange(store, kind);
        return twinChanges(c.before, c.after, c.week);
      });
    },
    async approve(draft, message, decision) {
      // Record first: the unique week key stops a double tap from sending twice.
      const { error: e0 } = await db.from("twin_decisions").insert(toTwinDecisionRow(decision, coachId));
      if (e0) throw err(e0);
      if (draft.adjust !== "none" && draft.adjust !== "hold") {
        await withClientStore(db, { coachId, clientId: draft.clientId }, async (store) => {
          if (store.status() === "no-program") return;
          const c = programChange(store, draft.adjust);
          store.saveProgram(c.after, c.activeDay);
          await store.flush();
          const failed = store.error();
          if (failed) throw new Error(`Program not changed: ${failed}`);
        });
      }
      if (message?.trim()) {
        const { error } = await db.from("messages").insert({ coach_id: coachId, client_id: draft.clientId, sender_id: coachId, body: message.trim(), ai_drafted: true });
        if (error) throw err(error);
      }
    },
    async reject(decision) {
      const { error } = await db.from("twin_decisions").insert(toTwinDecisionRow(decision, coachId));
      if (error) throw err(error);
    },
  };
}

const KEY = "apex-twin-v1";

/** Demo: sample clients; Priya's approvals change the demo program and chat like the live app. */
export function demoTwin(store: () => ApexStore): TwinApi {
  const read = (): { voice: TwinVoice; decisions: TwinDecision[] } => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as { voice: TwinVoice; decisions: TwinDecision[] };
    } catch { /* fresh */ }
    return { voice: { signOff: "Kamal", phrases: {} }, decisions: [] };
  };
  const write = (v: { voice: TwinVoice; decisions: TwinDecision[] }) => {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* this visit only */ }
  };
  const record = (d: TwinDecision) => {
    const all = read();
    if (all.decisions.some((x) => x.clientId === d.clientId && x.weekOf === d.weekOf)) throw new Error("Already decided this week");
    write({ ...all, decisions: [...all.decisions, d] });
  };
  return {
    live: false,
    async signals(now) {
      return sampleTwinSignals(now);
    },
    async voice() {
      return read().voice;
    },
    async saveVoice(voice) {
      write({ ...read(), voice });
    },
    async decisions(sinceWeek) {
      return read().decisions.filter((d) => d.weekOf >= sinceWeek);
    },
    async preview(clientId, kind) {
      if (clientId !== DEMO_TWIN_STORE_CLIENT) return kind === "none" || kind === "hold" ? [] : ["Sample client: in the demo only Priya's program changes"];
      const c = programChange(store(), kind);
      return twinChanges(c.before, c.after, c.week);
    },
    async approve(draft, message, decision) {
      record(decision);
      if (draft.clientId !== DEMO_TWIN_STORE_CLIENT) return;
      const s = store();
      if (draft.adjust !== "none" && draft.adjust !== "hold") {
        const c = programChange(s, draft.adjust);
        s.saveProgram(c.after, c.activeDay);
      }
      if (message?.trim()) s.sendMessage("coach", message.trim());
    },
    async reject(decision) {
      record(decision);
    },
  };
}

const TwinContext = createContext<TwinApi | null>(null);
export const TwinProvider = TwinContext.Provider;
export const useTwinApi = (): TwinApi | null => useContext(TwinContext);
