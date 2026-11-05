/* Habits, nutrition targets with a food log, and the onboarding questionnaire.
   The coach sets habits and targets; the client ticks habits, logs food and fills in the questionnaire once.
   Behind one interface like ApexStore: the demo keeps it in localStorage, the live app in the tables of
   supabase/migrations/20261102200000_habits_nutrition_intake.sql (apps/web/src/data/supabaseLifestyle.ts).
   Everything here is pure, so it is unit tested. */

import { localDate } from "./recovery";

/* ---------- Habits ---------- */

export type HabitKind = "water" | "steps" | "sleep" | "protein" | "veg" | "mobility" | "custom";

export interface Habit {
  id: string;
  kind: HabitKind;
  /** What the client sees, e.g. "Drink 2.5 L of water". */
  title: string;
  /** Days it applies, 0 = Monday … 6 = Sunday. All seven for a daily habit. */
  days: number[];
  createdAt: string;
}

/** One habit done on one day. */
export interface HabitTick {
  habitId: string;
  /** Local date, YYYY-MM-DD. */
  day: string;
}

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** Ready-made habits the coach can add in one tap. Plain, original wording. */
export const HABIT_PRESETS: { kind: HabitKind; title: string }[] = [
  { kind: "water", title: "Drink 2.5 L of water" },
  { kind: "steps", title: "Walk 8,000 steps" },
  { kind: "sleep", title: "In bed by 10:30 pm" },
  { kind: "protein", title: "Protein with every meal" },
  { kind: "veg", title: "Five portions of fruit and veg" },
  { kind: "mobility", title: "10 minutes of mobility" },
];

const weekdayOf = (day: string): number => (new Date(`${day}T12:00:00`).getDay() + 6) % 7;

/** Local date `n` days before `day`. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDate(d);
}

export const habitApplies = (h: Habit, day: string): boolean => h.days.includes(weekdayOf(day)) && day >= h.createdAt.slice(0, 10);

export const habitsOn = (habits: Habit[], day: string): Habit[] => habits.filter((h) => habitApplies(h, day));

export const isDone = (ticks: HabitTick[], habitId: string, day: string): boolean => ticks.some((t) => t.habitId === habitId && t.day === day);

/** Ticks with this one switched on or off. */
export function toggleTick(ticks: HabitTick[], habitId: string, day: string, done: boolean): HabitTick[] {
  const rest = ticks.filter((t) => !(t.habitId === habitId && t.day === day));
  return done ? [...rest, { habitId, day }] : rest;
}

/**
 * Days in a row the habit was done, counting back from today. Today not done yet doesn't break it
 * (the day isn't over), and days the habit doesn't apply are skipped.
 */
export function habitStreak(h: Habit, ticks: HabitTick[], today: string): number {
  let n = 0;
  let day = today;
  for (let i = 0; i < 400; i++, day = addDays(day, -1)) {
    if (day < h.createdAt.slice(0, 10)) break;
    if (!h.days.includes(weekdayOf(day))) continue;
    if (isDone(ticks, h.id, day)) n++;
    else if (day !== today) break;
  }
  return n;
}

export interface HabitDay {
  day: string;
  due: number;
  done: number;
}

/** Due and done for each of the last `n` days, oldest first, ending today. */
export function habitDays(habits: Habit[], ticks: HabitTick[], today: string, n = 7): HabitDay[] {
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1);
    const due = habitsOn(habits, day);
    return { day, due: due.length, done: due.filter((h) => isDone(ticks, h.id, day)).length };
  });
}

/** Share of habits done over the last `n` days, 0–100, or null when nothing was due. */
export function habitCompliance(habits: Habit[], ticks: HabitTick[], today: string, n = 7): number | null {
  const days = habitDays(habits, ticks, today, n);
  const due = days.reduce((a, d) => a + d.due, 0);
  if (!due) return null;
  return Math.round((days.reduce((a, d) => a + d.done, 0) / due) * 100);
}

/* ---------- Water ---------- */

/** One drink, logged by the client. */
export interface WaterEntry {
  id: string;
  /** Local date, YYYY-MM-DD. */
  day: string;
  ml: number;
  /** When it was logged, ISO. */
  at: string;
}

/** Quick-add sizes, in ml. */
export const WATER_SIZES = [150, 250, 500];
export const DEFAULT_WATER_GOAL_ML = 2500;

/**
 * The daily goal in ml, read from the habit's wording: "Drink 2.5 L of water", "3 litres", "2000 ml", "8 glasses" (250 ml each).
 * Falls back to 2.5 L when there's no number, and keeps the result between 500 ml and 8 L.
 */
export function waterGoalMl(title: string): number {
  const t = title.toLowerCase().replace(/,(?=\d{3}\b)/g, "");
  const n = (s: string) => Number(s.replace(",", "."));
  const pick = (): number | null => {
    let m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:ml|millilit(?:re|er)s?)\b/);
    if (m?.[1]) return n(m[1]);
    m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:l|lit(?:re|er)s?)\b/);
    if (m?.[1]) return n(m[1]) * 1000;
    m = t.match(/(\d+)\s*(?:glass|glasses|cups?)\b/);
    if (m?.[1]) return n(m[1]) * 250;
    return null;
  };
  const v = pick();
  if (v === null || !Number.isFinite(v) || v <= 0) return DEFAULT_WATER_GOAL_ML;
  return Math.round(Math.min(8000, Math.max(500, v)));
}

/** Total ml drunk on a day. */
export const waterOn = (entries: WaterEntry[], day: string): number => entries.reduce((a, e) => (e.day === day ? a + e.ml : a), 0);

/** A day's drinks, newest first. */
export const waterLogOn = (entries: WaterEntry[], day: string): WaterEntry[] => entries.filter((e) => e.day === day).sort((a, b) => b.at.localeCompare(a.at));

/** "1.65 L" from 1650, "750 ml" under a litre. */
export function formatMl(ml: number): string {
  if (Math.abs(ml) < 1000) return `${Math.round(ml)} ml`;
  return `${(ml / 1000).toFixed(2).replace(/0$/, "").replace(/\.0$/, "")} L`;
}

/** The first water habit due on the day, which the water tracker fills and ticks. */
export const waterHabitOn = (habits: Habit[], day: string): Habit | undefined => habitsOn(habits, day).find((h) => h.kind === "water");

/* ---------- Nutrition ---------- */

export interface NutritionTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** A line from the coach, e.g. "Aim for 40 g protein at breakfast". */
  note: string;
}

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export const MEALS: { key: Meal; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snacks" },
];

export interface FoodEntry {
  id: string;
  /** Local date, YYYY-MM-DD. */
  day: string;
  meal: Meal;
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const ZERO: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export function sumMacros(list: Macros[]): Macros {
  return list.reduce((a, f) => ({ kcal: a.kcal + f.kcal, proteinG: a.proteinG + f.proteinG, carbsG: a.carbsG + f.carbsG, fatG: a.fatG + f.fatG }), ZERO);
}

export const dayTotals = (food: FoodEntry[], day: string): Macros => sumMacros(food.filter((f) => f.day === day));

/** Calories from macros (4/4/9), so the coach can see if the targets add up. */
export const kcalFromMacros = (t: Pick<Macros, "proteinG" | "carbsG" | "fatG">): number => Math.round(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9);

/**
 * Average of the days anything was logged over the last `n` days, plus how many days that was.
 * Days with nothing logged are left out rather than counted as zero, which would pull the average down unfairly.
 */
export function loggedAverage(food: FoodEntry[], today: string, n = 7): { days: number; avg: Macros } {
  const from = addDays(today, -(n - 1));
  const byDay = new Map<string, FoodEntry[]>();
  for (const f of food) if (f.day >= from && f.day <= today) byDay.set(f.day, [...(byDay.get(f.day) ?? []), f]);
  const totals = [...byDay.values()].map(sumMacros);
  if (!totals.length) return { days: 0, avg: ZERO };
  const s = sumMacros(totals);
  const k = totals.length;
  return { days: k, avg: { kcal: Math.round(s.kcal / k), proteinG: Math.round(s.proteinG / k), carbsG: Math.round(s.carbsG / k), fatG: Math.round(s.fatG / k) } };
}

/** "on" within 10% of the target, "under" or "over" outside it. */
export function againstTarget(value: number, target: number): "on" | "under" | "over" {
  if (!target) return "on";
  const r = value / target;
  return r < 0.9 ? "under" : r > 1.1 ? "over" : "on";
}

/* ---------- Onboarding questionnaire ---------- */

/** Pre-exercise health screening. Our own wording of the standard topics: a "yes" means the coach should talk to the client, and may ask for a doctor's OK. */
export const HEALTH_QUESTIONS: { key: string; text: string }[] = [
  { key: "heart", text: "Has a doctor ever told you that you have a heart condition or high blood pressure?" },
  { key: "chest", text: "Do you get pain or tightness in your chest, at rest or when you exercise?" },
  { key: "dizzy", text: "Do you ever lose your balance from dizziness, or have you fainted in the last year?" },
  { key: "condition", text: "Do you have another long-term medical condition, such as diabetes, asthma or epilepsy?" },
  { key: "medication", text: "Are you taking any prescribed medication at the moment?" },
  { key: "joints", text: "Do you have a bone, joint or muscle problem that could get worse with exercise?" },
  { key: "pregnant", text: "Are you pregnant, or have you given birth in the last six months?" },
  { key: "advised", text: "Has a doctor ever said you should only do exercise they recommend?" },
];

export const EXPERIENCE = ["New to training", "Under a year", "1 to 3 years", "3 years or more"] as const;

export interface IntakeAnswers {
  /** Health question key → yes. */
  health: Record<string, boolean>;
  /** What a "yes" is about, in the client's words. */
  healthDetail: string;
  goal: string;
  /** Why it matters to them. */
  why: string;
  injuries: string;
  experience: (typeof EXPERIENCE)[number] | "";
  daysPerWeek: number | null;
  /** Where they train and with what, e.g. "Home: dumbbells to 20 kg and a bench". */
  equipment: string;
  /** Typical day: job, sleep, stress, food. */
  lifestyle: string;
  /** I confirm the answers are true. */
  confirmed: boolean;
}

export interface IntakeForm {
  answers: IntakeAnswers;
  submittedAt: string;
}

export const blankIntake = (): IntakeAnswers => ({
  health: Object.fromEntries(HEALTH_QUESTIONS.map((q) => [q.key, false])),
  healthDetail: "", goal: "", why: "", injuries: "", experience: "", daysPerWeek: null, equipment: "", lifestyle: "", confirmed: false,
});

/** The health questions answered "yes", in question order. */
export const healthFlags = (a: IntakeAnswers): string[] => HEALTH_QUESTIONS.filter((q) => a.health[q.key]).map((q) => q.text);

/** What still stops the form from being sent, or null when it can go. */
export function intakeProblem(a: IntakeAnswers): string | null {
  if (!a.goal.trim()) return "Add your main goal.";
  if (healthFlags(a).length && !a.healthDetail.trim()) return "Tell your coach a little about the health questions you answered yes to.";
  if (!a.confirmed) return "Tick the box to confirm your answers are true.";
  return null;
}

/* ---------- The store ---------- */

export interface LifestyleState {
  habits: Habit[];
  /** Ticks from about the last two months. */
  ticks: HabitTick[];
  targets: NutritionTargets | null;
  /** Food from about the last month. */
  food: FoodEntry[];
  intake: IntakeForm | null;
  /** Water drunk over about the last two weeks. */
  water: WaterEntry[];
  /** False when the live database doesn't have the water table yet: the tracker says so and habits keep working. */
  waterReady: boolean;
  /** "needs-update": the database doesn't have these tables yet (the SQL hasn't run). */
  status: "loading" | "ready" | "needs-update" | "error";
  error?: string;
}

export interface LifestyleStore {
  get(): LifestyleState;
  subscribe(listener: () => void): () => void;
  /** Coach: add or change a habit. */
  saveHabit(h: Habit): void;
  /** Coach: stop a habit. Its ticks go with it. */
  removeHabit(id: string): void;
  /** Client: done or not done on a day. */
  setHabitDone(habitId: string, day: string, done: boolean): void;
  /** Coach. */
  setTargets(t: NutritionTargets): void;
  /** Client. */
  addFood(f: FoodEntry): void;
  removeFood(id: string): void;
  /** Client: log a drink. */
  addWater(e: WaterEntry): void;
  removeWater(id: string): void;
  /** Client, once (sending again replaces it). */
  submitIntake(a: IntakeAnswers): Promise<void>;
}

/* ---------- Database rows ---------- */

export interface HabitRow { id: string; client_id: string; kind: HabitKind; title: string; days: number[]; created_at: string }
export interface HabitTickRow { client_id: string; habit_id: string; day: string }
export interface NutritionTargetsRow { client_id: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; note: string | null }
export interface FoodEntryRow { id: string; client_id: string; day: string; meal: Meal; name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }
export interface WaterRow { id: string; client_id: string; day: string; ml: number; created_at: string }
export interface IntakeRow { client_id: string; answers: IntakeAnswers; health_flags: number; submitted_at: string }

export const toHabitRow = (h: Habit, clientId: string): HabitRow => ({ id: h.id, client_id: clientId, kind: h.kind, title: h.title.slice(0, 120), days: [...h.days].sort(), created_at: h.createdAt });
export const fromHabitRow = (r: HabitRow): Habit => ({ id: r.id, kind: r.kind, title: r.title, days: r.days.map(Number), createdAt: r.created_at });
export const fromTickRow = (r: HabitTickRow): HabitTick => ({ habitId: r.habit_id, day: r.day.slice(0, 10) });

const num = (v: number | string) => Number(v) || 0;
export const toTargetsRow = (t: NutritionTargets, clientId: string): NutritionTargetsRow => ({ client_id: clientId, kcal: Math.round(t.kcal), protein_g: Math.round(t.proteinG), carbs_g: Math.round(t.carbsG), fat_g: Math.round(t.fatG), note: t.note.trim() || null });
export const fromTargetsRow = (r: NutritionTargetsRow): NutritionTargets => ({ kcal: num(r.kcal), proteinG: num(r.protein_g), carbsG: num(r.carbs_g), fatG: num(r.fat_g), note: r.note ?? "" });

export const toFoodRow = (f: FoodEntry, clientId: string): FoodEntryRow => ({ id: f.id, client_id: clientId, day: f.day, meal: f.meal, name: f.name.slice(0, 120), kcal: Math.round(f.kcal), protein_g: f.proteinG, carbs_g: f.carbsG, fat_g: f.fatG });
export const fromFoodRow = (r: FoodEntryRow): FoodEntry => ({ id: r.id, day: r.day.slice(0, 10), meal: r.meal, name: r.name, kcal: num(r.kcal), proteinG: num(r.protein_g), carbsG: num(r.carbs_g), fatG: num(r.fat_g) });

export const toWaterRow = (e: WaterEntry, clientId: string): WaterRow => ({ id: e.id, client_id: clientId, day: e.day, ml: Math.round(Math.min(5000, Math.max(1, e.ml))), created_at: e.at });
export const fromWaterRow = (r: WaterRow): WaterEntry => ({ id: r.id, day: r.day.slice(0, 10), ml: num(r.ml), at: r.created_at });

export const fromIntakeRow = (r: IntakeRow): IntakeForm => ({ answers: { ...blankIntake(), ...r.answers }, submittedAt: r.submitted_at });

/* ---------- Demo ---------- */

export const DEMO_LIFESTYLE_KEY = "apex-lifestyle-v1";

/** Priya's sample: three habits from two weeks ago with most days ticked, targets, and a day of food. */
export function sampleLifestyle(now = new Date()): Omit<LifestyleState, "status"> {
  const today = localDate(now);
  const start = addDays(today, -14);
  const habits: Habit[] = HABIT_PRESETS.slice(0, 3).map((p, i) => ({ id: `demo-habit-${i + 1}`, kind: p.kind, title: p.title, days: EVERY_DAY, createdAt: `${start}T08:00:00.000Z` }));
  const ticks: HabitTick[] = [];
  // A believable pattern: water nearly always, steps most days, bedtime about half.
  const misses = [[3, 9], [2, 5, 8, 12], [1, 3, 4, 7, 10, 11, 13]];
  habits.forEach((h, i) => {
    for (let d = 1; d <= 14; d++) if (!misses[i]?.includes(d)) ticks.push({ habitId: h.id, day: addDays(today, -d) });
  });
  ticks.push({ habitId: "demo-habit-1", day: today });
  const meal = (id: number, m: Meal, name: string, kcal: number, p: number, c: number, f: number, day = today): FoodEntry => ({ id: `demo-food-${id}`, day, meal: m, name, kcal, proteinG: p, carbsG: c, fatG: f });
  const food: FoodEntry[] = [
    meal(1, "breakfast", "Oats, 50 g", 188, 7, 32, 4),
    meal(2, "breakfast", "Greek yogurt, 150 g", 100, 17, 6, 0),
    meal(3, "lunch", "Chicken breast, 100 g", 165, 31, 0, 4),
    meal(4, "lunch", "Brown rice, 100 g", 216, 5, 45, 2),
    ...[1, 2, 3, 5, 6].flatMap((d, i) => [
      meal(10 + i * 2, "lunch", "Lunch (quick add)", 640 + i * 40, 42, 70, 18, addDays(today, -d)),
      meal(11 + i * 2, "dinner", "Dinner (quick add)", 760 - i * 30, 48, 80, 24, addDays(today, -d)),
    ]),
  ];
  const sip = (i: number, ml: number, h: number, m: number, day = today): WaterEntry => {
    const d = new Date(`${day}T00:00:00`);
    d.setHours(h, m);
    return { id: `demo-water-${i}`, day, ml, at: d.toISOString() };
  };
  // Yesterday finished the goal; today is part way, so the tracker has somewhere to go.
  const water: WaterEntry[] = [
    sip(1, 500, 8, 5, addDays(today, -1)), sip(2, 500, 11, 30, addDays(today, -1)), sip(3, 750, 14, 10, addDays(today, -1)), sip(4, 750, 18, 40, addDays(today, -1)),
    sip(5, 250, 7, 40), sip(6, 500, 10, 15), sip(7, 250, 12, 30),
  ];
  return { habits, ticks, water, waterReady: true, targets: { kcal: 1900, proteinG: 120, carbsG: 210, fatG: 60, note: "Aim for 30 g of protein at breakfast." }, food, intake: null };
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;
interface StorageEventTarget {
  addEventListener(type: "storage", fn: (e: StorageEvent) => void): void;
  removeEventListener(type: "storage", fn: (e: StorageEvent) => void): void;
}

/** Demo store in localStorage. Coach and client tabs share it, so a habit added by the coach shows up for the client straight away. */
export function createDemoLifestyleStore(
  storage: StorageLike | null = safeStorage(),
  events: StorageEventTarget | null = typeof window === "undefined" ? null : window,
  now = new Date(),
): LifestyleStore {
  const read = (): LifestyleState => {
    try {
      const raw = storage?.getItem(DEMO_LIFESTYLE_KEY);
      if (raw) return { ...sampleLifestyle(now), ...(JSON.parse(raw) as Partial<LifestyleState>), status: "ready" };
    } catch {
      /* private mode or corrupt data: sample */
    }
    return { ...sampleLifestyle(now), status: "ready" };
  };
  let state = read();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const update = (fn: (s: LifestyleState) => LifestyleState) => {
    state = fn(state);
    try {
      const { habits, ticks, targets, food, intake, water } = state;
      storage?.setItem(DEMO_LIFESTYLE_KEY, JSON.stringify({ habits, ticks, targets, food, intake, water }));
    } catch {
      /* storage full or blocked: the change still shows in this tab */
    }
    emit();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== DEMO_LIFESTYLE_KEY && e.key !== null) return;
    state = read();
    emit();
  };
  return {
    get: () => state,
    subscribe(l) {
      if (!listeners.size) events?.addEventListener("storage", onStorage);
      listeners.add(l);
      return () => {
        listeners.delete(l);
        if (!listeners.size) events?.removeEventListener("storage", onStorage);
      };
    },
    saveHabit: (h) => update((s) => ({ ...s, habits: s.habits.some((x) => x.id === h.id) ? s.habits.map((x) => (x.id === h.id ? h : x)) : [...s.habits, h] })),
    removeHabit: (id) => update((s) => ({ ...s, habits: s.habits.filter((h) => h.id !== id), ticks: s.ticks.filter((t) => t.habitId !== id) })),
    setHabitDone: (habitId, day, done) => update((s) => ({ ...s, ticks: toggleTick(s.ticks, habitId, day, done) })),
    setTargets: (t) => update((s) => ({ ...s, targets: t })),
    addFood: (f) => update((s) => ({ ...s, food: [...s.food, f] })),
    removeFood: (id) => update((s) => ({ ...s, food: s.food.filter((f) => f.id !== id) })),
    addWater: (e) => update((s) => ({ ...s, water: [...s.water, e] })),
    removeWater: (id) => update((s) => ({ ...s, water: s.water.filter((e) => e.id !== id) })),
    async submitIntake(a) {
      update((s) => ({ ...s, intake: { answers: a, submittedAt: new Date().toISOString() } }));
    },
  };
}

/** A store with nothing in it, for a coach with no clients yet. */
export function emptyLifestyleStore(): LifestyleStore {
  const state: LifestyleState = { habits: [], ticks: [], targets: null, food: [], intake: null, water: [], waterReady: true, status: "ready" };
  const noop = () => {};
  return { get: () => state, subscribe: () => noop, saveHabit: noop, removeHabit: noop, setHabitDone: noop, setTargets: noop, addFood: noop, removeFood: noop, addWater: noop, removeWater: noop, submitIntake: async () => {} };
}

function safeStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
