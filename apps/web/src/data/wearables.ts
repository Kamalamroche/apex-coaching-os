import { connectState, localDate, newKey, providerFromState, recoveryFrom, WEARABLES, wearableAuthorizeUrl, type ActivityStore, type WearableProvider } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WearableLink } from "./ActivityContext";
import { recalledState, redirectUri, rememberState } from "./strava";

/* The client side of connecting Whoop, Oura, Fitbit and Polar. The `wearables` edge function holds
   the secrets and tokens; it hands back each provider's data, which recovery.ts reads. */

const CLIENT_IDS: Record<WearableProvider, string | undefined> = {
  whoop: import.meta.env.VITE_WHOOP_CLIENT_ID as string | undefined,
  oura: import.meta.env.VITE_OURA_CLIENT_ID as string | undefined,
  fitbit: import.meta.env.VITE_FITBIT_CLIENT_ID as string | undefined,
  polar: import.meta.env.VITE_POLAR_CLIENT_ID as string | undefined,
  // Garmin's API is only open to approved apps; no client id until then.
  garmin: undefined,
};

async function call<T>(db: SupabaseClient, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.functions.invoke("wearables", { body });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error((detail as { error?: string } | null)?.error ?? error.message);
  }
  return data as T;
}

export function liveWearableLink(db: SupabaseClient, store: ActivityStore & { reload?: () => Promise<void> }): WearableLink {
  return {
    available: (p) => !!CLIENT_IDS[p] && !WEARABLES[p].needsApproval,
    connect(p) {
      const id = CLIENT_IDS[p];
      if (!id) return;
      const state = connectState(p, newKey());
      rememberState(state);
      location.assign(wearableAuthorizeUrl(p, id, redirectUri(), state));
    },
    async sync(p) {
      const last = store.get().connections.find((c) => c.provider === p)?.lastSyncAt;
      // First time: a month, for the baselines. After that: the last few days, which may have been re-scored.
      const { data } = await call<{ data: unknown }>(db, { action: "pull", provider: p, days: last ? 4 : 30 });
      const days = recoveryFrom(p, data);
      store.saveRecovery(days);
      await store.reload?.();
      return days.length;
    },
    async disconnect(p) {
      await call(db, { action: "disconnect", provider: p });
      store.removeConnection(p);
    },
  };
}

/** Back from a provider's "Allow" page with ?code=…&state=apex-<provider>-…: finish connecting. */
export async function finishWearableConnect(db: SupabaseClient): Promise<{ provider: WearableProvider; athleteName?: string } | null> {
  const q = new URLSearchParams(location.search);
  const provider = providerFromState(q.get("state")) as WearableProvider | null;
  if (!provider || !(provider in WEARABLES)) return null;
  const clear = () => history.replaceState(null, "", location.pathname);
  if (q.get("error")) { clear(); throw new Error(`${WEARABLES[provider].name} wasn't connected. You can try again from Connected apps.`); }
  const code = q.get("code");
  const expected = recalledState();
  if (!code || (expected !== undefined && expected !== q.get("state"))) { clear(); return null; }
  try {
    const r = await call<{ athleteName?: string }>(db, { action: "connect", provider, code, redirectUri: redirectUri() });
    return { provider, ...r };
  } finally {
    clear();
  }
}

/** The demo: connecting marks the app connected; the sample ring's mornings are already there. */
export function demoWearableLink(store: ActivityStore): WearableLink {
  return {
    available: (p) => !WEARABLES[p].needsApproval,
    connect: (p) => store.setConnection({ provider: p, athleteName: "Priya Sharma (demo)", connectedAt: new Date().toISOString(), lastSyncAt: new Date().toISOString() }),
    sync: async (p) => {
      const c = store.get().connections.find((x) => x.provider === p);
      if (c) store.setConnection({ ...c, lastSyncAt: new Date().toISOString() });
      return store.get().recovery.filter((d) => d.date === localDate(new Date())).length;
    },
    disconnect: async (p) => store.removeConnection(p),
  };
}
