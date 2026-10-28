import { connectState, fromStravaActivity, newKey, providerFromState, stravaAuthorizeUrl, type ActivityStore, type StravaActivity } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StravaLink } from "./ActivityContext";

/* The client side of "Connect Strava". The secret half (swapping the code for tokens, refreshing them,
   calling Strava's API) is the `strava` edge function in supabase/functions/strava. */

const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID as string | undefined;
const STATE_KEY = "apex-connect-state";

/** Every provider sends the client back here. */
export const redirectUri = (): string => `${location.origin}/client/`;

/** The `state` we sent, so a reply that isn't ours is ignored. Shared by every provider. */
export function rememberState(state: string) {
  try { sessionStorage.setItem(STATE_KEY, state); } catch { /* in-app browsers can block storage */ }
}
/** undefined: storage is blocked, so there's nothing to compare against. */
export function recalledState(): string | null | undefined {
  try { return sessionStorage.getItem(STATE_KEY); } catch { return undefined; }
}

async function call<T>(db: SupabaseClient, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.functions.invoke("strava", { body });
  if (error) {
    // The function's own message (e.g. "Strava isn't set up yet") is more use than "non-2xx status".
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error((detail as { error?: string } | null)?.error ?? error.message);
  }
  return data as T;
}

export function liveStravaLink(db: SupabaseClient, store: ActivityStore & { reload?: () => Promise<void> }): StravaLink {
  return {
    available: !!clientId,
    connect() {
      if (!clientId) return;
      const state = connectState("strava", newKey());
      rememberState(state);
      location.assign(stravaAuthorizeUrl(clientId, redirectUri(), state));
    },
    async sync() {
      const last = store.get().connections.find((c) => c.provider === "strava")?.lastSyncAt;
      // A week of overlap, so an activity edited on Strava after it was first brought in gets refreshed.
      const after = last ? Math.floor(new Date(last).getTime() / 1000) - 7 * 86400 : undefined;
      const { activities } = await call<{ activities: StravaActivity[] }>(db, { action: "activities", after });
      store.save(activities.map((a) => fromStravaActivity(a, newKey())));
      await store.reload?.();
      return activities.length;
    },
    async disconnect() {
      await call(db, { action: "disconnect" });
      store.removeConnection("strava");
    },
  };
}

/** Strava sends the client back to /client/?code=…&state=…&scope=…. Finishes the connection, then tidies the address bar. */
export async function finishStravaConnect(db: SupabaseClient): Promise<{ athleteName?: string } | null> {
  const q = new URLSearchParams(location.search);
  const code = q.get("code");
  const state = q.get("state");
  if (providerFromState(state) !== "strava") return null;
  const clear = () => history.replaceState(null, "", location.pathname);
  if (q.get("error")) { clear(); throw new Error("Strava wasn't connected. You can try again from Connected apps."); }
  const expected = recalledState();
  if (!code || (expected !== undefined && expected !== state)) { clear(); return null; }
  if (!(q.get("scope") ?? "").includes("activity:read")) {
    clear();
    throw new Error("APEX needs permission to see your activities. Tick “View data about your activities” on Strava and try again.");
  }
  try {
    return await call<{ athleteName?: string }>(db, { action: "connect", code });
  } finally {
    clear();
  }
}

/** The demo: no Strava account involved, so connecting just marks it connected. */
export function demoStravaLink(store: ActivityStore): StravaLink {
  return {
    available: true,
    connect: () => store.setConnection({ provider: "strava", athleteName: "Priya Sharma (demo)", connectedAt: new Date().toISOString(), lastSyncAt: new Date().toISOString() }),
    sync: async () => {
      const c = store.get().connections.find((x) => x.provider === "strava");
      if (c) store.setConnection({ ...c, lastSyncAt: new Date().toISOString() });
      return 0;
    },
    disconnect: async () => store.removeConnection("strava"),
  };
}
