import { describe, expect, it } from "vitest";
import { createDemoActivityStore, fromRecoveryRow, toRecoveryRow } from "./activityStore";
import { sampleRecovery } from "./data/recovery";
import { baseline, bestPerDay, fromFitbit, fromGarmin, fromOura, fromPolar, fromWhoop, mergeRecovery, readinessFromWatch, vsBaseline, type RecoveryDay } from "./recovery";

const H = 3600000;

describe("Whoop", () => {
  it("puts the night, recovery and strain on the morning they belong to", () => {
    const days = fromWhoop({
      sleep: [
        { end: "2026-10-28T06:40:00Z", score_state: "SCORED", score: { stage_summary: { total_in_bed_time_milli: 8 * H, total_awake_time_milli: 0.5 * H, total_light_sleep_time_milli: 3.5 * H, total_slow_wave_sleep_time_milli: 1.5 * H, total_rem_sleep_time_milli: 2 * H }, sleep_performance_percentage: 88, respiratory_rate: 15.234 } },
        { end: "2026-10-28T14:00:00Z", nap: true, score_state: "SCORED", score: { stage_summary: { total_light_sleep_time_milli: H } } },
      ],
      recovery: [{ created_at: "2026-10-28T06:45:00Z", score_state: "SCORED", score: { recovery_score: 71, resting_heart_rate: 52, hrv_rmssd_milli: 64.27 } }],
      cycle: [{ start: "2026-10-27T06:30:00Z", end: "2026-10-28T06:40:00Z", score_state: "SCORED", score: { strain: 13.41 } }],
    }, (iso) => iso.slice(0, 10));
    expect(days).toEqual([{
      date: "2026-10-28", source: "whoop", sleepMinutes: 420, stages: { deep: 90, rem: 120, light: 210, awake: 30 }, sleepScore: 88, respiratoryRate: 15.2,
      recoveryScore: 71, restingHr: 52, hrvMs: 64.3, strain: 13.4,
    }]);
  });

  it("skips anything Whoop hasn't scored yet", () => {
    expect(fromWhoop({ recovery: [{ created_at: "2026-10-28T06:45:00Z", score_state: "PENDING_SCORE" }] })).toEqual([]);
  });
});

describe("Oura", () => {
  it("joins sleep, readiness, activity and stress by day", () => {
    const [d] = fromOura({
      daily_sleep: [{ day: "2026-10-28", score: 81 }],
      sleep: [
        { day: "2026-10-28", type: "long_sleep", total_sleep_duration: 26400, deep_sleep_duration: 4800, rem_sleep_duration: 6000, light_sleep_duration: 15600, awake_time: 1800, average_hrv: 58, lowest_heart_rate: 50 },
        { day: "2026-10-28", type: "late_nap", total_sleep_duration: 1200 },
      ],
      daily_readiness: [{ day: "2026-10-28", score: 77 }],
      daily_activity: [{ day: "2026-10-28", steps: 9120 }],
      daily_stress: [{ day: "2026-10-28", stress_high: 3600, recovery_high: 10800 }],
    });
    expect(d).toEqual({ date: "2026-10-28", source: "oura", sleepScore: 81, sleepMinutes: 440, stages: { deep: 80, rem: 100, light: 260, awake: 30 }, hrvMs: 58, restingHr: 50, recoveryScore: 77, steps: 9120, stress: 25 });
  });
});

describe("Garmin, Fitbit, Polar", () => {
  it("reads Garmin dailies, sleep and HRV, ignoring a missing stress reading", () => {
    const [d] = fromGarmin({
      dailies: [{ calendarDate: "2026-10-28", restingHeartRateInBeatsPerMinute: 49, averageStressLevel: -1, steps: 10400, bodyBatteryHighestValue: 84 }],
      sleeps: [{ calendarDate: "2026-10-28", durationInSeconds: 27000, deepSleepDurationInSeconds: 5400, lightSleepDurationInSeconds: 14400, remSleepInSeconds: 6000, awakeDurationInSeconds: 1200, overallSleepScore: { value: 83 } }],
      hrv: [{ calendarDate: "2026-10-28", lastNightAvg: 61 }],
    });
    expect(d).toEqual({ date: "2026-10-28", source: "garmin", restingHr: 49, steps: 10400, recoveryScore: 84, sleepMinutes: 430, stages: { deep: 90, rem: 100, light: 240, awake: 20 }, sleepScore: 83, hrvMs: 61 });
  });

  it("reads Fitbit's main sleep only and skips unworn days", () => {
    const days = fromFitbit({
      sleep: [{ dateOfSleep: "2026-10-28", isMainSleep: true, minutesAsleep: 401, levels: { summary: { deep: { minutes: 70 }, rem: { minutes: 90 }, light: { minutes: 241 }, wake: { minutes: 40 } } } }, { dateOfSleep: "2026-10-28", isMainSleep: false, minutesAsleep: 30 }],
      hrv: [{ dateTime: "2026-10-28", value: { dailyRmssd: 41.26 } }],
      "activities-heart": [{ dateTime: "2026-10-28", value: { restingHeartRate: 58 } }],
      "activities-steps": [{ dateTime: "2026-10-28", value: "7012" }, { dateTime: "2026-10-27", value: "0" }],
    });
    expect(days).toEqual([{ date: "2026-10-28", source: "fitbit", sleepMinutes: 401, stages: { deep: 70, rem: 90, light: 241, awake: 40 }, hrvMs: 41.3, restingHr: 58, steps: 7012 }]);
  });

  it("turns Polar's Nightly Recharge status into 0–100", () => {
    const [d] = fromPolar({ nights: [{ date: "2026-10-28", light_sleep: 14400, deep_sleep: 5400, rem_sleep: 5400, total_interruption_duration: 1800, sleep_score: 79 }], recharges: [{ date: "2026-10-28", heart_rate_avg: 53, heart_rate_variability_avg: 47, nightly_recharge_status: 5 }] });
    expect(d).toMatchObject({ sleepMinutes: 420, sleepScore: 79, hrvMs: 47, restingHr: 53, recoveryScore: 80 });
  });
});

const day = (date: string, extra: Partial<RecoveryDay>): RecoveryDay => ({ date, source: "fitbit", ...extra });
const twoWeeks = (hrv: number, rhr = 55) => Array.from({ length: 14 }, (_, k) => day(`2026-10-${String(27 - k).padStart(2, "0")}`, { hrvMs: hrv + (k % 2 ? 3 : -3), restingHr: rhr }));

describe("baselines and merging", () => {
  it("averages the two weeks before the day, not the day itself", () => {
    const b = baseline([...twoWeeks(60), day("2026-10-28", { hrvMs: 20 })], "hrvMs", "2026-10-28");
    expect(b).toMatchObject({ mean: 60, n: 14 });
    expect(b!.sd).toBeCloseTo(3);
    expect(vsBaseline(66, b)).toBe(10);
    expect(baseline([day("2026-10-27", { hrvMs: 50 })], "hrvMs", "2026-10-28")).toBeNull();
  });

  it("prefers the watch over a hand-typed morning, and fills gaps from the other source", () => {
    const [d] = bestPerDay([{ date: "2026-10-28", source: "manual", sleepMinutes: 400, steps: 5000 }, { date: "2026-10-28", source: "oura", sleepMinutes: 432, hrvMs: 60 }]);
    expect(d).toEqual({ date: "2026-10-28", source: "oura", sleepMinutes: 432, hrvMs: 60, steps: 5000 });
  });

  it("updates a morning that syncs again", () => {
    const m = mergeRecovery([day("2026-10-28", { sleepMinutes: 400 })], [day("2026-10-28", { hrvMs: 55 })]);
    expect(m).toEqual([day("2026-10-28", { sleepMinutes: 400, hrvMs: 55 })]);
  });
});

describe("readinessFromWatch", () => {
  it("scores sleep by hours and energy by the provider's recovery", () => {
    const s = readinessFromWatch([{ date: "2026-10-28", source: "whoop", sleepMinutes: 370, recoveryScore: 35 }], "2026-10-28")!;
    expect(s.answers).toEqual({ sleep: 3, energy: 2 });
    expect(s.why.sleep).toBe("6 h 10 m asleep");
    expect(s.why.energy).toBe("Recovery 35");
    expect(s.answers.soreness).toBeUndefined();
  });

  it("falls back to HRV against the client's own usual, with resting heart rate as a check", () => {
    const low = readinessFromWatch([...twoWeeks(60), day("2026-10-28", { hrvMs: 50, restingHr: 62 })], "2026-10-28")!;
    expect(low.answers.energy).toBe(1);
    expect(low.why.energy).toBe("HRV 50 ms, 17% below usual; resting HR 7 bpm up");
    const good = readinessFromWatch([...twoWeeks(60), day("2026-10-28", { hrvMs: 64, restingHr: 54 })], "2026-10-28")!;
    expect(good.answers.energy).toBe(5);
  });

  it("maps daytime stress and says nothing without data", () => {
    expect(readinessFromWatch([{ date: "2026-10-28", source: "garmin", stress: 55 }], "2026-10-28")!.answers).toEqual({ stress: 2 });
    expect(readinessFromWatch([], "2026-10-28")).toBeNull();
    expect(readinessFromWatch([day("2026-10-28", { steps: 9000 })], "2026-10-28")).toBeNull();
  });
});

describe("rows and demo", () => {
  it("round-trips through a database row", () => {
    const d: RecoveryDay = { date: "2026-10-28", source: "oura", sleepMinutes: 440, stages: { deep: 80, rem: 100, light: 260, awake: 30 }, hrvMs: 58.5, restingHr: 50, stress: 25 };
    expect(fromRecoveryRow(toRecoveryRow(d, "c"))).toEqual(d);
  });

  it("gives the demo four weeks of mornings and a connected ring", () => {
    const s = createDemoActivityStore(null, new Date(2026, 9, 29, 8));
    expect(s.get().recovery).toHaveLength(28);
    expect(s.get().connections[0]?.provider).toBe("oura");
    expect(readinessFromWatch(sampleRecovery(new Date(2026, 9, 29, 8)), "2026-10-29")?.answers.sleep).toBeGreaterThan(0);
  });
});

describe("connecting", () => {
  it("builds each provider's sign-in link and reads the state back", async () => {
    const { wearableAuthorizeUrl, providerFromState, connectState } = await import("./wearables");
    const u = new URL(wearableAuthorizeUrl("whoop", "abc", "https://x.app/client/", connectState("whoop", "123456789")));
    expect(u.origin + u.pathname).toBe("https://api.prod.whoop.com/oauth/oauth2/auth");
    expect(u.searchParams.get("scope")).toContain("read:recovery");
    expect(providerFromState(u.searchParams.get("state"))).toBe("whoop");
    expect(providerFromState("someone-else")).toBeNull();
  });
});
