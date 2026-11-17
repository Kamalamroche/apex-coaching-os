import { describe, expect, it } from "vitest";
import { STARTER_TEMPLATES } from "./data/starterTemplates";
import {
  cleanIncludes, clientStep, daysPerWeek, formatPrice, fromEnrolmentRow, fromListingRow, listingFacts, listingFromTemplate, listingProblem, listingStats,
  parsePrice, priceInput, programmeTemplate, sampleProgrammes, shopOrder, shopTotals, snapshotDays, toListingRow, toPublicProgramme, waitingList, weekOutline,
  type Enrolment, type ProgrammeListing,
} from "./onDemand";
import { fromTemplate } from "./program";

const tpl = STARTER_TEMPLATES.find((t) => t.id === "starter-upper-lower")!;
const listing = (over: Partial<ProgrammeListing> = {}): ProgrammeListing => ({ ...listingFromTemplate(tpl, new Date("2026-11-09T10:00:00Z"), "l1"), ...over });
const enrol = (over: Partial<Enrolment>): Enrolment => ({ id: "e", listingId: "l1", clientId: "c", status: "active", paidPence: 0, paidVia: "free", programId: null, startedAt: null, createdAt: "2026-11-01T00:00:00Z", ...over });

describe("prices", () => {
  it("formats pounds the UK way", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(4900)).toBe("£49");
    expect(formatPrice(2950)).toBe("£29.50");
    expect(formatPrice(120000)).toBe("£1,200");
  });

  it("reads what the coach types", () => {
    expect(parsePrice("")).toBe(0);
    expect(parsePrice("free")).toBe(0);
    expect(parsePrice("£49")).toBe(4900);
    expect(parsePrice("29.5")).toBe(2950);
    expect(parsePrice("29.99")).toBe(2999);
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("29.999")).toBeNull();
    expect(parsePrice("900")).toBeNull();
    expect(priceInput(2950)).toBe("29.50");
    expect(priceInput(4900)).toBe("49");
    expect(priceInput(0)).toBe("");
  });
});

describe("a programme from a template", () => {
  it("writes every week out, so the snapshot never depends on the template again", () => {
    const days = snapshotDays(tpl);
    expect(days.length).toBe(tpl.days.length * tpl.weeks);
    expect(new Set(days.map((d) => d.week)).size).toBe(tpl.weeks);
    // A client copy of the snapshot has the same shape as assigning the template.
    expect(fromTemplate(programmeTemplate(listing())).days.length).toBe(fromTemplate(tpl).days.length);
  });

  it("starts as a free draft with good guesses", () => {
    const l = listing();
    expect(l.status).toBe("draft");
    expect(l.pricePence).toBe(0);
    expect(l.title).toBe("Upper / lower");
    expect(l.level).toBe("Intermediate");
    expect(l.includes[0]).toBe("8 weeks, 4 sessions a week");
    expect(listingProblem(l)).toBeNull();
    const race = listingFromTemplate(STARTER_TEMPLATES.find((t) => t.id === "starter-hybrid-race")!);
    expect(race.goal).toBe("Hybrid");
    expect(race.cover).toBe("sled");
    expect(listingFromTemplate(STARTER_TEMPLATES[0]!).level).toBe("Beginner");
  });

  it("describes itself", () => {
    const l = listing();
    expect(daysPerWeek(l.days)).toBe(4);
    expect(listingFacts(l)).toMatch(/^8 weeks · 4 days a week · \d+ min$/);
    const week = weekOutline(l);
    expect(week).toHaveLength(4);
    expect(week[0]!.day).toBe("Mon");
    expect(week.every((d) => d.exercises > 0)).toBe(true);
  });

  it("checks what the coach wrote", () => {
    expect(listingProblem(listing({ title: " " }))).toMatch(/title/);
    expect(listingProblem(listing({ pricePence: 50 }))).toMatch(/£1/);
    expect(listingProblem(listing({ pricePence: 60_000 }))).toMatch(/£500/);
    expect(listingProblem(listing({ days: [] }))).toMatch(/no exercises/);
    expect(cleanIncludes(["- Eight weeks", "  ", "• Cues", "a", "b", "c", "d", "e"])).toEqual(["Eight weeks", "Cues", "a", "b", "c", "d"]);
  });
});

describe("people", () => {
  it("counts members, people waiting and money in", () => {
    const list = [
      enrol({ id: "1", paidPence: 4900, paidVia: "manual", startedAt: "2026-11-02T00:00:00Z" }),
      enrol({ id: "2", paidPence: 4900, paidVia: "stripe" }),
      enrol({ id: "3", status: "requested", paidPence: 0, paidVia: null, createdAt: "2026-11-05T00:00:00Z" }),
      enrol({ id: "4", status: "requested", paidPence: 0, paidVia: null, createdAt: "2026-11-03T00:00:00Z" }),
      enrol({ id: "5", status: "declined", paidPence: 0, paidVia: null }),
      enrol({ id: "6", listingId: "other", paidPence: 1000 }),
    ];
    expect(listingStats("l1", list)).toEqual({ members: 2, started: 1, waiting: 2, revenuePence: 9800 });
    expect(shopTotals([listing({ status: "live" })], list)).toEqual({ live: 1, members: 2, waiting: 2, revenuePence: 9800 });
    expect(waitingList(list).map((e) => e.id)).toEqual(["4", "3"]);
  });

  it("tells the client what they can do next", () => {
    const paid = listing({ pricePence: 4900, status: "live" });
    expect(clientStep(paid, undefined)).toEqual({ kind: "ask", label: "Get it · £49" });
    expect(clientStep(paid, enrol({ status: "requested" })).kind).toBe("waiting");
    expect(clientStep(paid, enrol({ status: "declined" })).kind).toBe("ask");
    expect(clientStep(paid, enrol({ status: "active" })).kind).toBe("start");
    expect(clientStep(listing({ status: "live" }), undefined).kind).toBe("start");
    const started = enrol({ startedAt: "2026-11-02T00:00:00Z" });
    expect(clientStep(paid, started, paid.title).kind).toBe("following");
    expect(clientStep(paid, started, "Something else").kind).toBe("restart");
  });

  it("shows live programmes only, the client's own first", () => {
    const a = listing({ id: "a", status: "live", createdAt: "2026-11-01T00:00:00Z" });
    const b = listing({ id: "b", status: "live", createdAt: "2026-11-05T00:00:00Z" });
    const c = listing({ id: "c", status: "draft" });
    expect(shopOrder([a, b, c], []).map((l) => l.id)).toEqual(["b", "a"]);
    expect(shopOrder([a, b, c], [enrol({ listingId: "a" })]).map((l) => l.id)).toEqual(["a", "b"]);
  });
});

describe("rows", () => {
  it("round-trips a listing", () => {
    const l = listing({ status: "live", pricePence: 2900, includes: ["- One", "Two"] });
    const row = { ...toListingRow(l, "coach"), created_at: l.createdAt };
    expect(row.includes).toEqual(["One", "Two"]);
    expect(fromListingRow(row)).toEqual({ ...l, includes: ["One", "Two"] });
    expect(fromListingRow({ ...row, cover: "nope", level: "?", status: "odd" })).toMatchObject({ cover: "squat", level: "All levels", status: "draft" });
  });

  it("reads enrolments and the public view", () => {
    expect(fromEnrolmentRow({ id: "e", listing_id: "l", client_id: "c", client_name: "Ana", status: "active", paid_pence: 4900, paid_via: "stripe", program_id: null, started_at: null, created_at: "x" }))
      .toMatchObject({ status: "active", paidVia: "stripe", clientName: "Ana" });
    expect(toPublicProgramme(listing())).toMatchObject({ perWeek: 4, weeks: 8 });
  });

  it("has a believable demo shop", () => {
    const { listings, enrolments } = sampleProgrammes();
    expect(listings.every((l) => listingProblem(l) === null)).toBe(true);
    expect(shopTotals(listings, enrolments)).toEqual({ live: 2, members: 4, waiting: 1, revenuePence: 9800 });
  });
});
