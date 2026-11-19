import { describe, expect, it } from "vitest";
import { groupOfTab, groupProfileTabs } from "./profileTabs";

describe("profile tab groups", () => {
  it("groups the full live profile into five", () => {
    const g = groupProfileTabs(["Programme", "In person", "Health", "Report", "Check-ins", "Assessment", "Form checks", "Goals", "Habits", "Nutrition", "Recovery", "About", "Notes"]);
    expect(g.map((x) => x.label)).toEqual(["Overview", "Training", "Check-ins", "Lifestyle", "About"]);
    expect(g.flatMap((x) => x.tabs)).toHaveLength(13);
    expect(groupOfTab(g, "Nutrition")?.label).toBe("Lifestyle");
  });
  it("drops empty groups and keeps unknown tabs", () => {
    const g = groupProfileTabs(["Overview", "In person", "Programme", "Check-ins", "Notes", "Extra"]);
    expect(g.map((x) => x.label)).toEqual(["Overview", "Training", "Check-ins", "About", "Extra"]);
    expect(g[1]!.tabs).toEqual(["Programme", "In person"]);
  });
});
