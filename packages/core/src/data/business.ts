import type { BizClient, BizInput } from "../business";
import type { HealthInput } from "../health";
import { CLIENTS } from "./clients";

const DAY = 864e5;
const iso = (now: Date, daysAgo: number) => new Date(now.getTime() - daysAgo * DAY).toISOString();
const day = (now: Date, daysAgo: number) => iso(now, daysAgo).slice(0, 10);

/** Sample business for the demo: the six sample clients, two who left, a few leads, packs and sessions. */
export function sampleBusiness(now: Date): BizInput {
  const started = [160, 120, 95, 220, 40, 75];
  const clients: BizClient[] = CLIENTS.map((c, i): BizClient => ({ id: String(c.id), name: c.name, status: "active", startedAt: iso(now, started[i]!), endedAt: null, feePence: c.monthlyRevenue * 100 }));
  clients.push(
    { id: "x1", name: "Tom Reid", status: "ended", startedAt: iso(now, 200), endedAt: iso(now, 12), feePence: 15000 },
    { id: "x2", name: "Ama Owusu", status: "ended", startedAt: iso(now, 170), endedAt: iso(now, 70), feePence: 12000 },
  );
  const lead = (d: number, stage: string, source: string) => ({ createdAt: iso(now, d), stage, source });
  const session = (d: number, attendance: "attended" | "no_show" | null, status: "booked" | "cancelled" = "booked", late = false) => ({ startsAt: iso(now, d), kind: "session" as const, status, attendance, late });
  return {
    now,
    clients,
    leads: [lead(3, "new", "instagram"), lead(9, "contacted", "instagram"), lead(14, "client", "referral"), lead(20, "client", "instagram"), lead(31, "lost", "page"), lead(40, "trial", "referral"), lead(44, "client", "page"), lead(60, "lost", "instagram"), lead(75, "client", "referral")],
    bookings: [session(1, "attended"), session(3, "attended"), session(5, "attended"), session(8, "no_show"), session(10, "attended"), session(12, null, "cancelled", true), session(15, "attended"), session(17, "attended"), session(22, "attended"), session(24, "attended"), session(26, "attended"), session(29, "attended")],
    packs: [{ boughtAt: iso(now, 6), pricePence: 30000 }, { boughtAt: iso(now, 38), pricePence: 30000 }, { boughtAt: iso(now, 66), pricePence: 55000 }],
    sales: [{ at: iso(now, 4), paidPence: 4900 }, { at: iso(now, 33), paidPence: 4900 }, { at: iso(now, 35), paidPence: 2900 }],
  };
}

/** Sample health inputs matching each sample client's story (Sarah slipping, Omar flying). */
export function sampleHealth(now: Date): Record<number, HealthInput> {
  const sessions = (...d: number[]) => d.map((x) => iso(now, x));
  const days = (...d: number[]) => d.map((x) => day(now, x));
  const everyDay = [{ days: [0, 1, 2, 3, 4, 5, 6], createdAt: iso(now, 60) }];
  const base = { startedAt: iso(now, 120), plannedPerWeek: 3, habits: everyDay, hasFoodTargets: true };
  return {
    1: { ...base, sessions: sessions(4, 13, 18), checkIns: sessions(19), habitTicks: days(4, 5), foodDays: days(5), clientMessages: sessions(9) },
    2: { ...base, plannedPerWeek: 4, sessions: sessions(1, 3, 5, 8, 10, 12), checkIns: sessions(6), habitTicks: days(0, 1, 2, 4, 5), foodDays: days(1, 2, 4), clientMessages: sessions(2) },
    3: { ...base, sessions: sessions(2, 6, 9, 13), checkIns: sessions(10), habitTicks: days(0, 2, 3, 5), foodDays: days(0, 1, 3, 5), clientMessages: sessions(5) },
    4: { ...base, plannedPerWeek: 4, sessions: sessions(0, 2, 4, 6, 8, 9, 11, 13), checkIns: sessions(2), habitTicks: days(0, 1, 2, 3, 4, 5, 6), foodDays: days(0, 1, 2, 3, 4, 5), clientMessages: sessions(0) },
    5: { ...base, sessions: sessions(0, 2, 5, 7, 9, 12), checkIns: sessions(3), habitTicks: days(0, 1, 2, 3, 5, 6), foodDays: days(0, 1, 2, 3, 4), clientMessages: sessions(1) },
    6: { ...base, sessions: sessions(1, 4, 6, 11, 13), checkIns: sessions(8), habitTicks: days(0, 1, 3, 4), foodDays: days(0, 2, 3), clientMessages: sessions(4) },
  };
}
