import { describe, expect, it } from "vitest";
import { blankResource, fromResourceRow, groupResources, linkHost, linkKind, resourceProblem, safeUrl, sampleResources, toResourceRow } from "./resources";
import { cleanTags, hasTag, noteProblem, sortNotes, tagsInUse, type ClientNote } from "./clientNotes";

describe("resources", () => {
  it("tells videos, PDFs and other links apart", () => {
    expect(linkKind("https://youtu.be/abc")).toBe("video");
    expect(linkKind("https://www.youtube.com/watch?v=1")).toBe("video");
    expect(linkKind("https://example.com/Plan.PDF")).toBe("pdf");
    expect(linkKind("https://example.com/post")).toBe("link");
    expect(linkHost("https://www.example.com/x")).toBe("example.com");
  });

  it("only accepts plain web links", () => {
    expect(safeUrl("https://example.com")).toBe(true);
    expect(safeUrl("javascript:alert(1)")).toBe(false);
    expect(safeUrl("not a link")).toBe(false);
  });

  it("needs a title and a guide or a link", () => {
    const r = blankResource();
    expect(resourceProblem(r)).toMatch(/title/);
    expect(resourceProblem({ ...r, title: "Sleep" })).toMatch(/guide/);
    expect(resourceProblem({ ...r, title: "Sleep", url: "javascript:x" })).toMatch(/link/);
    expect(resourceProblem({ ...r, title: "Sleep", body: "Bed by 11" })).toBeNull();
  });

  it("groups by category in order and round-trips rows", () => {
    const g = groupResources(sampleResources());
    expect(g.map((x) => x.category)).toEqual(["Training", "Nutrition", "Recovery", "Getting started"]);
    const r = sampleResources()[0]!;
    expect(fromResourceRow({ ...toResourceRow(r, "coach"), created_at: r.createdAt })).toEqual(r);
    expect(fromResourceRow({ ...toResourceRow(r, "coach"), category: "Odd", created_at: r.createdAt }).category).toBe("Getting started");
  });
});

describe("client notes and tags", () => {
  it("tidies tags", () => {
    expect(cleanTags([" VIP ", "vip", "", "Fat  loss", "x".repeat(30)])).toEqual(["VIP", "Fat loss", "x".repeat(24)]);
    expect(cleanTags(Array.from({ length: 12 }, (_, i) => `t${i}`))).toHaveLength(8);
    expect(hasTag(["VIP"], "vip")).toBe(true);
  });

  it("counts tags in use, most used first", () => {
    expect(tagsInUse({ a: ["VIP", "Injury"], b: ["vip"], c: [] })).toEqual([{ tag: "VIP", count: 2 }, { tag: "Injury", count: 1 }]);
  });

  it("puts pinned notes first, then newest", () => {
    const n = (id: string, at: string, pinned = false): ClientNote => ({ id, clientId: "c", body: id, pinned, createdAt: at });
    expect(sortNotes([n("old", "2026-01-01"), n("new", "2026-02-01"), n("pin", "2025-01-01", true)]).map((x) => x.id)).toEqual(["pin", "new", "old"]);
    expect(noteProblem(" ")).toMatch(/Write/);
  });
});
