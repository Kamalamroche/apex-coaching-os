import { describe, expect, it } from "vitest";
import { blankPage, pageLink, pageProblem, readPageLink, referralSummary, requestProblem, sampleRequests, slugProblem, slugify, sortRequests } from "./growth";

describe("growth", () => {
  it("makes page addresses from names", () => {
    expect(slugify("Kamal Amroche")).toBe("kamal-amroche");
    expect(slugify("  Zoë  O'Neil--PT ")).toBe("zoe-o-neil-pt");
    expect(slugify("x".repeat(40))).toHaveLength(30);
    expect(blankPage("Kamal A").slug).toBe("kamal-a");
  });
  it("checks page addresses", () => {
    expect(slugProblem("kamal")).toBeNull();
    expect(slugProblem("ka")).toMatch(/at least/);
    expect(slugProblem("Kamal")).toMatch(/lowercase/);
    expect(slugProblem("a--b")).toMatch(/single hyphens/);
    expect(slugProblem("admin")).toMatch(/taken/);
  });
  it("needs a headline to publish", () => {
    expect(pageProblem({ slug: "kamal", headline: " ", bio: "", specialties: [] })).toMatch(/headline/);
    expect(pageProblem({ slug: "kamal", headline: "Strong", bio: "", specialties: [] })).toBeNull();
  });
  it("checks requests", () => {
    const ok = { name: "Leo", email: "leo@example.com", goal: "", message: "" };
    expect(requestProblem(ok)).toBeNull();
    expect(requestProblem({ ...ok, email: "leo@" })).toMatch(/email/);
    expect(requestProblem({ ...ok, name: "L" })).toMatch(/name/);
  });
  it("builds and reads links", () => {
    const l = pageLink("https://apex.app/", "kamal", "ab12cd34");
    expect(l).toBe("https://apex.app/c/?k=kamal&ref=ab12cd34");
    const u = new URL(l);
    expect(readPageLink(u.pathname, u.search)).toEqual({ slug: "kamal", ref: "ab12cd34" });
    expect(readPageLink("/c/kamal/", "")).toEqual({ slug: "kamal", ref: null });
    expect(readPageLink("/c/", "?k=<script>&ref=x")).toEqual({ slug: null, ref: null });
  });
  it("sums referrals and sorts requests", () => {
    const r = sampleRequests(new Date("2026-11-05T12:00:00Z"));
    expect(referralSummary(r.filter((x) => x.referredBy))).toEqual({ asked: 2, joined: 1 });
    expect(sortRequests(r).map((x) => x.id)).toEqual(["r1", "r2", "r3"]);
  });
});
