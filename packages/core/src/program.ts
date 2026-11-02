/* Programs: weeks × training days. Pure, so the builder, both stores and templates share one set of rules.
   The selected day is still a plain Workout, so the client player and the summary work unchanged. */

import { progressWorkout } from "./progression";
import type { Program, ProgramDay, ProgramTemplate, TemplateDay, Workout, WorkoutItem } from "./types";
import { newKey } from "./workout";

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Week by week, Monday first. */
export const sortDays = (days: ProgramDay[]): ProgramDay[] => [...days].sort((a, b) => a.week - b.week || a.dayIndex - b.dayIndex);

export const daysInWeek = (program: Program, week: number): ProgramDay[] => sortDays(program.days.filter((d) => d.week === week));

/** A one-day program around an existing workout: how older saved state and single-workout data come in. */
export const programFromWorkout = (workout: Workout, key = "day-1", name = workout.name): Program => ({
  name,
  weeks: Math.max(workout.ofWeeks, workout.week),
  days: [{ ...workout, key, dayIndex: 0 }],
});

/** The day as the player and the builder see it. */
export const dayWorkout = (program: Program, day: ProgramDay): Workout => ({
  name: day.name, week: day.week, ofWeeks: program.weeks, minutes: day.minutes, items: day.items,
});

/** Writes an edited workout back into its day. */
export const withDayWorkout = (program: Program, key: string, workout: Workout): Program => ({
  ...program,
  days: program.days.map((d) => (d.key === key ? { ...d, name: workout.name, minutes: workout.minutes, items: workout.items } : d)),
});

const copyItems = (items: WorkoutItem[]): WorkoutItem[] => items.map((it) => ({ ...it, key: newKey(), ...(it.setPlan ? { setPlan: it.setPlan.map((s) => ({ ...s })) } : {}) }));

/** Adds a training day. Copies `from` when given, otherwise starts empty. Weeks grow to fit. */
export function addDay(program: Program, week: number, dayIndex: number, from?: Workout, key = newKey()): { program: Program; day: ProgramDay } {
  const day: ProgramDay = {
    key, week, dayIndex,
    name: from?.name ?? `${DAY_NAMES[dayIndex] ?? "Day"} session`,
    ofWeeks: program.weeks,
    minutes: from?.minutes ?? 45,
    items: from ? copyItems(from.items) : [],
  };
  return { program: { ...program, weeks: Math.max(program.weeks, week), days: sortDays([...program.days, day]) }, day };
}

export const removeDay = (program: Program, key: string): Program => ({ ...program, days: program.days.filter((d) => d.key !== key) });

/** First free day of the week, counting from `after`, or null when all seven are taken. */
export function freeDayIndex(program: Program, week: number, after = -1): number | null {
  const used = new Set(daysInWeek(program, week).map((d) => d.dayIndex));
  for (let n = 1; n <= 7; n++) {
    const i = (after + n + 7) % 7;
    if (!used.has(i)) return i;
  }
  return null;
}

/** Copies every day of one week into another, on the same weekdays. Days already planned there are left alone.
    With `progress`, each copied day gets next week's loads from what the client logged (progressWorkout). */
export function copyWeek(program: Program, from: number, to: number, opts: { progress?: boolean } = {}): { program: Program; added: ProgramDay[] } {
  const taken = new Set(daysInWeek(program, to).map((d) => d.dayIndex));
  const added = daysInWeek(program, from)
    .filter((d) => !taken.has(d.dayIndex))
    .map((d): ProgramDay => {
      const items = opts.progress ? progressWorkout(dayWorkout(program, d)).workout.items : d.items;
      return { ...d, key: newKey(), week: to, items: copyItems(items) };
    });
  return { program: { ...program, weeks: Math.max(program.weeks, to), days: sortDays([...program.days, ...added]) }, added };
}

/** Removes a week and closes the gap: week 3 becomes week 2, and so on. */
export function deleteWeek(program: Program, week: number): Program {
  return {
    ...program,
    weeks: Math.max(1, program.weeks - 1),
    days: program.days.filter((d) => d.week !== week).map((d) => (d.week > week ? { ...d, week: d.week - 1 } : d)),
  };
}

/** The day the client should train: today's if they already trained it (so they still see their summary),
    otherwise the first day, week by week, that has no finished session. All done → the last day. */
export function nextDayKey(program: Program, finished: Set<string>, finishedToday?: string | null): string | null {
  const days = sortDays(program.days);
  if (finishedToday && days.some((d) => d.key === finishedToday)) return finishedToday;
  return (days.find((d) => !finished.has(d.key)) ?? days.at(-1))?.key ?? null;
}

/* ---------- templates ---------- */

export function toTemplate(program: Program, name: string, id = newKey(), note?: string): ProgramTemplate {
  return {
    id, name, weeks: program.weeks,
    ...(note ? { note } : {}),
    days: sortDays(program.days).map((d): TemplateDay => ({
      week: d.week, dayIndex: d.dayIndex, name: d.name, minutes: d.minutes,
      items: d.items.map(({ key: _k, lastTime: _l, ...rest }) => rest),
    })),
  };
}

/** A fresh program from a template: new keys everywhere, no history carried over.
    A template that only plans week 1 repeats it for every week, so an 8-week template gives 8 weeks to train. */
export function fromTemplate(template: ProgramTemplate, lastTime: (exerciseId: number) => string = () => "New exercise"): Program {
  const planned = new Set(template.days.map((d) => d.week));
  const days = planned.size === 1 && planned.has(1)
    ? Array.from({ length: template.weeks }, (_, w) => template.days.map((d) => ({ ...d, week: w + 1 }))).flat()
    : template.days;
  return {
    name: template.name,
    weeks: template.weeks,
    days: sortDays(days.map((d) => ({
      key: newKey(), week: d.week, dayIndex: d.dayIndex, name: d.name, minutes: d.minutes, ofWeeks: template.weeks,
      items: d.items.map((it) => ({ ...it, key: newKey(), lastTime: lastTime(it.exerciseId), ...(it.setPlan ? { setPlan: it.setPlan.map((s) => ({ ...s })) } : {}) })),
    }))),
  };
}

/** "3 days · 8 weeks · 21 exercises" for a template card. */
export function templateSummary(t: ProgramTemplate): string {
  const perWeek = new Set(t.days.filter((d) => d.week === 1).map((d) => d.dayIndex)).size || t.days.length;
  const exercises = new Set(t.days.flatMap((d) => d.items.map((i) => i.exerciseId))).size;
  return `${perWeek} day${perWeek === 1 ? "" : "s"} a week · ${t.weeks} week${t.weeks === 1 ? "" : "s"} · ${exercises} exercises`;
}
