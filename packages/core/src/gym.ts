/* Gym: several trainers under one business account. The owner starts the gym and invites trainers and managers by link.
   Managers (and the owner) see every trainer's clients, hand a client over to another trainer and share a client with a
   second trainer. Trainers see their own clients plus the ones shared with them. A shared trainer can follow how the
   client is doing; only the main trainer changes their plan or chats with them.
   Pure helpers, unit tested. Mirrors supabase/migrations/20261115090000_gyms.sql: the database makes the same checks. */

export type GymRole = "owner" | "manager" | "trainer";

export interface Gym {
  id: string;
  name: string;
  myRole: GymRole;
}

export interface GymMember {
  id: string;
  name: string;
  role: GymRole;
  joinedAt: string;
  isMe: boolean;
}

export interface GymClient {
  id: string;
  name: string;
  trainerId: string;
  trainerName: string;
  mode: string;
  startedAt: string;
  /** ISO time of the last finished session, or null. */
  lastSession: string | null;
  sessions7: number;
  sessions28: number;
  programName: string | null;
  lastCheckIn: string | null;
  /** Trainers this client is shared with (besides the main trainer). */
  sharedWith: { id: string; name: string }[];
}

export interface GymInvite {
  token: string;
  role: Exclude<GymRole, "owner">;
  createdAt: string;
  expiresAt: string;
}

export const GYM_NAME_MIN = 2;
export const GYM_NAME_MAX = 60;
export const INVITE_DAYS = 14;

export const ROLE_LABEL: Record<GymRole, string> = { owner: "Owner", manager: "Manager", trainer: "Trainer" };

/** What each role can do, in the words shown on the roles card. */
export const ROLE_RIGHTS: Record<GymRole, string[]> = {
  owner: ["Everything a manager can do", "Makes trainers managers, or back again", "Renames or closes the gym"],
  manager: ["Sees every trainer's clients", "Invites trainers and removes them", "Hands clients over and shares them"],
  trainer: ["Coaches their own clients", "Sees clients shared with them", "Shares their own clients with a teammate"],
};

export function gymNameProblem(name: string): string | null {
  const n = name.trim();
  if (n.length < GYM_NAME_MIN) return "Give your gym a name.";
  if (n.length > GYM_NAME_MAX) return `Keep the name to ${GYM_NAME_MAX} characters.`;
  return null;
}

/** Owner and managers run the gym. */
export const isLead = (role: GymRole | null | undefined): boolean => role === "owner" || role === "manager";

/** Who may send an invite for this role. Only the owner makes managers. */
export function canInvite(me: GymRole, role: Exclude<GymRole, "owner">): boolean {
  return role === "manager" ? me === "owner" : isLead(me);
}

/** Only the owner changes roles, and never their own. */
export function canChangeRole(me: GymRole, them: GymMember): boolean {
  return me === "owner" && them.role !== "owner" && !them.isMe;
}

/** Owner removes anyone but themselves; managers remove trainers. Anyone but the owner can leave. */
export function canRemove(me: GymRole, them: GymMember): boolean {
  if (them.isMe) return them.role !== "owner";
  if (them.role === "owner") return false;
  return me === "owner" || (me === "manager" && them.role === "trainer");
}

/** Leads hand over any client; nobody else does. */
export const canHandOver = (me: GymRole): boolean => isLead(me);

/** Leads share any client; a trainer shares their own. */
export function canShare(me: GymRole, myId: string, c: GymClient): boolean {
  return isLead(me) || c.trainerId === myId;
}

export type ClientFilter = "all" | "mine" | "shared" | { trainer: string };

/** The client list for a filter, quietest first so the ones who need a nudge come up top. */
export function filterGymClients(list: GymClient[], f: ClientFilter, myId: string): GymClient[] {
  const keep = list.filter((c) =>
    f === "all" ? true
    : f === "mine" ? c.trainerId === myId
    : f === "shared" ? c.sharedWith.some((s) => s.id === myId)
    : c.trainerId === f.trainer);
  return keep.sort((a, b) => (a.lastSession ?? "").localeCompare(b.lastSession ?? "") || a.name.localeCompare(b.name));
}

export interface TrainerLine {
  member: GymMember;
  clients: number;
  sessions7: number;
  /** Clients with no session in the last 7 days. */
  quiet: number;
}

const ORDER: Record<GymRole, number> = { owner: 0, manager: 1, trainer: 2 };

/** One line per member with their client numbers: owner first, then managers, then trainers, A to Z. */
export function trainerLines(members: GymMember[], clients: GymClient[]): TrainerLine[] {
  return [...members]
    .sort((a, b) => ORDER[a.role] - ORDER[b.role] || a.name.localeCompare(b.name))
    .map((m) => {
      const mine = clients.filter((c) => c.trainerId === m.id);
      return { member: m, clients: mine.length, sessions7: mine.reduce((a, c) => a + c.sessions7, 0), quiet: mine.filter((c) => c.sessions7 === 0).length };
    });
}

export interface GymTotals {
  trainers: number;
  clients: number;
  sessions7: number;
  quiet: number;
}

export function gymTotals(members: GymMember[], clients: GymClient[]): GymTotals {
  return {
    trainers: members.length,
    clients: clients.length,
    sessions7: clients.reduce((a, c) => a + c.sessions7, 0),
    quiet: clients.filter((c) => c.sessions7 === 0).length,
  };
}

/** Teammates a client can be handed to: anyone in the gym but their current trainer. */
export const handOverTargets = (members: GymMember[], c: GymClient): GymMember[] => members.filter((m) => m.id !== c.trainerId);

/** Teammates a client can be shared with: anyone but their main trainer. */
export const shareTargets = handOverTargets;

/** "Today", "Yesterday", "3 days ago", "No sessions yet". */
export function lastSeenText(iso: string | null, now = new Date()): string {
  if (!iso) return "No sessions yet";
  const days = Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

export const gymInviteLink = (origin: string, token: string): string => `${origin}/coach/?gym=${encodeURIComponent(token)}`;

export function gymInviteText(gymName: string, role: Exclude<GymRole, "owner">, link: string): string {
  return `Join ${gymName.trim()} on APEX as a ${ROLE_LABEL[role].toLowerCase()}. Open this link and sign in with your coach account: ${link}`;
}

/** Days left on an invite, at least 0. */
export function inviteDaysLeft(inv: GymInvite, now = new Date()): number {
  return Math.max(0, Math.ceil((Date.parse(inv.expiresAt) - now.getTime()) / 86_400_000));
}

/* ───── rows from the database ───── */

export interface GymClientRow {
  client_id: string;
  client_name: string;
  trainer_id: string;
  trainer_name: string;
  mode: string;
  started_at: string;
  last_session: string | null;
  sessions_7: number;
  sessions_28: number;
  program_name: string | null;
  last_check_in: string | null;
  shared_with: { id: string; name: string }[] | null;
}

const MODE: Record<string, string> = { online: "Online", hybrid: "Hybrid", in_person: "In person" };

export function fromGymClientRow(r: GymClientRow): GymClient {
  return {
    id: r.client_id, name: r.client_name, trainerId: r.trainer_id, trainerName: r.trainer_name,
    mode: MODE[r.mode] ?? "Online", startedAt: r.started_at, lastSession: r.last_session,
    sessions7: Number(r.sessions_7) || 0, sessions28: Number(r.sessions_28) || 0,
    programName: r.program_name, lastCheckIn: r.last_check_in, sharedWith: r.shared_with ?? [],
  };
}

/* ───── sample gym for the demo ───── */

export interface GymSample {
  gym: Gym;
  members: GymMember[];
  clients: GymClient[];
  invites: GymInvite[];
}

/** A sample gym run by Kamal, with a manager and two trainers, for the demo and tests. */
export function sampleGym(now = new Date()): GymSample {
  const ago = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
  const members: GymMember[] = [
    { id: "coach", name: "Kamal Amroche", role: "owner", joinedAt: ago(120), isMe: true },
    { id: "t-amara", name: "Amara Okafor", role: "manager", joinedAt: ago(90), isMe: false },
    { id: "t-luis", name: "Luis Moreno", role: "trainer", joinedAt: ago(60), isMe: false },
    { id: "t-mei", name: "Mei Tanaka", role: "trainer", joinedAt: ago(21), isMe: false },
  ];
  const c = (id: string, name: string, trainer: GymMember, mode: string, last: number | null, s7: number, s28: number, program: string, shared: GymMember[] = []): GymClient => ({
    id, name, trainerId: trainer.id, trainerName: trainer.name, mode, startedAt: ago(40), lastSession: last === null ? null : ago(last),
    sessions7: s7, sessions28: s28, programName: program, lastCheckIn: ago(3), sharedWith: shared.map((m) => ({ id: m.id, name: m.name })),
  });
  const [kamal, amara, luis, mei] = members as [GymMember, GymMember, GymMember, GymMember];
  const clients: GymClient[] = [
    c("c-priya", "Priya Sharma", kamal, "Hybrid", 0, 3, 12, "Foundations", [mei]),
    c("c-daniel", "Daniel Mensah", kamal, "Online", 2, 2, 9, "Hybrid race prep"),
    c("c-sofia", "Sofia Rossi", amara, "In person", 1, 3, 11, "Strength block"),
    c("c-jamal", "Jamal Hughes", amara, "Online", 9, 0, 4, "Fat loss 12 weeks"),
    c("c-aisha", "Aisha Bello", luis, "Hybrid", 0, 4, 14, "Lower body focus", [amara]),
    c("c-tom", "Tom Fletcher", luis, "Online", 12, 0, 2, "Run 10K"),
    c("c-hana", "Hana Kim", mei, "In person", 3, 2, 7, "Postnatal return"),
  ];
  const invites: GymInvite[] = [{ token: "demo-invite", role: "trainer", createdAt: ago(2), expiresAt: ago(2 - INVITE_DAYS) }];
  return { gym: { id: "gym-demo", name: "HELIX Performance", myRole: "owner" }, members, clients, invites };
}
