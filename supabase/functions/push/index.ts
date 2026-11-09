// Push notifications for APEX (Web Push, the standard every browser and the iPhone home-screen app use).
// One file with no packages, so it can be pasted into the Supabase dashboard function editor.
//
//   POST { "action": "key" }   with a signed-in user → the public key the browser subscribes with.
//   POST { "action": "test" }  with a signed-in user → a test notification to that person's devices.
//   POST {} with header x-cron-secret                → sends new unread messages (Supabase Cron, every minute).
//
// The signing keys and the cron secret are made on first use and kept in public.push_config, which
// only this function and the database can read. Nothing to set by hand except deploying it with
// "Verify JWT" switched off (the cron call carries no user token).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. APP_URL is optional.

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

/* ---------- base64url ---------- */

export function b64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unb64u(s: string): Uint8Array {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(p);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

/* ---------- VAPID keys and signing (RFC 8292) ---------- */

export interface VapidKeys { publicKey: string; privateKey: string }

/** A new P-256 key pair: public key as the 65-byte uncompressed point, private key as d, both base64url. */
export async function makeVapidKeys(): Promise<VapidKeys> {
  const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const jwk = await subtle.exportKey("jwk", pair.privateKey) as JsonWebKey;
  const pub = concat(new Uint8Array([4]), unb64u(jwk.x!), unb64u(jwk.y!));
  return { publicKey: b64u(pub), privateKey: jwk.d! };
}

async function signingKey(keys: VapidKeys): Promise<CryptoKey> {
  const pub = unb64u(keys.publicKey);
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", d: keys.privateKey, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true };
  return subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

/** The Authorization header value for one push service, valid for 12 hours. */
export async function vapidAuth(endpoint: string, keys: VapidKeys, subject: string, now = Date.now()): Promise<string> {
  const header = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const unsigned = `${header}.${claims}`;
  const sig = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await signingKey(keys), enc.encode(unsigned)));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${keys.publicKey}`;
}

/* ---------- Payload encryption (RFC 8291, aes128gcm) ---------- */

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

/** Encrypts `payload` for one browser subscription. `salt` and `serverKeys` are only passed in tests. */
export async function encryptPayload(
  sub: { p256dh: string; auth: string },
  payload: Uint8Array,
  opts: { salt?: Uint8Array; serverKeys?: CryptoKeyPair } = {},
): Promise<Uint8Array> {
  const uaPublic = unb64u(sub.p256dh);
  const authSecret = unb64u(sub.auth);
  const salt = opts.salt ?? globalThis.crypto.getRandomValues(new Uint8Array(16));
  const server = opts.serverKeys ?? (await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair);
  const asPublic = new Uint8Array(await subtle.exportKey("raw", server.publicKey));
  const uaKey = await subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: uaKey }, server.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const key = await subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const body = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, body);
}

/* ---------- What a notification says ---------- */

export interface PushMessage { title: string; body: string; url: string; tag: string }

/** One notification for everything new from the same people: the sender's name and the latest message. */
export function pushContent(a: { role: string; senders: string[]; unread: number; latest: string; appUrl: string }): PushMessage {
  const who = a.senders.filter(Boolean);
  const title = who.length === 1 ? who[0]! : who.length > 1 ? `${who.length} people messaged you` : "APEX";
  const text = a.latest.replace(/\s+/g, " ").trim();
  const short = text.length > 140 ? `${text.slice(0, 137).trimEnd()}…` : text;
  const body = a.unread > 1 ? `${short} (+${a.unread - 1} more)` : short;
  const base = (a.appUrl || "").replace(/\/+$/, "");
  return { title, body, url: `${base}/${a.role === "coach" ? "coach" : "client"}/?open=chat`, tag: "apex-messages" };
}

/* ---------- Sending ---------- */

export interface Subscription { id: string; endpoint: string; p256dh: string; auth: string }

/** Sends one notification. Returns "gone" when the browser unsubscribed, so the row can be removed. */
export async function sendPush(sub: Subscription, msg: PushMessage, keys: VapidKeys, subject: string): Promise<"ok" | "gone" | string> {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(msg)));
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: { Authorization: await vapidAuth(sub.endpoint, keys, subject), TTL: "86400", Urgency: "high", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream" },
    body,
  });
  if (res.ok) return "ok";
  if (res.status === 404 || res.status === 410) return "gone";
  return `${res.status}: ${(await res.text()).slice(0, 160)}`;
}

/* ---------- The function ---------- */

const env = (k: string) => (typeof Deno !== "undefined" ? Deno.env.get(k) ?? "" : "");
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** Calls a database function as the service role. */
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

interface Config { public_key: string | null; private_key: string | null; cron_secret: string }

/** The keys, made and saved the first time they're needed. */
async function config(): Promise<{ keys: VapidKeys; cronSecret: string }> {
  let c = await rpc<Config>("push_config_get");
  if (!c.public_key || !c.private_key) {
    const k = await makeVapidKeys();
    c = await rpc<Config>("push_config_set_keys", { p_public: k.publicKey, p_private: k.privateKey });
  }
  return { keys: { publicKey: c.public_key!, privateKey: c.private_key! }, cronSecret: c.cron_secret };
}

/** The signed-in user behind a request, from their access token. */
async function caller(req: Request): Promise<{ id: string; role: string } | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const res = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, { headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: auth } });
  if (!res.ok) return null;
  const u = await res.json() as { id?: string };
  if (!u.id) return null;
  const rows = await rpc<{ role: string }[]>("push_user_role", { p_user: u.id });
  return { id: u.id, role: rows?.[0]?.role ?? "client" };
}

interface Pending { user_id: string; role: string; senders: string[]; unread: number; latest: string; message_ids: string[]; subscriptions: Subscription[] }

export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const input = await req.json().catch(() => ({})) as { action?: string };
  const { keys, cronSecret } = await config();
  const subject = env("APP_URL") || "https://apex-coaching-os-web.vercel.app";
  const appUrl = env("APP_URL") || subject;

  if (input.action === "key" || input.action === "test") {
    const me = await caller(req);
    if (!me) return json({ error: "Sign in first." }, 401);
    if (input.action === "key") return json({ publicKey: keys.publicKey });
    const subs = await rpc<Subscription[]>("push_subscriptions_of", { p_user: me.id });
    if (!subs?.length) return json({ error: "No device is signed up for notifications yet." }, 400);
    let sent = 0;
    for (const s of subs) {
      const r = await sendPush(s, { title: "APEX", body: "Notifications are on. You'll hear about new messages here.", url: `${appUrl}/${me.role === "coach" ? "coach" : "client"}/`, tag: "apex-test" }, keys, subject);
      if (r === "ok") sent++;
      else if (r === "gone") await rpc("push_subscription_gone", { p_id: s.id });
    }
    return json({ sent });
  }

  if (req.headers.get("x-cron-secret") !== cronSecret) return json({ error: "Not allowed" }, 401);
  const due = (await rpc<Pending[]>("pending_push_alerts")) ?? [];
  let sent = 0;
  const failed: string[] = [];
  for (const p of due.slice(0, 200)) {
    const msg = pushContent({ role: p.role, senders: p.senders, unread: p.unread, latest: p.latest, appUrl });
    let any = false;
    for (const s of p.subscriptions) {
      const r = await sendPush(s, msg, keys, subject);
      if (r === "ok") any = true;
      else if (r === "gone") await rpc("push_subscription_gone", { p_id: s.id });
      else failed.push(r);
    }
    // Mark even when every device had gone, so a dead subscription doesn't retry forever.
    await rpc("mark_push_sent", { p_ids: p.message_ids });
    if (any) sent++;
  }
  return json({ due: due.length, sent, failed });
}

if (typeof Deno !== "undefined") Deno.serve((req: Request) => handle(req).catch((e: unknown) => json({ error: e instanceof Error ? e.message : String(e) }, 500)));
