import {
  addDays, fromMealPlanRow, toMealPlanRow, fromFoodRow, fromWaterRow, toWaterRow, fromHabitRow, fromIntakeRow, fromTargetsRow, fromTickRow, healthFlags, localDate, toFoodRow, toggleTick, toHabitRow, toTargetsRow,
  type FoodEntryRow, type HabitRow, type HabitTickRow, type IntakeRow, type LifestyleState, type MealPlanRow, type LifestyleStore, type NutritionTargetsRow, type WaterRow,
} from "@apex/core";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/** Postgres "undefined table" and PostgREST "table not in schema cache": the habits SQL hasn't run yet. */
const isMissingTable = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";
const TICK_DAYS = 60;
const FOOD_DAYS = 31;
const WATER_DAYS = 14;
const TABLES = ["client_habits", "habit_ticks", "nutrition_targets", "food_entries", "intake_forms", "water_entries", "meal_plans"];

export interface LiveLifestyleStore extends LifestyleStore {
  close(): void;
}

/** LifestyleStore backed by the habits, nutrition and questionnaire tables, kept live with Realtime. */
export function createSupabaseLifestyle(db: SupabaseClient, clientId: string): LiveLifestyleStore {
  let state: LifestyleState = { habits: [], ticks: [], targets: null, food: [], intake: null, water: [], waterReady: true, mealPlan: null, planReady: true, status: "loading" };
  let channel: RealtimeChannel | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;
  const listeners = new Set<() => void>();
  const set = (next: Partial<LifestyleState>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  const fail = (e: unknown) => {
    if (isMissingTable(e as { code?: string })) return set({ status: "needs-update" });
    set({ status: "error", error: e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e) });
  };
  // Writes show straight away; a failed one reloads the truth and says why.
  const write = (p: PromiseLike<{ error: unknown }>) => void Promise.resolve(p).then(({ error }) => { if (error) { fail(error); void load(); } });

  async function load() {
    const mine = ++seq;
    const today = localDate(new Date());
    const [h, t, n, f, i, wa, mp] = await Promise.all([
      db.from("client_habits").select("*").eq("client_id", clientId).order("created_at").returns<HabitRow[]>(),
      db.from("habit_ticks").select("*").eq("client_id", clientId).gte("day", addDays(today, -TICK_DAYS)).returns<HabitTickRow[]>(),
      db.from("nutrition_targets").select("*").eq("client_id", clientId).maybeSingle<NutritionTargetsRow>(),
      db.from("food_entries").select("*").eq("client_id", clientId).gte("day", addDays(today, -FOOD_DAYS)).order("created_at").returns<FoodEntryRow[]>(),
      db.from("intake_forms").select("*").eq("client_id", clientId).maybeSingle<IntakeRow>(),
      db.from("water_entries").select("*").eq("client_id", clientId).gte("day", addDays(today, -WATER_DAYS)).order("created_at").returns<WaterRow[]>(),
      db.from("meal_plans").select("*").eq("client_id", clientId).maybeSingle<MealPlanRow>(),
    ]);
    if (mine !== seq) return;
    const err = h.error ?? t.error ?? n.error ?? f.error ?? i.error;
    if (err) return fail(err);
    // Water came later: without its table the tracker says so, and everything else still works.
    if (wa.error && !isMissingTable(wa.error)) return fail(wa.error);
    // Same for meal plans: without the table the plan section says the update is needed.
    if (mp.error && !isMissingTable(mp.error)) return fail(mp.error);
    set({
      water: wa.error ? [] : (wa.data ?? []).map(fromWaterRow), waterReady: !wa.error,
      mealPlan: mp.error || !mp.data ? null : fromMealPlanRow(mp.data), planReady: !mp.error,
      habits: (h.data ?? []).map(fromHabitRow), ticks: (t.data ?? []).map(fromTickRow), targets: n.data ? fromTargetsRow(n.data) : null,
      food: (f.data ?? []).map(fromFoodRow), intake: i.data ? fromIntakeRow(i.data) : null, status: "ready", error: undefined,
    });
  }

  function open() {
    if (channel) return;
    const changed = () => { clearTimeout(timer); timer = setTimeout(() => void load().catch(fail), 250); };
    let ch = db.channel(`apex-lifestyle-${clientId}-${Math.random().toString(36).slice(2)}`);
    for (const table of TABLES) ch = ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `client_id=eq.${clientId}` }, changed);
    channel = ch.subscribe();
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
    saveHabit(h) {
      set({ habits: state.habits.some((x) => x.id === h.id) ? state.habits.map((x) => (x.id === h.id ? h : x)) : [...state.habits, h] });
      write(db.from("client_habits").upsert(toHabitRow(h, clientId)));
    },
    removeHabit(id) {
      set({ habits: state.habits.filter((h) => h.id !== id), ticks: state.ticks.filter((t) => t.habitId !== id) });
      write(db.from("client_habits").delete().eq("id", id));
    },
    setHabitDone(habitId, day, done) {
      set({ ticks: toggleTick(state.ticks, habitId, day, done) });
      write(done
        ? db.from("habit_ticks").upsert({ habit_id: habitId, client_id: clientId, day }, { ignoreDuplicates: true })
        : db.from("habit_ticks").delete().eq("habit_id", habitId).eq("day", day));
    },
    setTargets(t) {
      set({ targets: t });
      write(db.from("nutrition_targets").upsert({ ...toTargetsRow(t, clientId), updated_at: new Date().toISOString() }));
    },
    setMealPlan(p) {
      set({ mealPlan: p });
      write(p ? db.from("meal_plans").upsert(toMealPlanRow(p, clientId)) : db.from("meal_plans").delete().eq("client_id", clientId));
    },
    addFood(f) {
      set({ food: [...state.food, f] });
      const row = toFoodRow(f, clientId);
      // Before the micros SQL has run, a scanned food with fibre, sugar or salt still saves, without them.
      write(Promise.resolve(db.from("food_entries").insert(row)).then((r) => {
        if (r.error?.code !== "PGRST204" || !/fibre_g|sugar_g|salt_g/.test(r.error.message)) return r;
        const { fibre_g: _f, sugar_g: _s, salt_g: _l, ...plain } = row;
        return db.from("food_entries").insert(plain);
      }));
    },
    removeFood(id) {
      set({ food: state.food.filter((f) => f.id !== id) });
      write(db.from("food_entries").delete().eq("id", id));
    },
    addWater(e) {
      set({ water: [...state.water, e] });
      write(db.from("water_entries").insert(toWaterRow(e, clientId)));
    },
    removeWater(id) {
      set({ water: state.water.filter((e) => e.id !== id) });
      write(db.from("water_entries").delete().eq("id", id));
    },
    async submitIntake(answers) {
      const submittedAt = new Date().toISOString();
      const { error } = await db.from("intake_forms").upsert({ client_id: clientId, answers, health_flags: healthFlags(answers).length, submitted_at: submittedAt });
      if (error) throw new Error(isMissingTable(error) ? "The questionnaire isn't switched on yet. Ask your coach to finish the latest update." : error.message);
      set({ intake: { answers, submittedAt } });
    },
    close() {
      clearTimeout(timer);
      if (channel) void db.removeChannel(channel);
      channel = null;
      listeners.clear();
    },
  };
}
