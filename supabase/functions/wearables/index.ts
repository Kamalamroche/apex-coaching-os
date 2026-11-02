// Watches and rings for APEX clients: Whoop, Oura, Fitbit and Polar. Runs on Supabase Edge Functions (Deno).
// Like the `strava` function, the browser never sees an app secret or a client's tokens. It sends
//   { action: "connect", provider, code, redirectUri }  after the provider sends the client back
//   { action: "pull", provider, days? }                  for the last `days` mornings (default 30)
//   { action: "disconnect", provider }
// and gets the provider's own data back as JSON, which the app reads with packages/core/src/recovery.ts.
// Secrets (Supabase dashboard → Edge Functions → Secrets), only for the providers you use:
//   WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, OURA_CLIENT_ID, OURA_CLIENT_SECRET,
//   FITBIT_CLIENT_ID, FITBIT_CLIENT_SECRET, POLAR_CLIENT_ID, POLAR_CLIENT_SECRET.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) ?? "";

type Provider = "whoop" | "oura" | "fitbit" | "polar";
interface Tokens { access_token: string; refresh_token?: string; expires_in?: number; x_user_id?: number; user_id?: string }

const TOKEN_URL: Record<Provider, string> = {
  whoop: "https://api.prod.whoop.com/oauth/oauth2/token",
  oura: "https://api.ouraring.com/oauth/token",
  fitbit: "https://api.fitbit.com/oauth2/token",
  polar: "https://polarremote.com/v2/oauth2/token",
};
/** Fitbit and Polar want the app's id and secret as Basic auth; Whoop and Oura in the form. */
const BASIC: Record<Provider, boolean> = { whoop: false, oura: false, fitbit: true, polar: true };

const id = (p: Provider) => env(`${p.toUpperCase()}_CLIENT_ID`);
const secret = (p: Provider) => env(`${p.toUpperCase()}_CLIENT_SECRET`);

async function token(p: Provider, form: Record<string, string>): Promise<Tokens> {
  const body = new URLSearchParams(BASIC[p] ? form : { ...form, client_id: id(p), client_secret: secret(p) });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (BASIC[p]) headers.Authorization = `Basic ${btoa(`${id(p)}:${secret(p)}`)}`;
  const res = await fetch(TOKEN_URL[p], { method: "POST", headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${p} said no: ${data.error_description ?? data.error ?? res.status}`);
  return data as Tokens;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function get(url: string, access: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access}`, Accept: "application/json" } });
  if (res.status === 204 || res.status === 404) return {};
  if (res.status === 429) throw new Error("The provider is busy. Try again in a few minutes.");
  if (!res.ok) throw new Error(`${new URL(url).host}: ${res.status}`);
  return res.json();
}

/** Whoop and Oura page with a next token; keep going up to 10 pages. */
async function paged(url: string, access: string, tokenParam: string, nextKey: string): Promise<unknown[]> {
  const out: unknown[] = [];
  let next: string | null = null;
  for (let i = 0; i < 10; i++) {
    const u = new URL(url);
    if (next) u.searchParams.set(tokenParam, next);
    const page = await get(u.toString(), access);
    out.push(...(page.records ?? page.data ?? []));
    next = page[nextKey] ?? null;
    if (!next) break;
  }
  return out;
}

async function pull(p: Provider, access: string, days: number, polarUser: string | null): Promise<unknown> {
  const from = new Date(Date.now() - days * 86400000);
  const to = new Date(Date.now() + 86400000);
  if (p === "whoop") {
    const base = "https://api.prod.whoop.com/developer/v2";
    const q = `start=${from.toISOString()}&limit=25`;
    const [recovery, sleep, cycle] = await Promise.all([
      paged(`${base}/recovery?${q}`, access, "nextToken", "next_token"),
      paged(`${base}/activity/sleep?${q}`, access, "nextToken", "next_token"),
      paged(`${base}/cycle?${q}`, access, "nextToken", "next_token"),
    ]);
    return { recovery, sleep, cycle };
  }
  if (p === "oura") {
    const base = "https://api.ouraring.com/v2/usercollection";
    const q = `start_date=${ymd(from)}&end_date=${ymd(to)}`;
    const names = ["daily_sleep", "sleep", "daily_readiness", "daily_activity", "daily_stress"] as const;
    const lists = await Promise.all(names.map((n) => paged(`${base}/${n}?${q}`, access, "next_token", "next_token").catch(() => [])));
    return Object.fromEntries(names.map((n, i) => [n, lists[i]]));
  }
  if (p === "fitbit") {
    const span = `${ymd(from)}/${ymd(new Date())}`;
    const [sleep, hrv, heart, steps] = await Promise.all([
      get(`https://api.fitbit.com/1.2/user/-/sleep/date/${span}.json`, access),
      get(`https://api.fitbit.com/1/user/-/hrv/date/${span}.json`, access),
      get(`https://api.fitbit.com/1/user/-/activities/heart/date/${span}.json`, access),
      get(`https://api.fitbit.com/1/user/-/activities/steps/date/${span}.json`, access),
    ]);
    return { sleep: sleep.sleep ?? [], hrv: hrv.hrv ?? [], "activities-heart": heart["activities-heart"] ?? [], "activities-steps": steps["activities-steps"] ?? [] };
  }
  // Polar keeps the last 28 nights.
  if (!polarUser) throw new Error("Polar isn't fully connected. Disconnect and connect again.");
  const [sleep, recharge] = await Promise.all([
    get("https://www.polaraccesslink.com/v3/users/sleep", access),
    get("https://www.polaraccesslink.com/v3/users/nightly-recharge", access),
  ]);
  return { nights: sleep.nights ?? [], recharges: recharge.recharges ?? [] };
}

async function displayName(p: Provider, access: string): Promise<string | null> {
  try {
    if (p === "whoop") {
      const me = await get("https://api.prod.whoop.com/developer/v2/user/profile/basic", access);
      return [me.first_name, me.last_name].filter(Boolean).join(" ") || null;
    }
    if (p === "fitbit") return (await get("https://api.fitbit.com/1/user/-/profile.json", access)).user?.displayName ?? null;
  } catch { /* the name is only for show */ }
  return null;
}

async function saveTokens(admin: SupabaseClient, client: string, p: Provider, t: Tokens, keepRefresh?: string) {
  const { error } = await admin.from("device_tokens").upsert({
    client_id: client, provider: p, access_token: t.access_token, refresh_token: t.refresh_token ?? keepRefresh ?? "",
    // Polar tokens don't expire; give them a far date so they're never refreshed.
    expires_at: new Date(Date.now() + (t.expires_in ? t.expires_in * 1000 : 10 * 365 * 86400000)).toISOString(),
  });
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: "Sign in again, then try once more." }, 401);

  let body: { action?: string; provider?: Provider; code?: string; redirectUri?: string; days?: number };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const p = body.provider;
  if (!p || !(p in TOKEN_URL)) return json({ error: "Unknown app" }, 400);
  if (!id(p) || !secret(p)) return json({ error: `${p} isn't set up yet. Ask your coach.` }, 503);

  try {
    if (body.action === "connect") {
      if (!body.code || !body.redirectUri) return json({ error: "Missing code" }, 400);
      const t = await token(p, { grant_type: "authorization_code", code: body.code, redirect_uri: body.redirectUri });
      let athleteId: string | null = t.user_id ?? null;
      if (p === "polar") {
        // Polar needs each user registered with the app once; 409 means they already are.
        athleteId = String(t.x_user_id ?? "");
        const res = await fetch("https://www.polaraccesslink.com/v3/users", {
          method: "POST", headers: { Authorization: `Bearer ${t.access_token}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ "member-id": user.id }),
        });
        if (!res.ok && res.status !== 409) throw new Error(`Polar registration: ${res.status}`);
      }
      await saveTokens(admin, user.id, p, t);
      const athleteName = await displayName(p, t.access_token);
      const { error } = await admin.from("device_connections").upsert({ client_id: user.id, provider: p, athlete_id: athleteId, athlete_name: athleteName, connected_at: new Date().toISOString() });
      if (error) throw error;
      return json({ athleteName });
    }

    const { data: saved, error: e1 } = await admin.from("device_tokens").select("access_token, refresh_token, expires_at").eq("client_id", user.id).eq("provider", p).maybeSingle();
    if (e1) throw e1;
    if (!saved) return json({ error: "Not connected." }, 404);
    let access = saved.access_token as string;
    if (saved.refresh_token && new Date(saved.expires_at as string).getTime() < Date.now() + 60_000) {
      const t = await token(p, { grant_type: "refresh_token", refresh_token: saved.refresh_token as string, ...(p === "whoop" ? { scope: "offline" } : {}) });
      access = t.access_token;
      await saveTokens(admin, user.id, p, t, saved.refresh_token as string);
    }

    if (body.action === "pull") {
      const { data: link } = await admin.from("device_connections").select("athlete_id").eq("client_id", user.id).eq("provider", p).maybeSingle();
      const data = await pull(p, access, Math.min(90, Math.max(1, Number(body.days) || 30)), (link?.athlete_id as string | null) ?? null);
      await admin.from("device_connections").update({ last_sync_at: new Date().toISOString() }).eq("client_id", user.id).eq("provider", p);
      return json({ data });
    }

    if (body.action === "disconnect") {
      if (p === "polar") {
        const { data: link } = await admin.from("device_connections").select("athlete_id").eq("client_id", user.id).eq("provider", p).maybeSingle();
        if (link?.athlete_id) await fetch(`https://www.polaraccesslink.com/v3/users/${link.athlete_id}`, { method: "DELETE", headers: { Authorization: `Bearer ${access}` } }).catch(() => null);
      }
      if (p === "fitbit") await fetch("https://api.fitbit.com/oauth2/revoke", { method: "POST", headers: { Authorization: `Basic ${btoa(`${id(p)}:${secret(p)}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: access }) }).catch(() => null);
      if (p === "whoop") await fetch("https://api.prod.whoop.com/developer/v2/user/access", { method: "DELETE", headers: { Authorization: `Bearer ${access}` } }).catch(() => null);
      await admin.from("device_tokens").delete().eq("client_id", user.id).eq("provider", p);
      await admin.from("device_connections").delete().eq("client_id", user.id).eq("provider", p);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 500);
  }
});
