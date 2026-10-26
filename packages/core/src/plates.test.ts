import { describe, expect, it } from "vitest";
import { exerciseById } from "./library";
import { defaultBarFor, describePlates, loadPlates, usesPlates } from "./plates";

describe("plate calculator", () => {
  it("loads the fewest plates per side, heaviest first", () => {
    expect(loadPlates(100, 20)).toEqual({ perSide: [25, 15], totalKg: 100, shortKg: 0 });
    expect(loadPlates(142.5, 20).perSide).toEqual([25, 25, 10, 1.25]);
    expect(loadPlates(70, 25).perSide).toEqual([20, 2.5]);
  });

  it("uses the nearest lighter load when the target can't be made exactly", () => {
    expect(loadPlates(71, 20)).toEqual({ perSide: [25], totalKg: 70, shortKg: 1 });
  });

  it("shows an empty bar at or below the bar's weight", () => {
    expect(loadPlates(20, 20).perSide).toEqual([]);
    expect(loadPlates(10, 20)).toMatchObject({ perSide: [], totalKg: 20, shortKg: 0 });
    expect(loadPlates(Number.NaN, 20).perSide).toEqual([]);
    expect(describePlates([])).toBe("Empty bar");
  });

  it("only applies to plate-loaded equipment, with a heavier trap bar", () => {
    expect(usesPlates(exerciseById(15))).toBe(true);
    expect(usesPlates(exerciseById(9))).toBe(false);
    expect(defaultBarFor(exerciseById(15))).toBe(25);
    expect(defaultBarFor(exerciseById(1))).toBe(20);
  });
});
