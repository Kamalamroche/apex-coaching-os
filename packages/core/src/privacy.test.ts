import { describe, expect, it } from "vitest";
import {
  LEGAL_VERSION, deleteConfirmed, deletionEffects, exportFileName, fromConsentRow, healthWithdrawn, legalDateLabel, missingConsents, missingLegalDetails,
  privacyPolicy, requiredConsents, termsOfUse, type ConsentRecord,
} from "./privacy";

const rec = (kind: ConsentRecord["kind"], extra: Partial<ConsentRecord> = {}): ConsentRecord => ({ kind, version: LEGAL_VERSION, givenAt: "2026-11-03T10:00:00Z", withdrawnAt: null, ...extra });

describe("consents", () => {
  it("asks clients for health consent and coaches for their duty of care", () => {
    expect(requiredConsents("client")).toEqual(["terms", "adult", "health"]);
    expect(requiredConsents("coach")).toEqual(["terms", "adult", "coach_duty"]);
  });

  it("only counts current, unwithdrawn agreements", () => {
    expect(missingConsents("client", [])).toEqual(["terms", "adult", "health"]);
    expect(missingConsents("client", [rec("terms"), rec("adult"), rec("health")])).toEqual([]);
    expect(missingConsents("client", [rec("terms", { version: "2020-01-01" }), rec("adult"), rec("health")])).toEqual(["terms"]);
    expect(missingConsents("client", [rec("terms"), rec("adult"), rec("health", { withdrawnAt: "2026-11-06T09:00:00Z" })])).toEqual(["health"]);
    expect(missingConsents("coach", [rec("terms"), rec("adult"), rec("health")])).toEqual(["coach_duty"]);
  });

  it("notices a withdrawn health consent", () => {
    expect(healthWithdrawn([rec("health", { withdrawnAt: "2026-11-06T09:00:00Z" })])).toBe(true);
    expect(healthWithdrawn([rec("health", { withdrawnAt: "x" }), rec("health")])).toBe(false);
    expect(healthWithdrawn([])).toBe(false);
  });

  it("reads rows", () => {
    expect(fromConsentRow({ user_id: "u", kind: "health", version: "v", given_at: "t", withdrawn_at: null })).toEqual({ kind: "health", version: "v", givenAt: "t", withdrawnAt: null });
  });
});

describe("deleting and exporting", () => {
  it("needs the word typed out", () => {
    expect(deleteConfirmed(" delete ")).toBe(true);
    expect(deleteConfirmed("del")).toBe(false);
  });

  it("explains what goes", () => {
    expect(deletionEffects("client", "Kamal").join(" ")).toMatch(/Kamal/);
    expect(deletionEffects("coach", "").join(" ")).toMatch(/clients keep their own accounts/);
  });

  it("names the file safely", () => {
    expect(exportFileName("Priya Sharma", "2026-11-05")).toBe("apex-my-data-priya-sharma-2026-11-05.json");
    expect(exportFileName("  ", "2026-11-05")).toBe("apex-my-data-account-2026-11-05.json");
  });
});

describe("legal pages", () => {
  it("shows placeholders until the business details are filled in", () => {
    expect(missingLegalDetails()).toEqual(["business", "email", "address"]);
    const text = privacyPolicy().flatMap((s) => s.paragraphs).join(" ");
    expect(text).toContain("[business name]");
    expect(text).not.toMatch(/\{(business|email|address)\}/);
    const filled = privacyPolicy({ business: "HELIX Coaching", email: "hi@example.com", address: "London" }).flatMap((s) => s.paragraphs).join(" ");
    expect(filled).toContain("HELIX Coaching");
    expect(filled).not.toContain("[");
  });

  it("covers health data, rights and the ICO, and the terms cover age and medical advice", () => {
    const text = privacyPolicy().map((s) => s.heading + " " + s.paragraphs.join(" ")).join(" ");
    expect(text).toMatch(/special category/);
    expect(text).toMatch(/Information Commissioner/);
    const terms = termsOfUse().flatMap((s) => s.paragraphs).join(" ");
    expect(terms).toMatch(/18 or over/);
    expect(terms).toMatch(/not medical advice/);
    expect(legalDateLabel()).toBe("3 November 2026");
  });
});
