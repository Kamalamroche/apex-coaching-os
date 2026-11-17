import { describe, expect, it } from "vitest";
import { needsOnboarding, onboardingAt, onboardingSteps } from "./onboarding";

const base = { toSign: 1, hasIntake: false, canBook: true, hasBooking: false, remindersOn: false as boolean | null, coach: "Kamal" };

describe("onboarding", () => {
  it("lists every step a brand-new client needs, in order", () => {
    expect(onboardingSteps(base).map((s) => s.id)).toEqual(["sign", "about", "book", "reminders"]);
    expect(onboardingSteps(base)[2]!.caption).toContain("Kamal");
  });

  it("leaves out what is done or impossible", () => {
    const ids = onboardingSteps({ ...base, toSign: 0, canBook: false, remindersOn: null }).map((s) => s.id);
    expect(ids).toEqual(["about"]);
    expect(onboardingSteps({ ...base, hasBooking: true, remindersOn: true }).map((s) => s.id)).toEqual(["sign", "about"]);
  });

  it("walks through the steps and ends", () => {
    const steps = onboardingSteps(base);
    expect(onboardingAt(steps, [])).toMatchObject({ index: 0, total: 4, step: { id: "sign" } });
    expect(onboardingAt(steps, ["sign", "about"])?.step.id).toBe("book");
    expect(onboardingAt(steps, ["sign", "about", "book", "reminders"])).toBeNull();
  });

  it("only new clients get the flow", () => {
    expect(needsOnboarding({ hasIntake: false })).toBe(true);
    expect(needsOnboarding({ hasIntake: true })).toBe(false);
  });
});
