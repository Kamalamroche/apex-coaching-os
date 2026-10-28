/* A client's cardio and connected apps, behind one interface like ApexStore:
   the demo keeps it in localStorage, the live app in the `activities` and `device_connections`
   tables (apps/web/src/data/supabaseActivities.ts). */

import { mergeActivities, type Activity, type ActivitySource, type Sport } from "./activity";
import { sampleActivities } from "./data/activities";

export type Provider = "strava";

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
  let state: ActivityState = { activities: [], connections: [], status: "ready" };
  try {
    const raw = storage?.getItem(DEMO_ACTIVITY_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<ActivityState>) : null;
    state = { ...state, activities: saved?.activities ?? sampleActivities(now), connections: saved?.connections ?? [] };
  } catch {
    state = { ...state, activities: sampleActivities(now) };
  }
  const listeners = new Set<() => void>();
  const update = (fn: (s: ActivityState) => ActivityState) => {
    state = fn(state);
    try {
      storage?.setItem(DEMO_ACTIVITY_KEY, JSON.stringify({ activities: state.activities, connections: state.connections }));
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
