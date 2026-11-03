import { fromGoalRow, goalProblem, toGoalRow, type GoalRow, type GoalState, type GoalStore } from "@apex/core";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

const isMissingTable = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";
const NOT_READY = "Goals aren't switched on yet. Ask your coach to finish the latest update.";

export interface LiveGoalStore extends GoalStore {
  close(): void;
}

/** GoalStore backed by the client_goals table, kept live with Realtime so coach and client see each other's changes. */
export function createSupabaseGoals(db: SupabaseClient, clientId: string): LiveGoalStore {
  let state: GoalState = { goals: [], status: "loading" };
  let channel: RealtimeChannel | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;
  const listeners = new Set<() => void>();
  const set = (next: Partial<GoalState>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  const fail = (e: unknown) => {
    if (isMissingTable(e as { code?: string })) return set({ status: "needs-update" });
    set({ status: "error", error: e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e) });
  };

  async function load() {
    const mine = ++seq;
    const { data, error } = await db.from("client_goals").select("*").eq("client_id", clientId).order("created_at").returns<GoalRow[]>();
    if (error) return fail(error);
    if (mine !== seq) return;
    set({ goals: (data ?? []).map(fromGoalRow), status: "ready", error: undefined });
  }

  function open() {
    if (channel) return;
    channel = db
      .channel(`apex-goals-${clientId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "client_goals", filter: `client_id=eq.${clientId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => void load().catch(fail), 250);
      })
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
    async save(g) {
      const problem = goalProblem(g);
      if (problem) throw new Error(problem);
      const { error } = await db.from("client_goals").upsert(toGoalRow(g, clientId));
      if (error) throw new Error(isMissingTable(error) ? NOT_READY : error.message);
      set({ goals: state.goals.some((x) => x.id === g.id) ? state.goals.map((x) => (x.id === g.id ? g : x)) : [...state.goals, g] });
    },
    async remove(id) {
      const { error } = await db.from("client_goals").delete().eq("id", id);
      if (error) throw new Error(error.message);
      set({ goals: state.goals.filter((g) => g.id !== id) });
    },
    close() {
      clearTimeout(timer);
      if (channel) void db.removeChannel(channel);
      channel = null;
      listeners.clear();
    },
  };
}
