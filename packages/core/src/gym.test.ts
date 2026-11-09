import { describe, expect, it } from "vitest";
import {
  canChangeRole, canHandOver, canInvite, canRemove, canShare, filterGymClients, fromGymClientRow, gymInviteLink, gymInviteText,
  gymNameProblem, gymTotals, handOverTargets, inviteDaysLeft, isLead, lastSeenText, sampleGym, trainerLines, type GymMember,
} from "./gym";

const now = new Date("2026-11-09T12:00:00Z");
const s = sampleGym(now);
const member = (role: GymMember["role"], isMe = false): GymMember => ({ id: role, name: role, role, joinedAt: "", isMe });

describe("gym roles", () => {
  it("owner and managers lead, trainers don't", () => {
    expect(isLead("owner")).toBe(true);
    expect(isLead("manager")).toBe(true);
    expect(isLead("trainer")).toBe(false);
    expect(isLead(null)).toBe(false);
  });
  it("only the owner invites managers; leads invite trainers", () => {
    expect(canInvite("owner", "manager")).toBe(true);
    expect(canInvite("manager", "manager")).toBe(false);
    expect(canInvite("manager", "trainer")).toBe(true);
    expect(canInvite("trainer", "trainer")).toBe(false);
  });
  it("only the owner changes roles, never their own or the owner's", () => {
    expect(canChangeRole("owner", member("trainer"))).toBe(true);
    expect(canChangeRole("owner", member("owner", true))).toBe(false);
    expect(canChangeRole("manager", member("trainer"))).toBe(false);
  });
  it("removal follows rank, and anyone but the owner can leave", () => {
    expect(canRemove("owner", member("manager"))).toBe(true);
    expect(canRemove("manager", member("trainer"))).toBe(true);
    expect(canRemove("manager", member("manager"))).toBe(false);
    expect(canRemove("manager", member("owner"))).toBe(false);
    expect(canRemove("trainer", member("trainer"))).toBe(false);
    expect(canRemove("trainer", member("trainer", true))).toBe(true);
    expect(canRemove("owner", member("owner", true))).toBe(false);
  });
  it("leads hand over; trainers share only their own clients", () => {
    expect(canHandOver("manager")).toBe(true);
    expect(canHandOver("trainer")).toBe(false);
    const aisha = s.clients.find((c) => c.id === "c-aisha")!;
    expect(canShare("trainer", "t-luis", aisha)).toBe(true);
    expect(canShare("trainer", "t-mei", aisha)).toBe(false);
    expect(canShare("manager", "t-amara", aisha)).toBe(true);
  });
});

describe("gym lists", () => {
  it("filters by trainer, mine and shared, quietest first", () => {
    expect(filterGymClients(s.clients, "all", "coach")).toHaveLength(7);
    expect(filterGymClients(s.clients, "mine", "coach").map((c) => c.name)).toEqual(["Daniel Mensah", "Priya Sharma"]);
    expect(filterGymClients(s.clients, "shared", "t-mei").map((c) => c.name)).toEqual(["Priya Sharma"]);
    expect(filterGymClients(s.clients, { trainer: "t-luis" }, "coach")[0]?.name).toBe("Tom Fletcher");
  });
  it("puts clients who never trained first", () => {
    const list = [{ ...s.clients[0]!, lastSession: null, name: "Zed" }, s.clients[1]!];
    expect(filterGymClients(list, "all", "x")[0]?.name).toBe("Zed");
  });
  it("sums each trainer's clients and spots quiet ones", () => {
    const lines = trainerLines(s.members, s.clients);
    expect(lines.map((l) => l.member.role)).toEqual(["owner", "manager", "trainer", "trainer"]);
    const luis = lines.find((l) => l.member.id === "t-luis")!;
    expect(luis).toMatchObject({ clients: 2, sessions7: 4, quiet: 1 });
    expect(gymTotals(s.members, s.clients)).toEqual({ trainers: 4, clients: 7, sessions7: 14, quiet: 2 });
  });
  it("never offers to hand a client to their own trainer", () => {
    const priya = s.clients[0]!;
    expect(handOverTargets(s.members, priya).map((m) => m.id)).not.toContain("coach");
    expect(handOverTargets(s.members, priya)).toHaveLength(3);
  });
});

describe("gym text", () => {
  it("checks the gym name", () => {
    expect(gymNameProblem(" ")).toMatch(/name/);
    expect(gymNameProblem("x".repeat(61))).toMatch(/60/);
    expect(gymNameProblem("HELIX Performance")).toBeNull();
  });
  it("words the last session", () => {
    expect(lastSeenText(null, now)).toBe("No sessions yet");
    expect(lastSeenText("2026-11-09T08:00:00Z", now)).toBe("Today");
    expect(lastSeenText("2026-11-08T08:00:00Z", now)).toBe("Yesterday");
    expect(lastSeenText("2026-11-04T08:00:00Z", now)).toBe("5 days ago");
    expect(lastSeenText("2026-10-12T08:00:00Z", now)).toBe("4 weeks ago");
  });
  it("builds the invite link and message", () => {
    const link = gymInviteLink("https://apex.app", "a b");
    expect(link).toBe("https://apex.app/coach/?gym=a%20b");
    expect(gymInviteText(" HELIX ", "manager", link)).toBe(`Join HELIX on APEX as a manager. Open this link and sign in with your coach account: ${link}`);
  });
  it("counts invite days left, never below zero", () => {
    expect(inviteDaysLeft(s.invites[0]!, now)).toBe(12);
    expect(inviteDaysLeft({ ...s.invites[0]!, expiresAt: "2026-01-01T00:00:00Z" }, now)).toBe(0);
  });
  it("reads a database row", () => {
    const c = fromGymClientRow({ client_id: "c", client_name: "Ana", trainer_id: "t", trainer_name: "Tia", mode: "in_person", started_at: "x", last_session: null, sessions_7: 2, sessions_28: 5, program_name: null, last_check_in: null, shared_with: null });
    expect(c).toMatchObject({ id: "c", mode: "In person", sessions7: 2, sharedWith: [] });
  });
});
