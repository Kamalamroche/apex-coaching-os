import { describe, expect, it } from "vitest";
import {
  EMPTY_ANSWERS, EMPTY_FILTER, credentialProblem, directoryProblem, expiringSoon, filterCount, filterTrainers, isVerified, matchLink, matchMessage, matchSteps, matchTrainers,
  placeMatches, readPrefill, sampleCredentials, sampleTrainers, specialtiesOffered, verifySteps, type Credential,
} from "./marketplace";
import { sitemapXml, trainerMeta, withMeta } from "./seo";
import { sourceLabel } from "./leads";

const now = new Date("2026-11-23T10:00:00Z");
const today = "2026-11-23";
const list = sampleTrainers(now);

describe("directory filters", () => {
  it("shows everyone with no filters, most trusted first", () => {
    const out = filterTrainers(list, EMPTY_FILTER);
    expect(out).toHaveLength(list.length);
    expect(out[0]!.verified).toBe(true);
  });
  it("filters by goal through specialties", () => {
    const out = filterTrainers(list, { ...EMPTY_FILTER, goal: "Move better" });
    expect(out.map((t) => t.slug).sort()).toEqual(["amara-okafor", "mei-chen", "priya-shah"]);
  });
  it("online trainers stay in a town search when someone wants online", () => {
    const inPerson = filterTrainers(list, { ...EMPTY_FILTER, place: "Leeds" });
    expect(inPerson.map((t) => t.slug)).toEqual(["priya-shah"]);
    const online = filterTrainers(list, { ...EMPTY_FILTER, place: "Leeds", mode: "online" });
    expect(online.map((t) => t.slug)).toContain("tom-walsh");
  });
  it("hybrid trainers count for online and in person", () => {
    expect(filterTrainers(list, { ...EMPTY_FILTER, mode: "in_person" }).map((t) => t.slug)).toContain("kamal");
    expect(filterTrainers(list, { ...EMPTY_FILTER, mode: "online" }).map((t) => t.slug)).toContain("kamal");
  });
  it("budget, verified only and price sort", () => {
    const out = filterTrainers(list, { ...EMPTY_FILTER, maxPence: 4500, sort: "price" });
    expect(out.map((t) => t.fromPence)).toEqual([3000, 4000, 4500]);
    expect(filterTrainers(list, { ...EMPTY_FILTER, verifiedOnly: true }).every((t) => t.verified)).toBe(true);
    expect(filterCount({ ...EMPTY_FILTER, goal: "Lose fat", verifiedOnly: true, place: "  " })).toBe(2);
  });
  it("places match loosely", () => {
    expect(placeMatches("East London", "london")).toBe(true);
    expect(placeMatches("St. Albans", "st albans")).toBe(true);
    expect(placeMatches("Leeds", "Bristol")).toBe(false);
    expect(placeMatches("", "Leeds")).toBe(false);
  });
  it("lists offered specialties in the usual order", () => {
    expect(specialtiesOffered(list).slice(0, 3)).toEqual(["Strength", "Fat loss", "Muscle"]);
  });
});

describe("match quiz", () => {
  it("skips the place question for online", () => {
    expect(matchSteps(EMPTY_ANSWERS).map((s) => s.key)).toEqual(["goal", "how", "place", "maxPence", "priority"]);
    expect(matchSteps({ ...EMPTY_ANSWERS, how: "online" }).map((s) => s.key)).not.toContain("place");
  });
  it("keeps only trainers who can coach the goal and the way they want", () => {
    const out = matchTrainers(list, { goal: "Run further", how: "in_person", place: "Manchester", maxPence: 4500, priority: "nearby" });
    expect(out.map((m) => m.trainer.slug)).toEqual(["amara-okafor"]);
    expect(out[0]!.reasons).toContain("Based in Manchester");
  });
  it("ranks by what matters most and gives at most 3", () => {
    const out = matchTrainers(list, { goal: "Get stronger", how: "online", place: "", maxPence: null, priority: "verified" });
    expect(out.length).toBeLessThanOrEqual(3);
    expect(out[0]!.trainer.verified).toBe(true);
    expect(out.every((m) => m.reasons.length > 0 && m.reasons.length <= 3)).toBe(true);
  });
  it("writes the answers into the enquiry", () => {
    const a = { goal: "Lose fat" as const, how: "in_person" as const, place: "Leeds", maxPence: 4500, priority: "price" as const };
    expect(matchMessage(a)).toBe("From the APEX match quiz: wants to train in person near Leeds, budget up to £45 a session, cares most about good value.");
    expect(matchMessage(EMPTY_ANSWERS)).toBe("");
    const link = matchLink("https://x.test", "priya-shah", a);
    expect(link.startsWith("https://x.test/c/priya-shah/?src=match&form=1")).toBe(true);
    const back = readPrefill(new URL(link).search);
    expect(back).toEqual({ goal: "Lose fat", how: "in_person", note: matchMessage(a) });
  });
  it("drops anything odd from a link", () => {
    expect(readPrefill("?goal=Hack&how=moon&note=<script>")).toEqual({ goal: "", how: "", note: "script" });
  });
  it("names the new lead sources", () => {
    expect(sourceLabel("directory")).toBe("Find a trainer");
    expect(sourceLabel("match")).toBe("Match quiz");
  });
});

describe("listing and the verified badge", () => {
  const page = { published: true, headline: "Strong", specialties: ["Strength"], modes: ["in_person" as const], city: "Leeds" };
  it("needs a ready page", () => {
    expect(directoryProblem(page)).toBeNull();
    expect(directoryProblem({ ...page, published: false })).toMatch(/Publish/);
    expect(directoryProblem({ ...page, city: "" })).toMatch(/city/);
    expect(directoryProblem({ ...page, city: "", modes: ["online"] })).toBeNull();
  });
  it("verified needs a checked qualification and in-date insurance", () => {
    const c = sampleCredentials(now);
    expect(isVerified(c, today)).toBe(true);
    const lapsed: Credential[] = c.map((x) => (x.kind === "insurance" ? { ...x, expires: "2026-11-01" } : x));
    expect(isVerified(lapsed, today)).toBe(false);
    expect(verifySteps(lapsed, today)[1]!.text).toMatch(/Expired/);
    expect(isVerified(c.map((x) => ({ ...x, status: "pending" as const })), today)).toBe(false);
    expect(verifySteps([], today).map((s) => s.done)).toEqual([false, false]);
  });
  it("warns 30 days before a certificate runs out", () => {
    const c = sampleCredentials(now).map((x) => (x.kind === "insurance" ? { ...x, expires: "2026-12-10" } : x));
    expect(expiringSoon(c, today).map((x) => x.kind)).toEqual(["insurance"]);
  });
  it("checks a certificate before sending", () => {
    const pdf = { size: 1000, type: "application/pdf" };
    expect(credentialProblem({ kind: "qualification", title: "Level 3 PT", issuer: "Academy", expires: null }, pdf, today)).toBeNull();
    expect(credentialProblem({ kind: "insurance", title: "Public liability", issuer: "Insurer", expires: null }, pdf, today)).toMatch(/renewal/);
    expect(credentialProblem({ kind: "insurance", title: "Public liability", issuer: "Insurer", expires: "2026-01-01" }, pdf, today)).toMatch(/expired/);
    expect(credentialProblem({ kind: "qualification", title: "Level 3 PT", issuer: "Academy", expires: null }, null, today)).toMatch(/Attach/);
    expect(credentialProblem({ kind: "qualification", title: "Level 3 PT", issuer: "Academy", expires: null }, { size: 9e6, type: "image/png" }, today)).toMatch(/8 MB/);
    expect(credentialProblem({ kind: "qualification", title: "Level 3 PT", issuer: "Academy", expires: null }, { size: 10, type: "text/html" }, today)).toMatch(/PDF/);
  });
});

describe("search engines and sharing", () => {
  it("writes a trainer title and description", () => {
    const m = trainerMeta({ name: "Priya Shah", headline: "Strong, safe training before and after baby", city: "Leeds", specialties: ["Pre and postnatal", "Strength"], modes: ["in_person"], bio: "" });
    expect(m.title).toBe("Priya Shah · Personal trainer in Leeds · APEX");
    expect(m.description).toBe("Strong, safe training before and after baby. Pre and postnatal, Strength. In person.");
    expect(trainerMeta({ name: "A", headline: "", city: "", specialties: [], modes: ["online"], bio: "I coach runners. Lots." }).title).toBe("A · Personal trainer online · APEX");
  });
  it("fills the page head and escapes", () => {
    const html = '<head><title>Old</title>\n    <meta name="description" content="old" /></head>';
    const out = withMeta(html, { title: 'Tom "T" & co', description: "<b>x</b>", url: "https://x.test/c/tom/" });
    expect(out).toContain("<title>Tom &quot;T&quot; &amp; co</title>");
    expect(out).toContain('content="&lt;b&gt;x&lt;/b&gt;"');
    expect(out).toContain('<link rel="canonical" href="https://x.test/c/tom/" />');
  });
  it("builds a sitemap", () => {
    const xml = sitemapXml("https://x.test", ["/", "/trainers/"], [{ slug: "kamal", updated: "2026-11-20T10:00:00Z" }]);
    expect(xml).toContain("<loc>https://x.test/trainers/</loc>");
    expect(xml).toContain("<url><loc>https://x.test/c/kamal/</loc><lastmod>2026-11-20</lastmod></url>");
  });
});
