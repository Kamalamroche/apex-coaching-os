/* Offline in the gym: what the client did with no signal waits on the phone, in order, and is sent once
   the phone is back online. Pure helpers; storage and sending live in the app. Unit tested. */

export type OutboxJob =
  /** A finished session: the sessions row and its sets (session_id is filled in when it's sent). */
  | { kind: "session"; id: string; at: string; row: Record<string, unknown>; summary: unknown; sets: Record<string, unknown>[] }
  | { kind: "message"; id: string; at: string; body: string };

/** Errors that mean "no connection", not "the server said no". Chrome, Firefox and Safari word it differently. */
export function isNetworkError(e: unknown, online = true): boolean {
  if (!online) return true;
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  return /Failed to fetch|NetworkError|Load failed|Network request failed|fetch failed|ERR_INTERNET_DISCONNECTED|ERR_NETWORK/i.test(msg);
}

export const readOutbox = (raw: string | null): OutboxJob[] => {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((j): j is OutboxJob => !!j && typeof j === "object" && ((j as OutboxJob).kind === "session" || (j as OutboxJob).kind === "message")) : [];
  } catch {
    return [];
  }
};

/** Adds a job, keeping at most `max` (the oldest go first, so a phone left offline for weeks can't fill up). */
export const addJob = (list: OutboxJob[], job: OutboxJob, max = 50): OutboxJob[] => [...list, job].slice(-max);

/** Sets saved without their session, given the session's new id. */
export const withSessionId = (sets: Record<string, unknown>[], sessionId: string) => sets.map((s) => ({ ...s, session_id: sessionId }));

/** "2 sessions and 1 message waiting to send". */
export function outboxLabel(list: OutboxJob[]): string {
  const s = list.filter((j) => j.kind === "session").length;
  const m = list.length - s;
  const parts = [s ? `${s} session${s === 1 ? "" : "s"}` : "", m ? `${m} message${m === 1 ? "" : "s"}` : ""].filter(Boolean);
  return parts.length ? `${parts.join(" and ")} waiting to send` : "";
}
