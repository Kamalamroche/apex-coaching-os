import { describe, expect, it } from "vitest";
import { CLIENT_FEATURES, cleanHidden, featureOn, featuresSummary, toggleFeature } from "./clientFeatures";

describe("client feature switches", () => {
  it("has everything on by default", () => {
    expect(CLIENT_FEATURES.every((f) => featureOn([], f.key))).toBe(true);
    expect(featuresSummary([])).toBe("Everything on");
  });
  it("turns a feature off and on again", () => {
    const off = toggleFeature([], "nutrition");
    expect(off).toEqual(["nutrition"]);
    expect(featureOn(off, "nutrition")).toBe(false);
    expect(featureOn(off, "habits")).toBe(true);
    expect(toggleFeature(off, "nutrition")).toEqual([]);
  });
  it("drops unknown keys and duplicates, keeping list order", () => {
    expect(cleanHidden(["invite", "nope", "habits", "habits", 3])).toEqual(["habits", "invite"]);
    expect(cleanHidden(null)).toEqual([]);
  });
  it("summarises for the coach", () => {
    expect(featuresSummary(["habits", "goals", "old"])).toBe(`2 of ${CLIENT_FEATURES.length} hidden`);
  });
});
