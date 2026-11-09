import { describe, expect, it } from "vitest";
import { DICTS, LANGS, detectLang, normaliseLang, translate } from "./i18n";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("languages", () => {
  it("translates, falls back to English and fills placeholders", () => {
    expect(translate("en", "Today")).toBe("Today");
    expect(translate("es", "Today")).toBe("Hoy");
    expect(translate("fr", "Today")).toBe("Aujourd'hui");
    expect(translate("es", "Not in any list")).toBe("Not in any list");
    expect(translate("fr", "Weight, {unit}", { unit: "lb" })).toBe("Poids, lb");
    expect(translate("en", "Weight, {unit}", { unit: "kg" })).toBe("Weight, kg");
  });

  it("has the same keys and placeholders in every language", () => {
    const [first, ...rest] = Object.values(DICTS);
    const keys = Object.keys(first!).sort();
    for (const d of rest) expect(Object.keys(d).sort()).toEqual(keys);
    for (const d of Object.values(DICTS)) {
      for (const [en, out] of Object.entries(d)) {
        expect(out.trim(), en).not.toBe("");
        expect(placeholders(out), en).toEqual(placeholders(en));
      }
    }
    expect(Object.keys(DICTS).sort()).toEqual(LANGS.filter((l) => l.id !== "en").map((l) => l.id).sort());
  });

  it("picks a supported language and defaults to English", () => {
    expect(detectLang(["es-MX", "en"])).toBe("es");
    expect(detectLang(["de-DE", "fr-CA"])).toBe("fr");
    expect(detectLang(["de-DE"])).toBe("en");
    expect(normaliseLang("fr")).toBe("fr");
    expect(normaliseLang("xx")).toBe("en");
  });
});
