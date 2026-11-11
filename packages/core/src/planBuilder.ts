// Plan builder: the coach describes the client in a sentence or two and gets a full programme to review.
// Rule-based for now (no paid AI): it reads the goal, days a week, level, equipment, session length and
// injuries from the words, then builds each day from movement slots with doses that fit the goal.
// Nothing reaches the client until the coach uses it. Pure, so it is unit tested.
import { EXERCISES } from "./data/exercises";
import type { ProgramTemplate, TemplateDay } from "./types";

type TemplateItem = TemplateDay["items"][number];

export type PlanGoal = "strength" | "muscle" | "fatloss" | "fitness" | "general";
export type PlanLevel = "beginner" | "intermediate" | "advanced";
export type PlanSetting = "gym" | "dumbbells" | "kettlebell" | "bodyweight";
export type PlanInjury = "knee" | "back" | "shoulder";

export interface PlanBrief {
  goal: PlanGoal;
  days: number;
  level: PlanLevel;
  setting: PlanSetting;
  minutes: number;
  weeks: number;
  avoid: PlanInjury[];
  /** Words the builder found, as chips: "3 days a week", "Fat loss", "Knee-friendly". */
  understood: string[];
  /** Safe defaults for what the description didn't say: "Beginner (assumed)". */
  assumed: string[];
}

const has = (t: string, re: RegExp) => re.test(t);
const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, twelve: 12 };
const num = (s: string) => Number(s) || WORD_NUMBERS[s.toLowerCase()] || 0;
const NUM = "(\\d+|one|two|three|four|five|six|seven|eight|ten|twelve)";

export const GOAL_LABEL: Record<PlanGoal, string> = { strength: "Strength", muscle: "Build muscle", fatloss: "Fat loss", fitness: "Fitness and conditioning", general: "General fitness" };
const SETTING_LABEL: Record<PlanSetting, string> = { gym: "Full gym", dumbbells: "Dumbbells", kettlebell: "Kettlebells", bodyweight: "Bodyweight, at home" };
const LEVEL_LABEL: Record<PlanLevel, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const INJURY_LABEL: Record<PlanInjury, string> = { knee: "Knee-friendly", back: "Back-friendly", shoulder: "Shoulder-friendly" };

/** Reads the coach's description. Anything not mentioned gets a sensible default (and isn't shown as understood). */
export function readBrief(text: string): PlanBrief {
  const t = ` ${text.toLowerCase().replace(/[’']/g, "'")} `;
  const understood: string[] = [];
  const assumed: string[] = [];

  let goal: PlanGoal = "general";
  if (has(t, /fat loss|lose (weight|fat|\d+ ?kg)|weight loss|lean(er)? out|tone|toning|cut(ting)?\b|drop .*kg/)) goal = "fatloss";
  else if (has(t, /muscle|hypertroph|bulk|size|bigger|build (up )?(arms|legs|glutes|chest|back)|glutes?\b/)) goal = "muscle";
  else if (has(t, /strength|stronger|powerlift|1 ?rm|heavy|squat (more|\d)|deadlift (more|\d)|bench (more|\d)/)) goal = "strength";
  else if (has(t, /fitness|condition|cardio|stamina|endurance|hyrox|run|race|fitter|engine|sport/)) goal = "fitness";
  if (goal !== "general") understood.push(GOAL_LABEL[goal]);
  else assumed.push(GOAL_LABEL.general);

  const twice = /\btwice (a|per|each) (week|wk)\b/.test(t) ? 2 : 0;
  const daysMatch = new RegExp(`${NUM}\\s*(x|times|days|sessions)\\s*(a|per|each)?\\s*(week|wk)?`).exec(t) ?? new RegExp(`${NUM}\\s*(day|session)s?\\b`).exec(t);
  let days = twice || (daysMatch ? num(daysMatch[1]!) : 0);
  if (days) understood.push(`${Math.min(6, Math.max(2, days))} days a week`);
  else assumed.push("3 days a week");
  days = Math.min(6, Math.max(2, days || 3));

  let level: PlanLevel = "beginner";
  if (has(t, /advanced|experienced|competitive|years of (lifting|training)|\b[3-9]\+? years\b|athlete/)) level = "advanced";
  else if (has(t, /intermediate|some experience|trained before|a year|\b[12] years?\b|been lifting|returning|back to (the )?gym/)) level = "intermediate";
  if (has(t, /beginner|new to|never (trained|lifted|been)|first time|novice|starting out|untrained/)) level = "beginner";
  if (has(t, /beginner|new to|never|first time|novice|starting out|untrained|intermediate|some experience|trained before|advanced|experienced|years/)) understood.push(LEVEL_LABEL[level]);
  else assumed.push(LEVEL_LABEL[level]);

  let setting: PlanSetting = "gym";
  if (has(t, /no equipment|bodyweight|body weight|at home|home workouts?|hotel|travel/)) setting = "bodyweight";
  if (has(t, /dumbbells?|db\b/)) setting = "dumbbells";
  if (has(t, /kettlebells?|kb\b/) && !has(t, /dumbbells?/)) setting = "kettlebell";
  if (has(t, /\bgym\b|barbell|machines?|commercial/)) setting = "gym";
  if (has(t, /gym|barbell|machine|dumbbell|kettlebell|bodyweight|body weight|home|no equipment|hotel|travel/)) understood.push(SETTING_LABEL[setting]);
  else assumed.push(SETTING_LABEL[setting]);

  const minMatch = /(\d{2,3})\s*(min|mins|minutes)\b/.exec(t) ?? /(an|one|1)\s*hour/.exec(t) ?? /(half an|30 min)\s*hour/.exec(t);
  let minutes = 0;
  if (minMatch) minutes = /hour/.test(minMatch[0]) ? (/half/.test(minMatch[0]) ? 30 : 60) : Number(minMatch[1]);
  if (minutes) understood.push(`${minutes} min sessions`);
  const minutesSaid = minutes > 0;
  minutes = Math.min(90, Math.max(25, minutes || (goal === "fatloss" || goal === "fitness" ? 45 : 55)));
  if (!minutesSaid) assumed.push(`${minutes} min sessions`);

  const wk = new RegExp(`${NUM}\\s*(week|wk)s?\\b(?!ly)`).exec(t.replace(new RegExp(`${NUM}\\s*(x|times|days|sessions)\\s*(a|per|each)\\s*(week|wk)`, "g"), ""));
  let weeks = wk ? num(wk[1]!) : 0;
  if (weeks) understood.push(`${weeks} weeks`);
  const weeksSaid = weeks > 0;
  weeks = Math.min(16, Math.max(2, weeks || (level === "beginner" ? 6 : 8)));
  if (!weeksSaid) assumed.push(`${weeks} weeks`);

  const avoid: PlanInjury[] = [];
  if (has(t, /knee|acl|meniscus|patella/)) avoid.push("knee");
  if (has(t, /back (pain|issue|injur|problem|tight|sore)|lower back|lumbar|disc|sciatica|bad back/)) avoid.push("back");
  if (has(t, /shoulder|rotator|impingement/)) avoid.push("shoulder");
  for (const a of avoid) understood.push(INJURY_LABEL[a]);

  return { goal, days, level, setting, minutes, weeks, avoid, understood, assumed };
}

type Slot = "squat" | "hinge" | "lunge" | "hpush" | "vpush" | "hpull" | "vpull" | "arms" | "delts" | "core" | "cond" | "glutes";

/* Exercise ids by slot and setting, first choice first. Ids are from the APEX library. */
const POOL: Record<Slot, Record<PlanSetting, number[]>> = {
  squat: { gym: [1, 104, 10, 9], dumbbells: [9, 642, 109], kettlebell: [9, 642, 623], bodyweight: [623, 302, 225] },
  hinge: { gym: [15, 2, 112, 636], dumbbells: [636, 117, 83], kettlebell: [140, 636, 117], bodyweight: [83, 84, 117] },
  lunge: { gym: [109, 639, 641], dumbbells: [109, 639, 641], kettlebell: [640, 642, 641], bodyweight: [640, 642, 641] },
  hpush: { gym: [120, 11, 123, 3], dumbbells: [11, 123, 624], kettlebell: [624, 11, 435], bodyweight: [624, 32, 435] },
  vpush: { gym: [5, 635, 40], dumbbells: [635, 40, 123], kettlebell: [183, 301, 635], bodyweight: [435, 624, 32] },
  hpull: { gym: [6, 638, 132, 645], dumbbells: [132, 645, 37], kettlebell: [132, 645, 37], bodyweight: [649, 72] },
  vpull: { gym: [12, 4, 127], dumbbells: [645, 132, 37], kettlebell: [645, 132, 37], bodyweight: [649, 72] },
  arms: { gym: [26, 17, 18, 27], dumbbells: [17, 27, 18, 30], kettlebell: [17, 27, 18], bodyweight: [33, 32, 624] },
  delts: { gym: [7, 13, 37], dumbbells: [7, 37, 40], kettlebell: [7, 37, 72], bodyweight: [72, 435] },
  core: { gym: [14, 426, 290, 418], dumbbells: [14, 426, 453, 280], kettlebell: [14, 426, 453, 474], bodyweight: [14, 426, 453, 280] },
  cond: { gym: [626, 632, 140, 164], dumbbells: [637, 431, 653], kettlebell: [140, 431, 653], bodyweight: [653, 431, 209, 336] },
  glutes: { gym: [8, 74, 54], dumbbells: [83, 84, 117], kettlebell: [83, 84, 140], bodyweight: [83, 84, 248] },
};

/* Swaps for a sore joint: the slot's own choices are replaced with these. */
const FRIENDLY: Partial<Record<PlanInjury, Partial<Record<Slot, number[]>>>> = {
  knee: { squat: [106, 8, 225, 83], lunge: [8, 83, 84], cond: [626, 633, 431] },
  back: { squat: [9, 10, 642], hinge: [8, 83, 74], hpull: [645, 638, 132], core: [426, 280, 453] },
  shoulder: { vpush: [7, 72, 37], hpush: [11, 624, 123], vpull: [645, 638, 649], arms: [17, 18, 26] },
};
const INJURY_NOTE: Record<PlanInjury, string> = { knee: "knee-friendly choice", back: "back-friendly choice", shoulder: "shoulder-friendly choice" };

/* Kit each setting has. A swap the client can't do with their kit is skipped. */
const KIT: Record<PlanSetting, string[] | null> = {
  gym: null,
  dumbbells: ["Dumbbell", "Bodyweight", "Resistance band", "Yoga mat"],
  kettlebell: ["Kettlebell", "Dumbbell", "Bodyweight", "Resistance band", "Yoga mat"],
  bodyweight: ["Bodyweight", "Resistance band", "Yoga mat"],
};
const canDo = (id: number, setting: PlanSetting) => {
  const kit = KIT[setting];
  if (!kit || Object.values(POOL).some((s) => s[setting].includes(id))) return true;
  const e = EXERCISES.find((x) => x.id === id);
  return !!e && kit.includes(e.equipment);
};

const HELD = /isometric|plank|hold|wall sit|hollow/i;

const WARM_UPS = [305, 314, 311, 304, 313, 310];

interface Dose { sets: number; reps: string; rpe: number; rest: number }
function dose(goal: PlanGoal, level: PlanLevel, role: "main" | "second" | "acc"): Dose {
  const table: Record<PlanGoal, Record<"main" | "second" | "acc", Dose>> = {
    strength: { main: { sets: 4, reps: "5", rpe: 8, rest: 180 }, second: { sets: 3, reps: "6-8", rpe: 8, rest: 120 }, acc: { sets: 3, reps: "10-12", rpe: 8, rest: 60 } },
    muscle: { main: { sets: 4, reps: "6-8", rpe: 8, rest: 120 }, second: { sets: 3, reps: "8-10", rpe: 8, rest: 90 }, acc: { sets: 3, reps: "10-15", rpe: 9, rest: 60 } },
    fatloss: { main: { sets: 3, reps: "8-10", rpe: 7, rest: 90 }, second: { sets: 3, reps: "10-12", rpe: 7, rest: 60 }, acc: { sets: 3, reps: "12-15", rpe: 8, rest: 45 } },
    fitness: { main: { sets: 3, reps: "8", rpe: 7, rest: 90 }, second: { sets: 3, reps: "10", rpe: 7, rest: 60 }, acc: { sets: 3, reps: "12", rpe: 7, rest: 45 } },
    general: { main: { sets: 3, reps: "8-10", rpe: 7, rest: 90 }, second: { sets: 3, reps: "10", rpe: 7, rest: 75 }, acc: { sets: 3, reps: "12", rpe: 7, rest: 60 } },
  };
  const d = { ...table[goal][role] };
  if (level === "beginner") { d.rpe = Math.max(6, d.rpe - 1); if (role === "main" && d.sets > 3) d.sets = 3; }
  if (level === "advanced" && role !== "acc") d.sets += 1;
  return d;
}

/* What each day is made of, by split. "+" slots are dropped first when time is short. */
type DayPlan = { name: string; main: Slot[]; acc: Slot[] };
function split(days: number): DayPlan[] {
  const fullA: DayPlan = { name: "Full body A", main: ["squat", "hpush", "hpull"], acc: ["glutes", "delts", "core"] };
  const fullB: DayPlan = { name: "Full body B", main: ["hinge", "vpush", "vpull"], acc: ["lunge", "arms", "core"] };
  const fullC: DayPlan = { name: "Full body C", main: ["lunge", "hpush", "hpull"], acc: ["glutes", "delts", "core"] };
  const lowerA: DayPlan = { name: "Lower A", main: ["squat", "hinge"], acc: ["lunge", "glutes", "core"] };
  const upperA: DayPlan = { name: "Upper A", main: ["hpush", "hpull"], acc: ["vpush", "vpull", "arms"] };
  const lowerB: DayPlan = { name: "Lower B", main: ["hinge", "lunge"], acc: ["squat", "glutes", "core"] };
  const upperB: DayPlan = { name: "Upper B", main: ["vpush", "vpull"], acc: ["hpush", "hpull", "delts"] };
  const push: DayPlan = { name: "Push", main: ["hpush", "vpush"], acc: ["delts", "arms", "core"] };
  const pull: DayPlan = { name: "Pull", main: ["hpull", "vpull"], acc: ["delts", "arms", "core"] };
  const legs: DayPlan = { name: "Legs", main: ["squat", "hinge"], acc: ["lunge", "glutes", "core"] };
  if (days === 2) return [{ ...fullA, name: "Full body A" }, { ...fullB, name: "Full body B" }];
  if (days === 3) return [fullA, fullB, fullC];
  if (days === 4) return [lowerA, upperA, lowerB, upperB];
  if (days === 5) return [push, pull, legs, upperA, lowerB];
  return [push, pull, legs, { ...push, name: "Push B" }, { ...pull, name: "Pull B" }, { ...legs, name: "Legs B" }];
}
const DAY_INDEX: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

export interface BuiltPlan {
  brief: PlanBrief;
  template: ProgramTemplate;
  /** Plain reasons for the choices, shown under the plan. */
  why: string[];
}

/** The whole plan from a description. Same words, same plan. */
export function buildPlan(text: string, id = "plan-builder"): BuiltPlan {
  const brief = readBrief(text);
  const { goal, level, setting, minutes, avoid } = brief;
  const plans = split(brief.days);
  const used = new Map<Slot, number>();
  const choose = (slot: Slot, dayUsed: Set<number>): { id: number; note?: string } | null => {
    let pool = POOL[slot][setting];
    let note: string | undefined;
    for (const a of avoid) {
      const f = FRIENDLY[a]?.[slot]?.filter((id) => canDo(id, setting));
      if (f?.length) { pool = f; note = INJURY_NOTE[a]; }
    }
    // Rotate through the pool across days so each day feels different, and never repeat within a day.
    const start = used.get(slot) ?? 0;
    for (let k = 0; k < pool.length; k++) {
      const pick = pool[(start + k) % pool.length]!;
      if (!dayUsed.has(pick)) { used.set(slot, start + k + 1); return { id: pick, note }; }
    }
    // Every swap is already in today's session: fall back to the slot's usual choices that suit the joint, else leave it out.
    const spare = POOL[slot][setting].find((id) => !dayUsed.has(id) && !avoid.some((a) => FRIENDLY[a]?.[slot] && !FRIENDLY[a]![slot]!.includes(id)));
    return spare ? { id: spare } : null;
  };
  // Time budget: a main lift takes ~10 min, an accessory pair ~8, warm-up 6, a finisher 8.
  const finisher = goal === "fatloss" || goal === "fitness";
  const accSlots = Math.max(1, Math.min(3, Math.floor((minutes - 6 - (finisher ? 8 : 0)) / 10) - 2));

  const days: TemplateDay[] = plans.map((p, i) => {
    const dayUsed = new Set<number>();
    const items: TemplateItem[] = [];
    const add = (group: string, slot: Slot | null, exerciseId: number, d: Dose, extra: Partial<TemplateItem> = {}) => {
      dayUsed.add(exerciseId);
      // Holds (planks, wall sits) are timed, not counted.
      const held = HELD.test(EXERCISES.find((e) => e.id === exerciseId)?.name ?? "");
      items.push({ group, exerciseId, sets: d.sets, reps: held && !/s$/.test(d.reps) ? "30s" : d.reps, kg: 0, rpe: d.rpe, restSeconds: d.rest, ...extra });
      void slot;
    };
    // Warm-up pair.
    const w1 = WARM_UPS[(i * 2) % WARM_UPS.length]!;
    const w2 = WARM_UPS[(i * 2 + 1) % WARM_UPS.length]!;
    add("W1", null, w1, { sets: 1, reps: "6", rpe: 5, rest: 0 }, { note: "warm-up, easy" });
    add("W2", null, w2, { sets: 1, reps: "6", rpe: 5, rest: 30 }, { note: "warm-up, easy" });
    // Main lifts: the first is heavy on its own, the rest are second lifts.
    let letter = 65;
    p.main.forEach((slot, k) => {
      const c = choose(slot, dayUsed);
      if (c) add(String.fromCharCode(letter++), slot, c.id, dose(goal, level, k === 0 ? "main" : "second"), c.note ? { note: c.note } : {});
    });
    // Accessories as supersets: C1/C2, then D1.
    const accs = p.acc.slice(0, accSlots + 1).flatMap((slot) => { const c = choose(slot, dayUsed); if (c) dayUsed.add(c.id); return c ? [{ slot, c }] : []; });
    accs.forEach(({ slot, c }, k) => {
      const d = dose(goal, level, "acc");
      const second = k % 2 === 1 || k === accs.length - 1;
      const reps = slot === "core" ? (c.id === 14 || c.id === 453 ? "30s" : "10") : d.reps;
      add(`${String.fromCharCode(letter + Math.floor(k / 2))}${(k % 2) + 1}`, slot, c.id, { ...d, reps, rest: second ? d.rest : 0 }, c.note ? { note: c.note } : {});
    });
    letter += Math.ceil(accs.length / 2);
    // Conditioning finisher, as a timed circuit.
    if (finisher) {
      const rounds = level === "beginner" ? 3 : 4;
      const a = choose("cond", dayUsed);
      if (a) add(`${String.fromCharCode(letter)}1`, "cond", a.id, { sets: rounds, reps: "30s", rpe: 8, rest: 0 }, { blockStyle: "circuit", ...(a.note ? { note: a.note } : {}) });
      const b = choose("core", dayUsed);
      if (b) add(`${String.fromCharCode(letter)}2`, "core", b.id, { sets: rounds, reps: "30s", rpe: 7, rest: 60 }, { blockStyle: "circuit" });
    }
    // A superset of one is just a lettered exercise: "D1" on its own becomes "D".
    for (const it of items) {
      const l = it.group.replace(/\d+$/, "");
      if (l !== it.group && l !== "W" && items.filter((o) => o.group.replace(/\d+$/, "") === l).length === 1) it.group = l;
    }
    return { week: 1, dayIndex: DAY_INDEX[brief.days]![i]!, name: p.name, minutes, items };
  });

  const why: string[] = [
    `${brief.days} days a week, so ${brief.days <= 3 ? "full-body days so every muscle is trained each session" : brief.days === 4 ? "an upper / lower split" : "push, pull and legs"}.`,
    `${GOAL_LABEL[goal]}: main lifts at ${dose(goal, level, "main").sets}×${dose(goal, level, "main").reps}, RPE ${dose(goal, level, "main").rpe}${finisher ? ", plus a short circuit to finish" : ""}.`,
    level === "beginner" ? "Beginner: fewer hard sets and RPE 6–7 while technique settles." : level === "advanced" ? "Advanced: an extra set on the main lifts." : "Intermediate: standard volume, close to RPE 8.",
    ...avoid.map((a) => `${INJURY_LABEL[a]}: swapped the riskier lifts and marked them on the plan.`),
    "Each week, loads move up from what the client logs (Progressions on your Brief).",
  ];

  const template: ProgramTemplate = {
    id,
    name: `${GOAL_LABEL[goal]} · ${brief.days} days`,
    note: `${LEVEL_LABEL[level]} · ${SETTING_LABEL[setting].toLowerCase()} · ${minutes} min${avoid.length ? ` · ${avoid.map((a) => INJURY_LABEL[a].toLowerCase()).join(", ")}` : ""}`,
    weeks: brief.weeks,
    days,
  };
  return { brief, template, why };
}

export const PLAN_EXAMPLES = [
  "Sarah, 34, beginner, wants to lose 6 kg. Three days a week at home with dumbbells, 45 minutes. Sore left knee.",
  "James, intermediate lifter, wants to get stronger in the big lifts. Four days a week in a full gym, an hour each.",
  "Amara, wants to build glutes and legs, trained before, 5 days a week in the gym.",
  "Ben, 52, desk job, lower back pain, wants to get fitter. Twice a week, 40 minutes, no equipment.",
];
