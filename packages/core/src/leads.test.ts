import { describe, expect, it } from "vitest";
import { requestProblem } from "./growth";
import { addDays } from "./lifestyle";
import { embedCode, followUpLabel, followUpsDue, formLink, manualLeadProblem, onStageChange, onStatusChange, readFormLink, readSource, sampleLeads, sortLeads, sourceCounts, sourceLabel, stageCounts, stageFromStatus, welcomeBody, welcomeProblem, winRate } from "./leads";

const NOW = new Date("2026-11-09T12:00:00Z");
const TODAY = "2026-11-09";

describe("leads", () => {
  it("starts old requests on the matching stage", () => {
    expect(stageFromStatus("new")).toBe("new");
    expect(stageFromStatus("invited")).toBe("contacted");
    expect(stageFromStatus("joined")).toBe("client");
    expect(stageFromStatus("declined")).toBe("lost");
  });

  it("keeps stage and invite status in step", () => {
    expect(onStatusChange({ stage: "new", status: "new" }, "invited")).toEqual({ stage: "contacted", status: "invited" });
    expect(onStatusChange({ stage: "trial", status: "new" }, "invited")).toEqual({ stage: "trial", status: "invited" });
    expect(onStatusChange({ stage: "trial", status: "invited" }, "joined")).toEqual({ stage: "client", status: "joined" });
    expect(onStatusChange({ stage: "new", status: "new" }, "declined")).toEqual({ stage: "lost", status: "declined" });
    expect(onStatusChange({ stage: "lost", status: "declined" }, "new")).toEqual({ stage: "new", status: "new" });
    expect(onStageChange({ stage: "contacted", status: "invited" }, "lost")).toEqual({ stage: "lost", status: "declined" });
    expect(onStageChange({ stage: "lost", status: "declined", hasInvite: true }, "trial")).toEqual({ stage: "trial", status: "invited", hasInvite: true });
    expect(onStageChange({ stage: "lost", status: "declined" }, "contacted")).toEqual({ stage: "contacted", status: "new" });
    expect(onStageChange({ stage: "trial", status: "invited" }, "client")).toEqual({ stage: "client", status: "joined" });
    expect(onStageChange({ stage: "client", status: "joined", hasInvite: true }, "trial")).toEqual({ stage: "trial", status: "invited", hasInvite: true });
    expect(onStageChange({ stage: "new", status: "new" }, "trial")).toEqual({ stage: "trial", status: "new" });
  });

  it("counts the pipeline and the win rate", () => {
    const leads = sampleLeads(NOW);
    expect(stageCounts(leads)).toEqual({ new: 2, contacted: 1, trial: 1, client: 2, lost: 1 });
    expect(winRate(leads)).toBe(67);
    expect(winRate([{ stage: "new" }])).toBeNull();
    expect(sourceCounts(leads)[0]).toEqual({ source: "instagram", count: 2 });
  });

  it("puts due follow-ups first", () => {
    const leads = sampleLeads(NOW);
    expect(followUpsDue(leads, TODAY).map((l) => l.id)).toEqual(["r4"]);
    expect(sortLeads(leads, TODAY).map((l) => l.id)).toEqual(["r4", "r1", "r2", "r5", "r3", "r6", "r7"]);
    expect(followUpLabel(TODAY, TODAY)).toBe("Today");
    expect(followUpLabel("2026-11-10", TODAY)).toBe("Tomorrow");
    expect(followUpLabel("2026-11-12", TODAY)).toBe("In 3 days");
    expect(followUpLabel("2026-11-07", TODAY)).toBe("2 days late");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("builds and reads form links", () => {
    expect(formLink("https://apex.app/", "kamal", "Instagram")).toBe("https://apex.app/c/?k=kamal&form=1&src=instagram");
    expect(formLink("https://apex.app", "kamal")).toBe("https://apex.app/c/?k=kamal&form=1");
    expect(formLink("https://apex.app", "kamal", "<bad>")).toBe("https://apex.app/c/?k=kamal&form=1");
    expect(embedCode("https://apex.app", "kamal")).toContain('src="https://apex.app/c/?k=kamal&form=1&src=website&embed=1"');
    expect(readFormLink("?k=kamal&form=1&src=tiktok")).toEqual({ form: true, embed: false, source: "tiktok" });
    expect(readFormLink("?k=kamal&embed=1")).toEqual({ form: true, embed: true, source: null });
    expect(readFormLink("?k=kamal&src=<x>")).toEqual({ form: false, embed: false, source: null });
    expect(readSource("a")).toBeNull();
    expect(sourceLabel("instagram")).toBe("Instagram");
    expect(sourceLabel("open-day")).toBe("Open day");
  });

  it("checks enquiries and hand-added leads", () => {
    const d = { name: "Leo", email: "leo@example.com", goal: "", message: "" };
    expect(requestProblem({ ...d, phone: "07700 900123" })).toBeNull();
    expect(requestProblem({ ...d, phone: "+44 (0)7700-900123" })).toBeNull();
    expect(requestProblem({ ...d, phone: "call me" })).toBe("Check the phone number.");
    const m = { name: "Dev", email: "", phone: "", goal: "", source: "manual", notes: "" };
    expect(manualLeadProblem(m)).toBeNull();
    expect(manualLeadProblem({ ...m, name: "D" })).toBe("Add their name.");
    expect(manualLeadProblem({ ...m, email: "dev@" })).toBe("Check the email.");
    expect(manualLeadProblem({ ...m, notes: "x".repeat(1001) })).toMatch(/notes/);
  });

  it("fills the welcome email", () => {
    expect(welcomeBody("Hi {first}, thanks! Talk soon {first}.", "Hana Ito")).toBe("Hi Hana, thanks! Talk soon Hana.");
    expect(welcomeBody("", "Leo Martin")).toMatch(/^Thanks for getting in touch, Leo\./);
    expect(welcomeBody("Hi {first}", "  ")).toBe("Hi there");
    expect(welcomeProblem("x".repeat(801))).toMatch(/800/);
  });
});
