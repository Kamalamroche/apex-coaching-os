/* "Going quiet": clients with no finished session for a while, so the coach can reach out before they drift away.
   Rule-based (Insight), the nudge is a draft the coach edits and sends (Coach decision). Pure, so it is unit tested. */

export interface QuietInput { id: string; name: string; startedAt: string; lastSession: string | null }
export interface QuietClient extends QuietInput { days: number; never: boolean }

/** Days without a session before a client shows up here. */
export const QUIET_DAYS = 4;

/** Clients quiet for `days` or more, longest first. A new client gets a week to start before they count. */
export function goingQuiet(clients: QuietInput[], now: Date, days = QUIET_DAYS): QuietClient[] {
  const out: QuietClient[] = [];
  for (const c of clients) {
    const since = c.lastSession ?? c.startedAt;
    const gap = Math.floor((now.getTime() - new Date(since).getTime()) / 864e5);
    const never = !c.lastSession;
    if (never && gap < 7) continue;
    if (gap >= days) out.push({ ...c, days: gap, never });
  }
  return out.sort((a, b) => b.days - a.days);
}

/** A warm, no-pressure first message. UK English. */
export function quietNudge(firstName: string, days: number, never: boolean): string {
  const name = firstName || "there";
  if (never) return `Hi ${name}, how are you settling in? Your first session is ready whenever you are. If anything's getting in the way, tell me and I'll make it work for you.`;
  if (days >= 14) return `Hi ${name}, I've missed seeing your sessions come in. No pressure at all. Would a shorter plan for the next couple of weeks help you get going again?`;
  return `Hi ${name}, just checking in. It's been ${days} days since your last session. Everything okay? Even a quick 20 minutes this week keeps the momentum going.`;
}
