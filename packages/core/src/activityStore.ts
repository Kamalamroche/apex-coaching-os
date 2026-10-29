/* A client's cardio and connected apps, behind one interface like ApexStore:
   the demo keeps it in localStorage, the live app in the `activities` and `device_connections`
   tables (apps/web/src/data/supabaseActivities.ts). */

import { mergeActivities, type Activity, type ActivitySource, type Sport } from "./activity";
import { sampleActivities } from "./data/activities";
import { sampleRecovery } from "./data/recovery";
import { mergeRecovery, type RecoveryDay, type RecoverySource } from "./recovery";

export type Provider = "strava" | Exclude<RecoverySource, "manual">;

export interface Connection {
  provider: Provider;
  /** The name on the client's account there. */
  athleteName?: string;
  connectedAt: string;
  lastSyncAt?: string;
}

export interface ActivityState {
  /** Newest first. */
  activities: Activity[];
  connections: Connection[];
  /** Sleep, HRV, resting heart rate and the rest, one per morning per source, newest first. */
  recovery: RecoveryDay[];
  /** "needs-update": the database doesn't have the cardio tables yet (the SQL hasn't run). */
  status: "loading" | "ready" | "needs-update" | "error";
  error?: string;
}

export interface ActivityStore {
  get(): ActivityState;
  subscribe(listener: () => void): () => void;
  /** Adds or replaces activities. One already brought in from the same source is updated, not doubled. */
  save(list: Activity[]): void;
  remove(id: string): void;
  /** Adds or updates mornings. Same date and source replaces. */
  saveRecovery(days: RecoveryDay[]): void;
  /** Records a connection (or a fresh sync) once the provider has said yes. */
  setConnection(c: Connection): void;
  removeConnection(p: Provider): void;
}

/* ---------- Database rows (supabase/migrations/20261029090000_activities.sql) ---------- */

export interface ActivityRow {
  id: string;
  client_id: string;
  sport: Sport;
  name: string;
  started_at: string;
  distance_m: number;
  moving_seconds: number;
  elapsed_seconds: number;
  elevation_gain_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  rpe: number | null;
  note: string | null;
  source: ActivitySource;
  external_id: string | null;
  detail: Activity["detail"] | null;
}

export interface RecoveryRow {
  client_id: string;
  day: string;
  source: RecoverySource;
  sleep_minutes: number | null;
  deep_minutes: number | null;
  rem_minutes: number | null;
  light_minutes: number | null;
  awake_minutes: number | null;
  sleep_score: number | null;
  hrv_ms: number | null;
  resting_hr: number | null;
  recovery_score: number | null;
  stress: number | null;
  strain: number | null;
  steps: number | null;
  respiratory_rate: number | null;
  bed_start: string | null;
  bed_end: string | null;
  hypnogram: string | null;
}

export function toRecoveryRow(d: RecoveryDay, clientId: string): RecoveryRow {
  return {
    client_id: clientId, day: d.date, source: d.source, sleep_minutes: d.sleepMinutes ?? null,
    deep_minutes: d.stages?.deep ?? null, rem_minutes: d.stages?.rem ?? null, light_minutes: d.stages?.light ?? null, awake_minutes: d.stages?.awake ?? null,
    sleep_score: d.sleepScore ?? null, hrv_ms: d.hrvMs ?? null, resting_hr: d.restingHr ?? null, recovery_score: d.recoveryScore ?? null,
    stress: d.stress ?? null, strain: d.strain ?? null, steps: d.steps ?? null, respiratory_rate: d.respiratoryRate ?? null,
    bed_start: d.bedtime ?? null, bed_end: d.wakeTime ?? null, hypnogram: d.hypnogram?.slice(0, 288) ?? null,
  };
}

export function fromRecoveryRow(r: RecoveryRow): RecoveryDay {
  const n = (v: number | string | null) => (v === null ? undefined : Number(v));
  const d: RecoveryDay = {
    date: r.day.slice(0, 10), source: r.source, sleepMinutes: n(r.sleep_minutes), sleepScore: n(r.sleep_score), hrvMs: n(r.hrv_ms), restingHr: n(r.resting_hr),
    recoveryScore: n(r.recovery_score), stress: n(r.stress), strain: n(r.strain), steps: n(r.steps), respiratoryRate: n(r.respiratory_rate),
    bedtime: r.bed_start ?? undefined, wakeTime: r.bed_end ?? undefined, hypnogram: r.hypnogram ?? undefined,
    ...(r.deep_minutes !== null ? { stages: { deep: Number(r.deep_minutes), rem: Number(r.rem_minutes ?? 0), light: Number(r.light_minutes ?? 0), awake: Number(r.awake_minutes ?? 0) } } : {}),
  };
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) as unknown as RecoveryDay;
}

export interface ConnectionRow {
  provider: Provider;
  athlete_name: string | null;
  connected_at: string;
  last_sync_at: string | null;
}

export function toActivityRow(a: Activity, clientId: string): ActivityRow {
  return {
    id: a.id, client_id: clientId, sport: a.sport, name: a.name.slice(0, 120), started_at: a.startedAt,
    distance_m: a.metres, moving_seconds: a.movingSeconds, elapsed_seconds: a.elapsedSeconds,
    elevation_gain_m: a.elevationGainM ?? null, avg_hr: a.avgHr ?? null, max_hr: a.maxHr ?? null, calories: a.calories ?? null,
    rpe: a.rpe ?? null, note: a.note ?? null, source: a.source, external_id: a.externalId ?? null, detail: a.detail ?? null,
  };
}

export function fromActivityRow(r: ActivityRow): Activity {
  const n = (v: number | string | null) => (v === null ? undefined : Number(v));
  return {
    id: r.id, sport: r.sport, name: r.name, startedAt: new Date(r.started_at).toISOString(),
    metres: Number(r.distance_m), movingSeconds: r.moving_seconds, elapsedSeconds: r.elapsed_seconds,
    ...(r.elevation_gain_m !== null ? { elevationGainM: n(r.elevation_gain_m) } : {}),
    ...(r.avg_hr !== null ? { avgHr: r.avg_hr } : {}),
    ...(r.max_hr !== null ? { maxHr: r.max_hr } : {}),
    ...(r.calories !== null ? { calories: r.calories } : {}),
    ...(r.rpe !== null ? { rpe: n(r.rpe) } : {}),
    ...(r.note ? { note: r.note } : {}),
    source: r.source,
    ...(r.external_id ? { externalId: r.external_id } : {}),
    ...(r.detail ? { detail: r.detail } : {}),
  };
}

export const fromConnectionRow = (r: ConnectionRow): Connection => ({
  provider: r.provider, connectedAt: r.connected_at,
  ...(r.athlete_name ? { athleteName: r.athlete_name } : {}),
  ...(r.last_sync_at ? { lastSyncAt: r.last_sync_at } : {}),
});

/* ---------- Demo ---------- */

export const DEMO_ACTIVITY_KEY = "apex-activities-v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function createDemoActivityStore(storage: StorageLike | null = safeStorage(), now = new Date()): ActivityStore {
  // The demo ring is "connected" from the start so the recovery screens have data.
  const demoRing: Connection = { provider: "oura", athleteName: "Priya Sharma (demo)", connectedAt: now.toISOString(), lastSyncAt: now.toISOString() };
  let state: ActivityState = { activities: [], connections: [], recovery: [], status: "ready" };
  try {
    const raw = storage?.getItem(DEMO_ACTIVITY_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<ActivityState>) : null;
    state = { ...state, activities: saved?.activities ?? sampleActivities(now), connections: saved?.connections ?? [demoRing], recovery: saved?.recovery ?? sampleRecovery(now) };
  } catch {
    state = { ...state, activities: sampleActivities(now), connections: [demoRing], recovery: sampleRecovery(now) };
  }
  const listeners = new Set<() => void>();
  const update = (fn: (s: ActivityState) => ActivityState) => {
    state = fn(state);
    try {
      storage?.setItem(DEMO_ACTIVITY_KEY, JSON.stringify({ activities: state.activities, connections: state.connections, recovery: state.recovery }));
    } catch {
      /* storage full or blocked: the change still shows in this tab */
    }
    listeners.forEach((l) => l());
  };
  return {
    get: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    save: (list) => update((s) => ({ ...s, activities: mergeActivities(s.activities, list) })),
    remove: (id) => update((s) => ({ ...s, activities: s.activities.filter((a) => a.id !== id) })),
    saveRecovery: (days) => update((s) => ({ ...s, recovery: mergeRecovery(s.recovery, days) })),
    setConnection: (c) => update((s) => ({ ...s, connections: [...s.connections.filter((x) => x.provider !== c.provider), c] })),
    removeConnection: (p) => update((s) => ({ ...s, connections: s.connections.filter((x) => x.provider !== p) })),
  };
}

function safeStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
