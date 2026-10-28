import {
  fromActivityRow, fromConnectionRow, mergeActivities, toActivityRow,
  type ActivityRow, type ActivityState, type ActivityStore, type ConnectionRow,
} from "@apex/core";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/** Postgres "undefined table" and PostgREST "table not in schema cache": the cardio SQL hasn't run yet. */
const isMissingTable = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";

const RECENT = 120;

export interface LiveActivityStore extends ActivityStore {
  reload(): Promise<void>;
  close(): void;
}

/** ActivityStore backed by the `activities` and `device_connections` tables, kept live with Realtime. */
export function createSupabaseActivities(db: SupabaseClient, clientId: string): LiveActivityStore {
  let state: ActivityState = { activities: [], connections: [], status: "loading" };
  let channel: RealtimeChannel | null = null;
  let seq = 0;
  const listeners = new Set<() => void>();
  const set = (next: Partial<ActivityState>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  const fail = (e: unknown) => {
    if (isMissingTable(e as { code?: string })) return set({ status: "needs-update" });
    set({ status: "error", error: e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e) });
  };

  async function load() {
    const mine = ++seq;
    const [{ data: rows, error: e1 }, { data: links, error: e2 }] = await Promise.all([
      db.from("activities").select("*").eq("client_id", clientId).order("started_at", { ascending: false }).limit(RECENT).returns<ActivityRow[]>(),
      db.from("device_connections").select("provider, athlete_name, connected_at, last_sync_at").eq("client_id", clientId).returns<ConnectionRow[]>(),
    ]);
    if (mine !== seq) return;
    if (e1 || e2) return fail(e1 ?? e2);
    set({ activities: (rows ?? []).map(fromActivityRow), connections: (links ?? []).map(fromConnectionRow), status: "ready", error: undefined });
  }

  function open() {
    if (channel) return;
    channel = db
      .channel(`apex-activities-${clientId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities", filter: `client_id=eq.${clientId}` }, () => void load().catch(fail))
      .subscribe();
  }

  void load().catch(fail);

  return {
    get: () => state,
    subscribe(l) {
      listeners.add(l);
      open();
      return () => {
        listeners.delete(l);
        if (!listeners.size && channel) { void db.removeChannel(channel); channel = null; }
      };
    },
    save(list) {
      if (!list.length) return;
      set({ activities: mergeActivities(state.activities, list) });
      void (async () => {
        // Something already brought in from Strava keeps its row: look up the ids it was saved under.
        const external = list.filter((a) => a.externalId);
        const known = new Map<string, string>();
        if (external.length) {
          const { data, error } = await db.from("activities").select("id, source, external_id").eq("client_id", clientId).in("external_id", external.map((a) => a.externalId as string));
          if (error) throw error;
          for (const r of data ?? []) known.set(`${r.source}:${r.external_id}`, r.id as string);
        }
        const rows = list.map((a) => {
          const id = a.externalId ? known.get(`${a.source}:${a.externalId}`) : undefined;
          const old = id ? state.activities.find((x) => x.id === id) : undefined;
          return toActivityRow({ ...a, id: id ?? a.id, ...(old?.rpe ? { rpe: old.rpe } : {}), ...(old?.note ? { note: old.note } : {}) }, clientId);
        });
        const { error } = await db.from("activities").upsert(rows);
        if (error) throw error;
        if (known.size) await load();
      })().catch(fail);
    },
    remove(id) {
      set({ activities: state.activities.filter((a) => a.id !== id) });
      void db.from("activities").delete().eq("id", id).then(({ error }) => { if (error) fail(error); });
    },
    // Connections are written by the edge function; here we only show the change straight away.
    setConnection(c) {
      set({ connections: [...state.connections.filter((x) => x.provider !== c.provider), c] });
    },
    removeConnection(p) {
      set({ connections: state.connections.filter((x) => x.provider !== p) });
    },
    reload: () => load().catch(fail),
    close() {
      if (channel) void db.removeChannel(channel);
      channel = null;
    },
  };
}
