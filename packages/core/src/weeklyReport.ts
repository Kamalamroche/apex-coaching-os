/* The coach's Monday report: last week in one card. Who trained, who went quiet, check-ins, new leads and clients,
   and money recorded. Pure, from the same records as client health and the business dashboard. */

import type { BizInput } from "./business";
import type { HealthInput } from "./health";
import { addDays } from "./lifestyle";
import { localDate } from "./recovery";
import { mondayOf, weekLabel } from "./story";

export interface ReportClient { id: string; name: string }

export interface WeeklyReport {
  /** "9 – 15 Nov" */
  label: string;
  sessions: number;
  /** Clients with at least one session, out of everyone coached that week. */
  trained: number;
  coached: number;
  /** Clients who did all the sessions their plan has (3 when unknown). */
  onPlan: number;
  checkIns: number;
  newLeads: number;
  newClients: number;
  /** Packs and programme sales recorded in the week, in pence. Monthly fees are not counted here. */
  moneyInPence: number;
  /** No session all week, by name. */
  quiet: ReportClient[];
  /** Most sessions in the week, when someone trained. */
  top: { client: ReportClient; sessions: number } | null;
  /** One line to read first. */
  headline: string;
}

const inRange = (iso: string, from: string, to: string) => {
  const day = localDate(new Date(iso));
  return day >= from && day < to;
};

/** Last full week, Monday to Sunday, before the week `now` is in. */
export function weeklyReport(input: { clients: ReportClient[]; health: Record<string, HealthInput>; biz: BizInput; now: Date }): WeeklyReport {
  const to = mondayOf(localDate(input.now));
  const from = addDays(to, -7);
  const coachedClients = input.clients.filter((c) => {
    const h = input.health[c.id];
    return h && localDate(new Date(h.startedAt)) < to;
  });
  let sessions = 0;
  let checkIns = 0;
  let onPlan = 0;
  const quiet: ReportClient[] = [];
  let top: WeeklyReport["top"] = null;
  for (const c of coachedClients) {
    const h = input.health[c.id]!;
    const n = h.sessions.filter((s) => inRange(s, from, to)).length;
    sessions += n;
    checkIns += h.checkIns.filter((s) => inRange(s, from, to)).length;
    if (n >= (h.plannedPerWeek ?? 3)) onPlan++;
    if (n === 0) quiet.push(c);
    if (n > 0 && (!top || n > top.sessions)) top = { client: c, sessions: n };
  }
  const trained = coachedClients.length - quiet.length;
  const newLeads = input.biz.leads.filter((l) => inRange(l.createdAt, from, to)).length;
  const newClients = input.biz.clients.filter((c) => c.status !== "invited" && inRange(c.startedAt, from, to)).length;
  const moneyInPence =
    input.biz.packs.filter((p) => inRange(p.boughtAt, from, to)).reduce((a, p) => a + Math.max(0, p.pricePence), 0) +
    input.biz.sales.filter((s) => inRange(s.at, from, to)).reduce((a, s) => a + Math.max(0, s.paidPence), 0);
  quiet.sort((a, b) => a.name.localeCompare(b.name));
  const headline = !coachedClients.length
    ? "No clients last week yet. Your first report fills in after their first week."
    : quiet.length === 0
      ? `Everyone trained last week. ${sessions} session${sessions === 1 ? "" : "s"} in total.`
      : `${trained} of ${coachedClients.length} trained. ${quiet.length === 1 ? `${first(quiet[0]!.name)} went quiet` : `${quiet.length} went quiet`}: a quick message now keeps them.`;
  return { label: weekLabel(from), sessions, trained, coached: coachedClients.length, onPlan, checkIns, newLeads, newClients, moneyInPence, quiet, top, headline };
}

const first = (name: string) => name.split(" ")[0] ?? name;
