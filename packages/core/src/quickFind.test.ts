import { describe, expect, it } from "vitest";
import { clientItems, parseClientItem, quickFind, type QuickItem } from "./quickFind";

const screens: QuickItem[] = [
  { id: "tab:brief", kind: "screen", title: "Brief", keywords: ["home", "dashboard", "today"] },
  { id: "tab:money", kind: "screen", title: "Business", keywords: ["money", "income", "revenue"] },
  { id: "sub:calendar", kind: "screen", title: "Calendar", keywords: ["bookings", "diary", "schedule"] },
  { id: "act:invite", kind: "action", title: "Invite a client", keywords: ["add", "new client"] },
];
const people = clientItems([
  { id: "1", name: "Sarah Mitchell" },
  { id: "2", name: "Omar Tahir" },
  { id: "3", name: "Priya Sharma" },
]);
const all = [...people, ...screens];

describe("quick find", () => {
  it("finds a client from the start of a name", () => {
    expect(quickFind("sar", all)[0]?.title).toBe("Sarah Mitchell");
    expect(quickFind("tahir", all)[0]?.title).toBe("Omar Tahir");
  });

  it("finds a client from initials", () => {
    expect(quickFind("ps", all)[0]?.title).toBe("Priya Sharma");
  });

  it("finds a client and a place on their profile together", () => {
    expect(quickFind("sarah check", all)[0]?.title).toBe("Sarah Mitchell · Check-ins");
    expect(quickFind("omar food", all)[0]?.title).toBe("Omar Tahir · Nutrition");
  });

  it("shows only the client when just a name is typed", () => {
    expect(quickFind("sm", all).map((i) => i.title)).toEqual(["Sarah Mitchell"]);
    expect(quickFind("sarah", all).map((i) => i.title)).toEqual(["Sarah Mitchell"]);
  });

  it("finds screens by everyday words", () => {
    expect(quickFind("money", all)[0]?.id).toBe("tab:money");
    expect(quickFind("diary", all)[0]?.id).toBe("sub:calendar");
  });

  it("needs every word to match", () => {
    expect(quickFind("sarah zebra", all)).toEqual([]);
  });

  it("ignores case and accents", () => {
    expect(quickFind("PRÍYA", all)[0]?.title).toBe("Priya Sharma");
  });

  it("gives the starter list for an empty query and respects the limit", () => {
    expect(quickFind("  ", all, 2, screens)).toHaveLength(2);
    expect(quickFind("", all)).toEqual([]);
    expect(quickFind("a", all, 3)).toHaveLength(3);
  });

  it("reads client ids back", () => {
    expect(parseClientItem("client:abc:Check-ins")).toEqual({ clientId: "abc", tab: "Check-ins" });
    expect(parseClientItem("client:abc")).toEqual({ clientId: "abc", tab: undefined });
    expect(parseClientItem("tab:brief")).toBeNull();
  });
});
