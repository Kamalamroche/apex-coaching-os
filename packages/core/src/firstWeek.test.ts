import { describe, expect, it } from "vitest";
import { firstWeekProgress, firstWeekSteps, showFirstWeek, type FirstWeekInput } from "./firstWeek";

const fresh: FirstWeekInput = { hasIntake: false, notificationsOn: false, sessions: 0, habitTicks: 0, foodLogged: 0, messagesFromClient: 0, checkIns: 0, coach: "Kamal" };

describe("first week journey", () => {
  it("lists six steps for a brand-new client, intake first", () => {
    const steps = firstWeekSteps(fresh);
    expect(steps.map((s) => s.id)).toEqual(["intake", "notifications", "workout", "habit", "hello", "checkin"]);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(steps[4]!.title).toBe("Say hello to Kamal");
  });

  it("leaves out reminders where the device can't show them", () => {
    expect(firstWeekSteps({ ...fresh, notificationsOn: null }).map((s) => s.id)).not.toContain("notifications");
  });

  it("ticks steps from real activity and points at the next one", () => {
    const steps = firstWeekSteps({ ...fresh, hasIntake: true, sessions: 1, foodLogged: 2 });
    const p = firstWeekProgress(steps);
    expect(p).toMatchObject({ done: 3, total: 6, complete: false });
    expect(p.next?.id).toBe("notifications");
  });

  it("shows until complete, then for one day to celebrate, unless hidden", () => {
    const all = firstWeekProgress(firstWeekSteps({ ...fresh, hasIntake: true, notificationsOn: true, sessions: 1, habitTicks: 1, messagesFromClient: 1, checkIns: 1 }));
    expect(all.complete).toBe(true);
    const now = Date.parse("2026-11-09T12:00:00Z");
    expect(showFirstWeek(all, { dismissed: false, completedAt: now - 3600000, now })).toBe(true);
    expect(showFirstWeek(all, { dismissed: false, completedAt: now - 2 * 86400000, now })).toBe(false);
    expect(showFirstWeek(all, { dismissed: false, completedAt: null, now })).toBe(false);
    const part = firstWeekProgress(firstWeekSteps(fresh));
    expect(showFirstWeek(part, { dismissed: false, completedAt: null, now })).toBe(true);
    expect(showFirstWeek(part, { dismissed: true, completedAt: null, now })).toBe(false);
  });
});
