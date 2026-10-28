import type { ProgramTemplate, TemplateDay } from "../types";

/* APEX starter templates: original programs a new coach can assign on day one and edit.
   Week 1 is planned; applying a template repeats it for every week (see fromTemplate). */

type Row = [group: string, exerciseId: number, sets: number, reps: string, rpe: number, rest: number];

const day = (dayIndex: number, name: string, minutes: number, rows: Row[], circuit = false): TemplateDay => ({
  week: 1, dayIndex, name, minutes,
  items: rows.map(([group, exerciseId, sets, reps, rpe, restSeconds]) => ({
    group, exerciseId, sets, reps, kg: 0, rpe, restSeconds, ...(circuit && group.length > 1 ? { blockStyle: "circuit" as const } : {}),
  })),
});

export const STARTER_TEMPLATES: ProgramTemplate[] = [
  {
    id: "starter-foundations", starter: true, name: "Foundations · full body", weeks: 6,
    note: "New lifters: three full-body days, one main lift each, simple supersets.",
    days: [
      day(0, "Full body A", 45, [["A", 9, 3, "10", 7, 90], ["B1", 11, 3, "10", 7, 0], ["B2", 12, 3, "12", 7, 75], ["C1", 8, 3, "12", 7, 0], ["C2", 14, 3, "30s", 7, 60]]),
      day(2, "Full body B", 45, [["A", 2, 3, "10", 7, 90], ["B1", 5, 3, "10", 7, 0], ["B2", 132, 3, "10", 7, 75], ["C1", 109, 3, "8", 7, 0], ["C2", 426, 3, "10", 7, 60]]),
      day(4, "Full body C", 45, [["A", 10, 3, "12", 7, 90], ["B1", 3, 3, "10", 7, 0], ["B2", 6, 3, "10", 7, 75], ["C1", 7, 3, "15", 7, 0], ["C2", 13, 3, "15", 7, 60]]),
    ],
  },
  {
    id: "starter-upper-lower", starter: true, name: "Upper / lower · strength", weeks: 8,
    note: "Intermediate: four days, heavy compound first, accessories as supersets.",
    days: [
      day(0, "Lower A · strength", 60, [["A", 1, 4, "5", 8, 180], ["B", 2, 3, "8", 8, 120], ["C1", 109, 3, "8", 8, 0], ["C2", 74, 3, "10", 8, 75], ["D", 54, 3, "12", 8, 60]]),
      day(1, "Upper A · strength", 60, [["A", 120, 4, "5", 8, 180], ["B", 6, 4, "6", 8, 120], ["C1", 5, 3, "8", 8, 0], ["C2", 12, 3, "10", 8, 75], ["D1", 28, 3, "12", 8, 0], ["D2", 16, 3, "12", 8, 60]]),
      day(3, "Lower B · volume", 55, [["A", 15, 4, "6", 8, 150], ["B", 10, 3, "10-12", 8, 90], ["C1", 8, 3, "10", 8, 0], ["C2", 73, 3, "12", 8, 60], ["D", 14, 3, "40s", 7, 60]]),
      day(4, "Upper B · volume", 55, [["A", 123, 4, "8-10", 8, 120], ["B", 127, 4, "6-8", 8, 120], ["C1", 7, 3, "15", 8, 0], ["C2", 13, 3, "15", 8, 60], ["D1", 26, 3, "12", 8, 0], ["D2", 18, 3, "12", 8, 60]]),
    ],
  },
  {
    id: "starter-conditioning", starter: true, name: "Conditioning circuits", weeks: 4,
    note: "Fat loss and fitness: two timed circuits and one strength day.",
    days: [
      day(0, "Circuit A · 40 on / 20 off", 35, [["A1", 140, 4, "40s", 8, 0], ["A2", 209, 4, "40s", 8, 0], ["A3", 9, 4, "40s", 8, 0], ["A4", 431, 4, "40s", 8, 0], ["A5", 159, 4, "40s", 8, 90]], true),
      day(2, "Strength", 45, [["A", 15, 4, "6", 8, 150], ["B1", 11, 3, "10", 8, 0], ["B2", 132, 3, "10", 8, 75], ["C", 46, 3, "40s", 8, 60]]),
      day(4, "Circuit B · giant set", 35, [["A1", 139, 4, "12", 8, 0], ["A2", 184, 4, "8", 8, 0], ["A3", 164, 4, "30s", 8, 0], ["A4", 14, 4, "40s", 8, 90]], true),
    ],
  },
];
