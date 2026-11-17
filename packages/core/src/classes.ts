/* Group classes with a capacity and a waitlist. The fair queue itself lives in the database (join_class, leave_class);
   this is how a class reads on screen. Pure, so it is unit tested. */

export interface GroupClass { id: string; title: string; startsAt: string; minutes: number; capacity: number; place: string; note: string; cancelled: boolean }
export interface ClassView extends GroupClass { booked: number; waiting: number; myStatus: "booked" | "waitlist" | "cancelled" | null; myPlace: number | null }
export interface ClassSpot { clientId: string; name: string; status: "booked" | "waitlist" | "cancelled"; joinedAt: string }

export const CLASS_TITLE_MAX = 60;

export function classProblem(c: { title: string; startsAt: string; minutes: number; capacity: number; place: string; note: string }, now: Date): string | null {
  if (c.title.trim().length < 2) return "Give the class a name";
  if (c.title.trim().length > CLASS_TITLE_MAX) return `Keep the name under ${CLASS_TITLE_MAX} characters`;
  const t = Date.parse(c.startsAt);
  if (!Number.isFinite(t)) return "Pick a date and time";
  if (t <= now.getTime()) return "Pick a time in the future";
  if (!Number.isInteger(c.minutes) || c.minutes < 10 || c.minutes > 240) return "Classes run 10 to 240 minutes";
  if (!Number.isInteger(c.capacity) || c.capacity < 1 || c.capacity > 200) return "Places: 1 to 200";
  if (c.place.length > 120) return "Keep the place under 120 characters";
  if (c.note.length > 300) return "Keep the note under 300 characters";
  return null;
}

/** "3 places left", "Full · 2 waiting", "Cancelled". */
export function classAvailability(c: Pick<ClassView, "booked" | "waiting" | "capacity" | "cancelled">): string {
  if (c.cancelled) return "Cancelled";
  const left = c.capacity - c.booked;
  if (left > 0) return `${left} place${left === 1 ? "" : "s"} left`;
  return c.waiting ? `Full · ${c.waiting} waiting` : "Full · join the waitlist";
}

/** What the client's own button and line should say. */
export function myClassLine(c: Pick<ClassView, "myStatus" | "myPlace" | "booked" | "capacity" | "cancelled">): { line: string; action: "join" | "wait" | "leave" | null } {
  if (c.cancelled) return { line: "Your coach cancelled this class", action: null };
  if (c.myStatus === "booked") return { line: "You're booked in", action: "leave" };
  if (c.myStatus === "waitlist") return { line: `You're number ${c.myPlace ?? 1} on the waitlist. You'll move up automatically if a place frees up.`, action: "leave" };
  return { line: "", action: c.booked < c.capacity ? "join" : "wait" };
}

/** The coach's view of one class: booked people, then the queue in order. */
export function classRoster(spots: ClassSpot[]): { booked: ClassSpot[]; waiting: ClassSpot[] } {
  const live = spots.filter((s) => s.status !== "cancelled");
  return {
    booked: live.filter((s) => s.status === "booked").sort((a, b) => a.name.localeCompare(b.name)),
    waiting: live.filter((s) => s.status === "waitlist").sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.clientId.localeCompare(b.clientId)),
  };
}

/** Demo: the same queue rules as the database, so the sample behaves like the real thing. */
export function demoJoin(spots: ClassSpot[], capacity: number, clientId: string, name: string, at: string): { spots: ClassSpot[]; status: "booked" | "waitlist" } {
  const cur = spots.find((s) => s.clientId === clientId && s.status !== "cancelled");
  if (cur) return { spots, status: cur.status as "booked" | "waitlist" };
  const booked = spots.filter((s) => s.status === "booked").length;
  const status = booked < capacity ? "booked" : "waitlist";
  return { spots: [...spots.filter((s) => s.clientId !== clientId), { clientId, name, status, joinedAt: at }], status };
}

export function demoLeave(spots: ClassSpot[], capacity: number, clientId: string): ClassSpot[] {
  let next = spots.map((s) => (s.clientId === clientId ? { ...s, status: "cancelled" as const } : s));
  let booked = next.filter((s) => s.status === "booked").length;
  for (const w of classRoster(next).waiting) {
    if (booked >= capacity) break;
    next = next.map((s) => (s.clientId === w.clientId ? { ...s, status: "booked" as const } : s));
    booked++;
  }
  return next;
}
