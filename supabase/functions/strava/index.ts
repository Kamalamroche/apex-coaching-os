// Strava connection for APEX clients. Runs on Supabase Edge Functions (Deno).
// The browser never sees the app's secret or the client's tokens: it sends one of
//   { action: "connect", code }   after Strava sends the client back with ?code=…
//   { action: "activities", after? }  to bring in activities since a Unix time
//   { action: "disconnect" }
// with the signed-in user's token, and gets plain JSON back.
// Secrets (Supabase dashboard → Edge Functions → Secrets): STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const STRAVA = "https://www.strava.com";
const env = (k: string) => Deno.env.get(k) ?? "";

interface TokenReply {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
  message?: string;
}

async function token(body: Record<string, string>): Promise<TokenReply> {
  const res = await fetch(`${STRAVA}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: env("STRAVA_CLIENT_ID"), client_secret: env("STRAVA_CLIENT_SECRET"), ...body }),
  });
  const data = (await res.json()) as TokenReply;
  if (!res.ok) throw new Error(`Strava said no: ${data.message ?? res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!env("STRAVA_CLIENT_ID") || !env("STRAVA_CLIENT_SECRET")) return json({ error: "Strava isn't set up yet. Ask your coach." }, 503);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: "Sign in again, then try once more." }, 401);

  let body: { action?: string; code?: string; after?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  try {
    if (body.action === "connect") {
      if (!body.code) return json({ error: "Missing code" }, 400);
      const t = await token({ code: body.code, grant_type: "authorization_code" });
      const athleteName = [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(" ") || null;
      const { error: e1 } = await admin.from("device_tokens").upsert({
        client_id: user.id, provider: "strava", access_token: t.access_token, refresh_token: t.refresh_token, expires_at: new Date(t.expires_at * 1000).toISOString(),
      });
      if (e1) throw e1;
      const { error: e2 } = await admin.from("device_connections").upsert({
        client_id: user.id, provider: "strava", athlete_id: t.athlete ? String(t.athlete.id) : null, athlete_name: athleteName, connected_at: new Date().toISOString(),
      });
      if (e2) throw e2;
      return json({ athleteName });
    }

    const { data: saved, error: e3 } = await admin.from("device_tokens").select("access_token, refresh_token, expires_at").eq("client_id", user.id).eq("provider", "strava").maybeSingle();
    if (e3) throw e3;
    if (!saved) return json({ error: "Strava isn't connected." }, 404);
    let access = saved.access_token as string;
    // Strava tokens last six hours; refresh a minute early.
    if (new Date(saved.expires_at as string).getTime() < Date.now() + 60_000) {
      const t = await token({ refresh_token: saved.refresh_token as string, grant_type: "refresh_token" });
      access = t.access_token;
      await admin.from("device_tokens").update({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: new Date(t.expires_at * 1000).toISOString() }).eq("client_id", user.id).eq("provider", "strava");
    }

    if (body.action === "activities") {
      // First sync: the last 60 days. After that, from the time the app asks for.
      const after = Number.isFinite(body.after) ? Number(body.after) : Math.floor(Date.now() / 1000) - 60 * 86400;
      const all: unknown[] = [];
      for (let page = 1; page <= 4; page++) {
        const res = await fetch(`${STRAVA}/api/v3/athlete/activities?after=${after}&per_page=50&page=${page}`, { headers: { Authorization: `Bearer ${access}` } });
        if (res.status === 429) break; // rate limited: keep what we have, the next sync picks up the rest
        if (!res.ok) throw new Error(`Strava activities: ${res.status}`);
        const list = (await res.json()) as unknown[];
        all.push(...list);
        if (list.length < 50) break;
      }
      await admin.from("device_connections").update({ last_sync_at: new Date().toISOString() }).eq("client_id", user.id).eq("provider", "strava");
      return json({ activities: all });
    }

    if (body.action === "disconnect") {
      await fetch(`${STRAVA}/oauth/deauthorize`, { method: "POST", headers: { Authorization: `Bearer ${access}` } }).catch(() => null);
      await admin.from("device_tokens").delete().eq("client_id", user.id).eq("provider", "strava");
      await admin.from("device_connections").delete().eq("client_id", user.id).eq("provider", "strava");
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 500);
  }
});
