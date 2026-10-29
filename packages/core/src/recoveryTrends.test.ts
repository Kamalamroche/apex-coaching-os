import { describe, expect, it } from "vitest";
import { sampleRecovery } from "./data/recovery";
import { fromOura, type RecoveryDay } from "./recovery";
import {
  clockLabel, clockMinutes, contributors, fitbitHypnogram, hypnoRuns, loadAndRecovery, loadByDay, loadEffect, morningLine, ouraHypnogram, shiftDate, sleepSchedule, stagesFromHypnogram,
} from "./recoveryTrends";

const day = (date: string, extra: Partial<RecoveryDay> = {}): RecoveryDay => ({ date, source: "oura", ...extra });

describe("hypnogram", () => {
  it("joins five-minute steps into runs", () => {
    expect(hypnoRuns("aallldr")).toEqual([
      { stage: "awake", start: 0, minutes: 10 },
      { stage: "light", start: 10, minutes: 15 },
      { stage: "deep", start: 25, minutes: 5 },
      { stage: "rem", start: 30, minutes: 5 },
    ]);
    expect(stagesFromHypnogram("aallldr")).toEqual({ awake: 10, light: 15, deep: 5, rem: 5 });
  });

  it("reads Oura's phase codes, also through fromOura", () => {
    expect(ouraHypnogram("41123")).toBe("addlr");
    const [d] = fromOura({ sleep: [{ day: "2026-10-28", type: "long_sleep", bedtime_start: "2026-10-27T22:40:00+00:00", bedtime_end: "2026-10-28T06:40:00+00:00", sleep_phase_5_min: "4112" }] });
    expect(d).toMatchObject({ bedtime: "2026-10-27T22:40:00+00:00", wakeTime: "2026-10-28T06:40:00+00:00", hypnogram: "addl" });
  });

  it("samples Fitbit's level runs every five minutes", () => {
    const h = fitbitHypnogram([
      { dateTime: "2026-10-27T23:00:00", level: "wake", seconds: 600 },
      { dateTime: "2026-10-27T23:10:00", level: "deep", seconds: 900 },
      { dateTime: "2026-10-27T23:25:00", level: "rem", seconds: 300 },
    ], "2026-10-27T23:00:00");
    expect(h).toBe("aadddr");
  });
});

describe("contributors", () => {
  const history = [...Array(14)].map((_, i) => day(shiftDate("2026-10-28", -1 - i), { sleepMinutes: 450 + (i % 2) * 20, hrvMs: 60 + (i % 3), restingHr: 52 + (i % 2), bedtime: `2026-10-${String(13 + (13 - i)).padStart(2, "0")}T22:${i % 2 ? "40" : "50"}:00` }));

  it("turns each number so that positive is better", () => {
    const list = contributors([...history, day("2026-10-28", { sleepMinutes: 380, hrvMs: 72, restingHr: 58, bedtime: "2026-10-27T23:50:00" })], "2026-10-28");
    const by = Object.fromEntries(list.map((c) => [c.key, c]));
    expect(by.sleep!.score).toBeLessThan(0);
    expect(by.hrv!.score).toBeGreaterThan(0);
    expect(by.rhr!.score).toBeLessThan(0);
    expect(by.rhr!.note).toBe("6 bpm above usual");
    expect(by.timing!.note).toBe("65 min later than usual");
    expect(list.every((c) => Math.abs(c.score) <= 2.5)).toBe(true);
  });

  it("counts a much harder day than usual against recovery, and a rest day as neutral to good", () => {
    const load = new Map([[shiftDate("2026-10-28", -5), 300], [shiftDate("2026-10-28", -8), 250]]);
    const today = day("2026-10-28", { hrvMs: 60 });
    const rest = contributors([...history, today], "2026-10-28", load).find((c) => c.key === "load")!;
    expect(rest).toMatchObject({ value: "Rest day", note: "a rest day" });
    expect(rest.score).toBeGreaterThan(0);
    load.set("2026-10-27", 700);
    const hard = contributors([...history, today], "2026-10-28", load).find((c) => c.key === "load")!;
    expect(hard.note).toBe("well above usual");
    expect(hard.score).toBeLessThan(0);
  });

  it("says it in one line", () => {
    expect(morningLine([{ key: "hrv", label: "HRV", value: "", score: 1.2, note: "12% above usual" }, { key: "sleep", label: "Sleep", value: "", score: -1.4, note: "18% below usual" }]))
      .toBe("HRV is 12% above usual, but sleep is 18% below usual.");
    expect(morningLine([{ key: "hrv", label: "HRV", value: "", score: 1.2, note: "12% above usual" }, { key: "sleep", label: "Sleep", value: "", score: 0, note: "your usual" }]))
      .toBe("Everything is at or above your usual, and HRV is 12% above usual.");
  });
});

describe("training load", () => {
  it("sums minutes × effort per day, five when not given", () => {
    const m = loadByDay([{ date: "2026-10-27", minutes: 40, rpe: 7 }, { date: "2026-10-27", minutes: 20 }, { date: "2026-10-26", minutes: 0, rpe: 9 }]);
    expect([...m]).toEqual([["2026-10-27", 380]]);
  });

  it("lines up load with the next mornings and finds how HRV answers hard days", () => {
    const days: RecoveryDay[] = [];
    const load = new Map<string, number>();
    for (let i = 0; i < 18; i++) {
      const date = shiftDate("2026-10-28", -i);
      const hardBefore = i % 3 === 0;
      if (hardBefore) load.set(shiftDate(date, -1), 500);
      else if (i % 3 === 1) load.set(shiftDate(date, -1), 150);
      days.push(day(date, { hrvMs: hardBefore ? 50 : 60, recoveryScore: 70 }));
    }
    const series = loadAndRecovery(days, load, "2026-10-28", 7);
    expect(series).toHaveLength(7);
    expect(series[6]).toMatchObject({ date: "2026-10-28", recoveryScore: 70 });
    const e = loadEffect(days, load)!;
    expect(e.hrvPct).toBe(-17);
    expect(e.hardDays).toBe(6);
  });

  it("stays quiet with too little to go on", () => {
    expect(loadEffect([day("2026-10-28", { hrvMs: 50 })], new Map([["2026-10-27", 300]]))).toBeNull();
  });
});

describe("sleep schedule", () => {
  it("puts times either side of midnight next to each other", () => {
    expect(clockLabel(clockMinutes("2026-10-27T23:30:00"))).toBe("23:30");
    expect(clockMinutes("2026-10-28T00:30:00") - clockMinutes("2026-10-27T23:30:00")).toBe(60);
  });

  it("averages bed and wake times and their spread", () => {
    const s = sleepSchedule(sampleRecovery(new Date(2026, 9, 28, 9)))!;
    expect(s.nights).toHaveLength(14);
    expect(s.nights[0]!.date < s.nights[13]!.date).toBe(true);
    expect(clockLabel(s.bed)).toMatch(/^2[23]:/);
    expect(s.bedSpread).toBeGreaterThan(0);
  });
});

describe("sample nights", () => {
  it("have stage totals that match their timeline", () => {
    for (const d of sampleRecovery(new Date(2026, 9, 28, 9))) {
      expect(stagesFromHypnogram(d.hypnogram!)).toEqual(d.stages);
      expect(d.sleepMinutes).toBe(d.stages!.deep + d.stages!.rem + d.stages!.light);
    }
  });
});
