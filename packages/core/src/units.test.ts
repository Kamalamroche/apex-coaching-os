import { describe, expect, it } from "vitest";
import { formatDistance, formatPace, splitsIn, type Activity } from "./activity";
import { loadPlates } from "./plates";
import {
  IMPERIAL, METRIC, PLATES_LB, feetInches, formatHeight, formatLength, formatWeight, formatWeightDelta, fromFeetInches, lengthFromCm, lengthToCm,
  kgTextIn, kmTextIn, metricTextIn, normaliseUnits, parseDecimal, weightFromKg, weightToKg,
} from "./units";

describe("units", () => {
  it("keeps kg as the default and fills in anything missing", () => {
    expect(normaliseUnits(undefined)).toEqual(METRIC);
    expect(normaliseUnits({ weight: "lb" })).toEqual({ weight: "lb", length: "cm", distance: "km" });
    expect(normaliseUnits({ weight: "stone", length: "in", distance: "mi" })).toEqual({ weight: "kg", length: "in", distance: "mi" });
    expect(normaliseUnits(IMPERIAL)).toEqual(IMPERIAL);
  });

  it("shows kg unchanged and converts to lb", () => {
    expect(formatWeight(100, "kg")).toBe("100 kg");
    expect(formatWeight(102.5, "kg")).toBe("102.5 kg");
    expect(formatWeight(100, "lb")).toBe("220.5 lb");
    expect(formatWeight(10090, "kg")).toBe("10,090 kg");
    expect(formatWeightDelta(2.5, "kg")).toBe("+2.5 kg");
    expect(formatWeightDelta(-0.5, "lb")).toBe("−1.1 lb");
    expect(formatWeightDelta(0, "kg")).toBe("0 kg");
  });

  it("round-trips what a person types in lb through the two-place kg column", () => {
    for (const lb of [45, 135, 225, 315, 152.4, 2.5]) {
      const kg = weightToKg(lb, "lb");
      expect(Math.round(kg * 100) / 100).toBe(kg);
      expect(weightFromKg(kg, "lb")).toBe(lb);
    }
    expect(weightToKg(72.5, "kg")).toBe(72.5);
  });

  it("converts body measurements and height", () => {
    expect(lengthFromCm(81.3, "in")).toBe(32);
    expect(lengthToCm(32, "in")).toBe(81.3);
    expect(lengthFromCm(lengthToCm(32, "in"), "in")).toBe(32);
    expect(formatLength(80, "cm")).toBe("80 cm");
    expect(feetInches(180)).toEqual({ ft: 5, in: 11 });
    expect(feetInches(182.9)).toEqual({ ft: 6, in: 0 });
    expect(fromFeetInches(5, 11)).toBe(180.3);
    expect(formatHeight(180, "in")).toBe("5 ft 11 in");
    expect(formatHeight(180.4, "cm")).toBe("180 cm");
  });

  it("reads commas as decimal points", () => {
    expect(parseDecimal("72,5")).toBe(72.5);
    expect(parseDecimal(" 80 ")).toBe(80);
    expect(parseDecimal("abc")).toBeNaN();
  });

  it("formats distance and pace in miles without changing the km defaults", () => {
    expect(formatDistance(5620, "run")).toBe("5.62 km");
    expect(formatDistance(5620, "run", "mi")).toBe("3.49 mi");
    expect(formatDistance(800, "run")).toBe("800 m");
    expect(formatDistance(1500, "swim", "mi")).toBe("1,500 m");
    expect(formatPace(1000, 300, "run")).toBe("5:00 /km");
    expect(formatPace(1609.344, 480, "run", "mi")).toBe("8:00 /mi");
    expect(formatPace(10000, 1200, "ride")).toBe("30.0 km/h");
    expect(formatPace(10000, 1200, "ride", "mi")).toBe("18.6 mph");
    expect(formatPace(500, 120, "row", "mi")).toBe("2:00 /500 m");
  });

  it("rewrites kg figures inside saved text", () => {
    expect(kgTextIn("80 kg × 8", "kg")).toBe("80 kg × 8");
    expect(kgTextIn("80 kg × 8", "lb")).toBe("176.4 lb × 8");
    expect(kgTextIn("4 sets · top 72.5 kg · 1,405 kg lifted", "lb")).toBe("4 sets · top 159.8 lb · 3,097 lb lifted");
    expect(kgTextIn("e1RM 96 → 95 kg", "lb")).toBe("e1RM 96 → 209.4 lb");
    expect(kgTextIn("2 kgs", "lb")).toBe("2 kgs");
  });

  it("rewrites km, paces and speeds inside saved text", () => {
    expect(kmTextIn("12.4 km run", "km")).toBe("12.4 km run");
    expect(kmTextIn("12.4 km run", "mi")).toBe("7.7 mi run");
    expect(kmTextIn("5:00 /km", "mi")).toBe("8:03 /mi");
    expect(kmTextIn("24.1 km/h", "mi")).toBe("15 mph");
    expect(kmTextIn("1,500 m swim", "mi")).toBe("1,500 m swim");
    expect(metricTextIn("4 workouts · 10,090 kg · 5 km run", IMPERIAL)).toBe("4 workouts · 22,245 lb · 3.1 mi run");
  });

  it("re-splits a run by the mile from its profile", () => {
    // 5 km at a steady 5:00 /km, one point every 100 m.
    const profile = Array.from({ length: 51 }, (_, i) => ({ m: i * 100, s: i * 30, hr: 150 }));
    const run = { sport: "run", metres: 5000, movingSeconds: 1500, detail: { profile, splits: [{ n: 1, metres: 1000, seconds: 300 }] } } as unknown as Activity;
    expect(splitsIn(run, "km")).toEqual([{ n: 1, metres: 1000, seconds: 300 }]);
    const miles = splitsIn(run, "mi");
    expect(miles.length).toBe(4);
    expect(miles[0]).toMatchObject({ n: 1, metres: 1609, seconds: 483, avgHr: 150 });
    expect(miles.at(-1)!.metres).toBe(172);
  });

  it("loads lb plates on a 45 lb bar", () => {
    expect(loadPlates(225, 45, PLATES_LB).perSide).toEqual([45, 45]);
    expect(loadPlates(185, 45, PLATES_LB).perSide).toEqual([45, 25]);
  });
});
