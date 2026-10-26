import { describe, expect, it } from "vitest";
import { INITIAL_HISTORY, INITIAL_WORKOUT } from "./data/workout";
import { initialSets, type SessionSets } from "./session";
import { buildSummary, musclesWorked, nextHistory, personalBests, pictureWeight, summaryMessage } from "./summary";

const finishAll = (sets: SessionSets): SessionSets =>
  Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.map((s) => ({ ...s, done: true }))]));

describe("post-workout summary", () => {
  it("counts completed sets per muscle, most worked first", () => {
    const sets = initialSets(INITIAL_WORKOUT);
    expect(musclesWorked(INITIAL_WORKOUT, sets)).toEqual([]);
    const m = musclesWorked(INITIAL_WORKOUT, finishAll(sets));
    // Trap bar 4 + RDL 3 + goblet 3 all hit glutes.
    expect(m[0]).toEqual({ muscle: "Glutes", sets: 10 });
    expect(m.find((x) => x.muscle === "Core")).toEqual({ muscle: "Core", sets: 3 });
  });

  it("lists each beaten best once, with the heaviest set", () => {
    const sets = finishAll(initialSets(INITIAL_WORKOUT));
    sets.a = sets.a!.map((s, i) => ({ ...s, kg: i === 3 ? "72.5" : s.kg }));
    expect(personalBests(INITIAL_WORKOUT, sets, INITIAL_HISTORY.bestKg)).toEqual([
      { exerciseId: 15, exercise: "Trap Bar Deadlift", kg: 72.5, previousKg: 67.5 },
      { exerciseId: 9, exercise: "Goblet Squat", kg: 20, previousKg: 18 },
    ]);
  });

  it("compares with the last session and pictures the volume", () => {
    const s = buildSummary(INITIAL_WORKOUT, finishAll(initialSets(INITIAL_WORKOUT)), 44, INITIAL_HISTORY);
    expect(s.vsLast).toEqual({ volumeKg: 250, sets: 0, minutes: -2 });
    expect(s.fun).toBe("You moved 3,200 kg today, about 2.1 family cars. That's 250 kg more than last time, about 2.5 giant pandas extra.");
    expect(buildSummary(INITIAL_WORKOUT, initialSets(INITIAL_WORKOUT), 5, { bestKg: {}, previous: null }).vsLast).toBeNull();
  });

  it("pictures weights from the heaviest thing that fits", () => {
    expect(pictureWeight(10)).toBeNull();
    expect(pictureWeight(450)).toBe("about a grand piano");
    expect(pictureWeight(24000)).toBe("about 2 double-decker buses");
  });

  it("writes one message for the coach", () => {
    const sets = finishAll(initialSets(INITIAL_WORKOUT));
    const summary = buildSummary(INITIAL_WORKOUT, sets, 44, INITIAL_HISTORY);
    const text = summaryMessage({ workoutName: "Lower A", sets: 13, volumeKg: 3200, minutes: 44, rpe: 8, prs: 2, summary, note: " Hip felt good " });
    expect(text.split("\n")[0]).toBe("✅ Finished Lower A");
    expect(text).toContain("🏆 New best: Trap Bar Deadlift 70 kg (was 67.5 kg)");
    expect(text).toContain("📈 vs last time: +250 kg · ±0 sets");
    expect(text).toContain('📝 "Hip felt good"');
  });

  it("makes this session the next comparison and raises bests", () => {
    const sets = finishAll(initialSets(INITIAL_WORKOUT));
    const h = nextHistory(INITIAL_HISTORY, { workoutName: "Lower A", sets: 13, volumeKg: 3200, minutes: 44, rpe: 8, prs: 2 }, INITIAL_WORKOUT, sets);
    expect(h.previous).toEqual({ workoutName: "Lower A", sets: 13, volumeKg: 3200, minutes: 44 });
    expect(h.bestKg[15]).toBe(70);
    expect(h.bestKg[2]).toBe(50);
  });
});
