import { describe, expect, it } from "vitest";
import { goingQuiet, quietNudge } from "./quiet";

const NOW = new Date("2026-11-20T12:00:00Z");
describe("going quiet", () => {
  it("lists clients without a session for 4 days, longest first", () => {
    const list = goingQuiet([
      { id: "a", name: "Ana", startedAt: "2026-09-01", lastSession: "2026-11-19T08:00:00Z" },
      { id: "b", name: "Ben", startedAt: "2026-09-01", lastSession: "2026-11-15T08:00:00Z" },
      { id: "c", name: "Cat", startedAt: "2026-09-01", lastSession: "2026-11-01T08:00:00Z" },
      { id: "d", name: "Dev", startedAt: "2026-11-17", lastSession: null },
      { id: "e", name: "Eve", startedAt: "2026-11-05", lastSession: null },
    ], NOW);
    expect(list.map((c) => [c.id, c.days, c.never])).toEqual([["e", 15, true], ["c", 19, false], ["b", 5, false]].sort((x, y) => (y[1] as number) - (x[1] as number)));
  });
  it("words the nudge for the situation", () => {
    expect(quietNudge("Ben", 5, false)).toMatch(/5 days since/);
    expect(quietNudge("Cat", 19, false)).toMatch(/shorter plan/);
    expect(quietNudge("Eve", 15, true)).toMatch(/first session/);
  });
});
