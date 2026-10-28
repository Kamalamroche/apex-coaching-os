/* The public half of connecting a watch or ring: where to send the client to say yes, which
   permissions to ask for, and which mapper reads what comes back. The secret half (client secrets,
   tokens, API calls) lives in the `wearables` edge function (supabase/functions/wearables). */

import { fromFitbit, fromGarmin, fromOura, fromPolar, fromWhoop, type FitbitData, type GarminData, type OuraData, type PolarData, type RecoveryDay, type WhoopData } from "./recovery";

export type WearableProvider = "whoop" | "oura" | "fitbit" | "polar" | "garmin";

export interface WearableInfo {
  name: string;
  /** What it brings in, for the Connected apps screen. */
  brings: string;
  authorize: string;
  scope: string;
  /** Garmin only lets apps in after it approves them. */
  needsApproval?: boolean;
}

export const WEARABLES: Record<WearableProvider, WearableInfo> = {
  whoop: { name: "Whoop", brings: "Recovery, sleep, HRV, resting heart rate, strain", authorize: "https://api.prod.whoop.com/oauth/oauth2/auth", scope: "offline read:recovery read:sleep read:cycles read:profile" },
  oura: { name: "Oura", brings: "Sleep, readiness, HRV, resting heart rate, stress, steps", authorize: "https://cloud.ouraring.com/oauth/authorize", scope: "email personal daily heartrate" },
  fitbit: { name: "Fitbit and Pixel Watch", brings: "Sleep, HRV, resting heart rate, steps", authorize: "https://www.fitbit.com/oauth2/authorize", scope: "sleep heartrate activity profile" },
  polar: { name: "Polar", brings: "Sleep, Nightly Recharge, HRV, resting heart rate", authorize: "https://flow.polar.com/oauth2/authorization", scope: "accesslink.read_all" },
  garmin: { name: "Garmin Connect", brings: "Sleep, stress, Body Battery, HRV, resting heart rate, steps", authorize: "https://connect.garmin.com/oauth2Confirm", scope: "", needsApproval: true },
};

export const WEARABLE_ORDER: WearableProvider[] = ["garmin", "whoop", "oura", "fitbit", "polar"];

export function wearableAuthorizeUrl(p: WearableProvider, clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", state });
  if (WEARABLES[p].scope) q.set("scope", WEARABLES[p].scope);
  return `${WEARABLES[p].authorize}?${q}`;
}

/** The edge function returns each provider's own data; this turns it into mornings. */
export function recoveryFrom(p: WearableProvider, data: unknown): RecoveryDay[] {
  switch (p) {
    case "whoop": return fromWhoop(data as WhoopData);
    case "oura": return fromOura(data as OuraData);
    case "fitbit": return fromFitbit(data as FitbitData);
    case "polar": return fromPolar(data as PolarData);
    case "garmin": return fromGarmin(data as GarminData);
  }
}

/** The `state` sent to a provider: "apex-<provider>-<random>", so the app knows who is calling back. */
export const connectState = (provider: string, nonce: string): string => `apex-${provider}-${nonce}`;
export function providerFromState(state: string | null): string | null {
  const m = /^apex-([a-z]+)-./.exec(state ?? "");
  return m?.[1] ?? null;
}
