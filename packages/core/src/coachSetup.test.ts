import { describe, expect, it } from "vitest";
import { setupProgress, setupSteps } from "./coachSetup";

const none = { clients: 0, templates: 0, bookingWindows: 0, pricedServices: 0, pagePublished: false };

describe("coach setup", () => {
  it("starts with clients first and nothing done", () => {
    const p = setupProgress(setupSteps(none));
    expect(p).toMatchObject({ done: 0, total: 5, complete: false });
    expect(p.next?.id).toBe("clients");
  });

  it("ticks each step from real data and points at the next one", () => {
    const p = setupProgress(setupSteps({ ...none, clients: 4, templates: 1, bookingWindows: 3 }));
    expect(p.done).toBe(3);
    expect(p.next?.id).toBe("service");
  });

  it("is complete when everything exists", () => {
    const p = setupProgress(setupSteps({ clients: 1, templates: 1, bookingWindows: 1, pricedServices: 1, pagePublished: true }));
    expect(p).toMatchObject({ complete: true, next: null });
  });
});
