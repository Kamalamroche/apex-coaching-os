import { byNeed, clientHealth, healthTrend, sampleHealth, CLIENTS, type HealthInput, type RosterRow } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { LiveClient } from "./coach";

const DAY = 864e5;
/** Long enough for this week's score and last week's, for the trend. */
const LOOKBACK_DAYS = 35;

export interface HealthClient { id: string; name: string }

type Rows<T> = { data: T[] | null; error: { code?: string; message: string } | null };
const isMissing = (e: { code?: string } | null) => ["42P01", "PGRST205", "42703", "PGRST204"].includes(e?.code ?? "");
/** A part with a missing table (SQL not run yet) is just empty; anything else is a real error. */
function rows<T>(r: Rows<T>): T[] {
  if (r.error && isMissing(r.error)) return [];
  if (r.error) throw r.error;
  return r.data ?? [];
}

/** Sessions a week in each client's current plan: workouts in the first week of the current version. */
async function plannedPerWeek(db: SupabaseClient, coachId: string, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const programs = rows(await db.from("programs").select("id, client_id, current_version, created_at").eq("coach_id", coachId).in("client_id", ids).order("created_at", { ascending: false }) as Rows<{ id: string; client_id: string; current_version: number }>);
  const latest = new Map<string, { id: string; current_version: number }>();
  for (const p of programs) if (!latest.has(p.client_id)) latest.set(p.client_id, p);
  if (!latest.size) return out;
  const versions = rows(await db.from("program_versions").select("id, program_id, version").in("program_id", [...latest.values()].map((p) => p.id)) as Rows<{ id: string; program_id: string; version: number }>);
  const versionFor = new Map<string, string>();
  for (const [client, p] of latest) {
    const v = versions.find((x) => x.program_id === p.id && x.version === p.current_version);
    if (v) versionFor.set(v.id, client);
  }
  if (!versionFor.size) return out;
  const workouts = rows(await db.from("workouts").select("program_version_id, week").in("program_version_id", [...versionFor.keys()]) as Rows<{ program_version_id: string; week: number }>);
  const byVersion = new Map<string, number[]>();
  for (const w of workouts) byVersion.set(w.program_version_id, [...(byVersion.get(w.program_version_id) ?? []), w.week]);
  for (const [version, weeks] of byVersion) {
    const first = Math.min(...weeks);
    out.set(versionFor.get(version)!, weeks.filter((w) => w === first).length);
  }
  return out;
}

/** Everything the health score needs for every client, in a handful of queries. */
export async function loadRosterHealth(db: SupabaseClient, coachId: string, clients: LiveClient[], now = new Date()): Promise<Record<string, HealthInput>> {
  const ids = clients.map((c) => c.id);
  if (!ids.length) return {};
  const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY).toISOString();
  const sinceDay = since.slice(0, 10);
  const [sessions, checkIns, habits, ticks, targets, food, messages, planned] = await Promise.all([
    db.from("sessions").select("client_id, finished_at").in("client_id", ids).gte("finished_at", since).limit(5000),
    db.from("check_ins").select("client_id, submitted_at").in("client_id", ids).gte("submitted_at", since).limit(2000),
    db.from("client_habits").select("client_id, days, created_at").in("client_id", ids),
    db.from("habit_ticks").select("client_id, day").in("client_id", ids).gte("day", sinceDay).limit(10000),
    db.from("nutrition_targets").select("client_id").in("client_id", ids),
    db.from("food_entries").select("client_id, day").in("client_id", ids).gte("day", sinceDay).limit(10000),
    db.from("messages").select("client_id, sender_id, created_at").eq("coach_id", coachId).in("client_id", ids).gte("created_at", since).limit(5000),
    plannedPerWeek(db, coachId, ids).catch(() => new Map<string, number>()),
  ]);
  const group = <T extends { client_id: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of list) m.set(r.client_id, [...(m.get(r.client_id) ?? []), r]);
    return m;
  };
  const s = group(rows(sessions as Rows<{ client_id: string; finished_at: string }>));
  const ci = group(rows(checkIns as Rows<{ client_id: string; submitted_at: string }>));
  const hb = group(rows(habits as Rows<{ client_id: string; days: number[]; created_at: string }>));
  const tk = group(rows(ticks as Rows<{ client_id: string; day: string }>));
  const tg = new Set(rows(targets as Rows<{ client_id: string }>).map((r) => r.client_id));
  const fd = group(rows(food as Rows<{ client_id: string; day: string }>));
  const ms = group(rows(messages as Rows<{ client_id: string; sender_id: string; created_at: string }>).filter((m) => m.sender_id === m.client_id));
  const out: Record<string, HealthInput> = {};
  for (const c of clients) {
    out[c.id] = {
      startedAt: c.startedAt,
      sessions: (s.get(c.id) ?? []).map((r) => r.finished_at),
      plannedPerWeek: planned.get(c.id) ?? null,
      checkIns: (ci.get(c.id) ?? []).map((r) => r.submitted_at),
      habits: (hb.get(c.id) ?? []).map((r) => ({ days: r.days, createdAt: r.created_at })),
      habitTicks: (tk.get(c.id) ?? []).map((r) => r.day),
      hasFoodTargets: tg.has(c.id),
      foodDays: [...new Set((fd.get(c.id) ?? []).map((r) => r.day))],
      clientMessages: (ms.get(c.id) ?? []).map((r) => r.created_at),
    };
  }
  return out;
}

export function scoreRoster<T extends HealthClient>(clients: T[], inputs: Record<string, HealthInput>, now = new Date()): RosterRow<T>[] {
  return byNeed(clients.filter((c) => inputs[c.id]).map((c) => ({ client: c, health: clientHealth(inputs[c.id]!, now), trend: healthTrend(inputs[c.id]!, now) })));
}

// One load shared by Brief and Clients, refreshed after a minute.
let cache: { key: string; at: number; data: Promise<Record<string, HealthInput>> } | null = null;

/** Health rows for the coach's live clients, most in need first. Null while loading. */
export function useRosterHealth(db: SupabaseClient | undefined, coachId: string | undefined, clients: LiveClient[] | null | undefined): RosterRow<LiveClient>[] | null {
  const [rowsState, setRows] = useState<RosterRow<LiveClient>[] | null>(null);
  const key = clients ? `${coachId}:${clients.map((c) => c.id).join(",")}` : "";
  useEffect(() => {
    if (!db || !coachId || !clients) return;
    let on = true;
    if (!cache || cache.key !== key || Date.now() - cache.at > 60_000) cache = { key, at: Date.now(), data: loadRosterHealth(db, coachId, clients) };
    const mine = cache;
    mine.data.then(
      (inputs) => { if (on) setRows(scoreRoster(clients, inputs)); },
      (e: unknown) => { console.error("Couldn't work out client health", e); if (cache === mine) cache = null; if (on) setRows([]); },
    );
    return () => { on = false; };
  }, [db, coachId, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return rowsState;
}

/** The demo's six sample clients, scored from their sample stories. */
export function demoRosterHealth(now = new Date()): RosterRow<(typeof CLIENTS)[number] & HealthClient>[] {
  const inputs = sampleHealth(now);
  const clients = CLIENTS.map((c) => ({ ...c, id: String(c.id) })) as unknown as ((typeof CLIENTS)[number] & HealthClient)[];
  return scoreRoster(clients, Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, v])), now);
}
