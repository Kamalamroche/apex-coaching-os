import { describe, expect, it } from "vitest";
import { AUTOMATIONS, DEFAULT_AUTOMATIONS, automationProblem, countOn, fillMessage, fromAutomationRow, hourLabel, toAutomationRow } from "./automations";

describe("automatic messages", () => {
  it("fills in the placeholders", () => {
    expect(fillMessage("Hi {first_name}, {days} days. {coach}", { firstName: "Priya", coach: "Kamal", days: 5 })).toBe("Hi Priya, 5 days. Kamal");
    expect(fillMessage("{first_name} {first_name}", { firstName: "A", coach: "K" })).toBe("A A");
  });

  it("starts with everything off and valid wording", () => {
    expect(countOn(DEFAULT_AUTOMATIONS)).toBe(0);
    expect(automationProblem(DEFAULT_AUTOMATIONS)).toBeNull();
  });

  it("won't turn on an empty message or a silly gap", () => {
    expect(automationProblem({ ...DEFAULT_AUTOMATIONS, welcomeOn: true, welcomeBody: "  " })).toMatch(/welcome/);
    expect(automationProblem({ ...DEFAULT_AUTOMATIONS, missedDays: 1 })).toMatch(/days/);
    expect(automationProblem({ ...DEFAULT_AUTOMATIONS, checkinBody: "x".repeat(1001) })).toMatch(/too long/);
  });

  it("describes when each one goes", () => {
    const s = { ...DEFAULT_AUTOMATIONS, missedDays: 5, sendHour: 18 };
    expect(AUTOMATIONS.map((a) => a.when(s)).join(" ")).toContain("5 days");
    expect(AUTOMATIONS[2]?.when(s)).toContain("6 pm");
    expect(hourLabel(0)).toBe("midnight");
    expect(hourLabel(12)).toBe("midday");
  });

  it("round-trips the row", () => {
    const s = { ...DEFAULT_AUTOMATIONS, welcomeOn: true, sendHour: 7 };
    expect(fromAutomationRow(toAutomationRow(s, "c"))).toEqual(s);
  });
});

describe("low-protein nudge", () => {
  it("needs three logged low days", async () => {
    const { proteinLow, AUTOMATIONS, isOn, bodyOf, fromAutomationRow, toAutomationRow } = await import("./automations");
    expect(proteinLow([50, 60, 70], 120)).toBe(true);
    expect(proteinLow([50, null, 70], 120)).toBe(false);
    expect(proteinLow([50, 100, 70], 120)).toBe(false);
    expect(proteinLow([50, 60], 120)).toBe(false);
    expect(proteinLow([50, 60, 70], 0)).toBe(false);
    expect(AUTOMATIONS.some((a) => a.kind === "protein")).toBe(true);
    const s = { ...DEFAULT_AUTOMATIONS, proteinOn: true, proteinBody: "Eat protein" };
    expect(isOn(s, "protein")).toBe(true);
    expect(bodyOf(s, "protein")).toBe("Eat protein");
    expect(fromAutomationRow(toAutomationRow(s, "c"))).toEqual(s);
    // A row from before the SQL update has no protein columns.
    const { protein_on: _a, protein_body: _b, ...old } = toAutomationRow(s, "c");
    expect(fromAutomationRow(old).proteinOn).toBe(false);
    expect(fromAutomationRow(old).proteinBody).toBe(DEFAULT_AUTOMATIONS.proteinBody);
  });
});
