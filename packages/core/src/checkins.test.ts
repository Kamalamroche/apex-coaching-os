import { describe, expect, it } from "vitest";
import {
  changeOver, checkInDue, checkInFlags, compareCheckIns, fitWithin, measurementSeries, parseNumber, photoPath, photoSets, signed,
  toCheckIn, toCheckInRow, toMeasurement, toMeasurementRow, weekday, type CheckIn, type CheckInRow, type ProgressPhoto,
} from "./checkins";
import { INITIAL_PROGRESS } from "./data/progress";
import { createDemoStore } from "./store";

const ci = (over: Partial<CheckIn> = {}): CheckIn => ({
  id: "c", submittedAt: "2026-10-25T09:00:00Z", weightKg: 62, sleepHours: 7, energy: 4, mood: 4, stress: 2, hunger: 3, training: 4, nutrition: 4,
  wins: "", struggles: "", note: "", coachReply: null, reviewedAt: null, ...over,
});

describe("checkInDue", () => {
  // Monday 26 October 2026, midday local time
  const monday = new Date(2026, 9, 26, 12);

  it("uses Monday = 0", () => {
    expect(weekday(monday)).toBe(0);
    expect(weekday(new Date(2026, 9, 25))).toBe(6);
  });

  it("is due on the day when nothing has been sent this week", () => {
    const d = checkInDue(new Date(2026, 9, 19, 9).toISOString(), 0, monday);
    expect(d).toMatchObject({ due: true, daysLate: 0 });
    expect(d.dueOn.getDate()).toBe(26);
  });

  it("counts a check-in sent the evening before", () => {
    expect(checkInDue(new Date(2026, 9, 25, 20).toISOString(), 0, monday).due).toBe(false);
  });

  it("stays due and counts days late", () => {
    // due Saturday 24th, now Monday 26th
    expect(checkInDue(new Date(2026, 9, 17, 9).toISOString(), 5, monday)).toMatchObject({ due: true, daysLate: 2 });
    expect(checkInDue(new Date(2026, 9, 24, 9).toISOString(), 5, monday).due).toBe(false);
  });

  it("is due straight away for a first check-in", () => {
    expect(checkInDue(null, 3, monday).due).toBe(true);
  });
});

describe("measurements", () => {
  it("builds a series oldest first and skips gaps", () => {
    const s = measurementSeries(INITIAL_PROGRESS.measurements, "waistCm");
    expect(s.map((p) => p.value)).toEqual([74, 72.5]);
    expect(changeOver(s)).toEqual({ first: 74, last: 72.5, delta: -1.5 });
    expect(changeOver([])).toBeNull();
  });

  it("formats signed changes without float noise", () => {
    expect(signed(62.3 - 63.1)).toBe("−0.8");
    expect(signed(1.25)).toBe("+1.3");
    expect(signed(0)).toBe("0");
  });

  it("round-trips through database rows, reading numeric strings", () => {
    const row = { ...toMeasurementRow({ weightKg: 62.4, waistCm: 72 }, "u", "m1", "c1"), measured_at: "2026-10-25T09:00:00Z" };
    expect(row).toMatchObject({ weight_kg: 62.4, waist_cm: 72, hips_cm: null, check_in_id: "c1" });
    const back = toMeasurement({ ...row, weight_kg: "62.40" });
    expect(back).toMatchObject({ weightKg: 62.4, waistCm: 72, hipsCm: null, checkInId: "c1" });
  });
});

describe("check-in rows", () => {
  it("round-trips and drops empty text", () => {
    const { id: _i, submittedAt: _s, coachReply: _c, reviewedAt: _r, ...input } = ci({ wins: "  PB on squat ", note: "   " });
    const row = toCheckInRow(input, "u", "c1");
    expect(row).toMatchObject({ client_id: "u", wins: "PB on squat", note: null, weight_kg: 62 });
    const full: CheckInRow = { ...row, submitted_at: "2026-10-25T09:00:00Z", coach_reply: null, reviewed_at: null, weight_kg: "62.00", sleep_hours: "7.0" };
    expect(toCheckIn(full)).toMatchObject({ id: "c1", weightKg: 62, sleepHours: 7, wins: "PB on squat", note: "" });
  });
});

describe("flags and comparison", () => {
  it("is quiet for a normal week", () => {
    expect(checkInFlags(ci(), ci({ weightKg: 62.2 }))).toEqual([]);
  });

  it("flags poor sleep, stress, an energy drop and fast weight change", () => {
    const flags = checkInFlags(ci({ sleepHours: 5, stress: 5, energy: 2, weightKg: 60 }), ci({ energy: 4, weightKg: 62 }));
    expect(flags.map((f) => f.text)).toEqual([
      "Sleeping 5 h a night (under 6 h)",
      "Stress 5/5",
      "Energy dropped from 4 to 2",
      "Weight −2 kg since last check-in (−3.2%)",
    ]);
    expect(flags[1]?.severity).toBe("crit");
  });

  it("compares with the previous check-in", () => {
    const rows = compareCheckIns(ci({ weightKg: 61.6, energy: 5 }), ci());
    expect(rows[0]).toEqual({ label: "Weight", now: "61.6 kg", change: "−0.4" });
    expect(rows.find((r) => r.label === "Energy")).toEqual({ label: "Energy", now: "5/5", change: "+1" });
    expect(compareCheckIns(ci())[0]?.change).toBeNull();
  });
});

describe("photos", () => {
  const p = (id: string, pose: ProgressPhoto["pose"], takenAt: string, checkInId: string | null): ProgressPhoto => ({ id, pose, takenAt, checkInId, path: id, url: null });

  it("groups by check-in, or by day for loose photos, oldest first", () => {
    const sets = photoSets([
      p("3", "front", "2026-10-25T09:00:00Z", "b"),
      p("1", "front", "2026-10-04T09:00:00Z", "a"),
      p("2", "side", "2026-10-04T09:01:00Z", "a"),
      p("4", "back", "2026-10-26T18:00:00Z", null),
    ]);
    expect(sets.map((s) => s.key)).toEqual(["a", "b", "2026-10-26"]);
    expect(Object.keys(sets[0]!.byPose)).toEqual(["front", "side"]);
  });

  it("stores each photo under the client's own folder", () => {
    expect(photoPath("u1", "side", "x")).toBe("u1/x-side.jpg");
  });

  it("scales down to fit, never up", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe("parseNumber", () => {
  it("accepts a decimal comma and rejects junk", () => {
    expect(parseNumber("62,4")).toBe(62.4);
    expect(parseNumber(" ")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });
});

describe("demo store progress", () => {
  it("adds a check-in with its measurements and photos, and takes the coach's reply", async () => {
    const store = createDemoStore(null, null);
    const before = store.get().progress;
    const { id: _i, submittedAt: _s, coachReply: _c, reviewedAt: _r, ...input } = ci();
    await store.submitCheckIn(input, { waistCm: 71.5 }, [{ pose: "front", file: new Blob(), preview: "data:image/jpeg;base64,x" }]);
    const after = store.get().progress;
    expect(after.checkIns).toHaveLength(before.checkIns.length + 1);
    const added = after.checkIns[0]!;
    expect(after.measurements.at(-1)).toMatchObject({ waistCm: 71.5, checkInId: added.id });
    expect(after.photos).toEqual([expect.objectContaining({ checkInId: added.id, pose: "front", url: "data:image/jpeg;base64,x" })]);

    await store.reviewCheckIn(added.id, "Great week");
    expect(store.get().progress.checkIns[0]).toMatchObject({ coachReply: "Great week" });
    expect(store.get().progress.checkIns[0]?.reviewedAt).not.toBeNull();
  });

  it("skips an empty measurement log", async () => {
    const store = createDemoStore(null, null);
    const n = store.get().progress.measurements.length;
    await store.logMeasurements({ waistCm: null });
    expect(store.get().progress.measurements).toHaveLength(n);
  });
});
