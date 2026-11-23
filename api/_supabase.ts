/* Shared by the page and sitemap functions. The publishable key is public by design (it is in
   apps/web/.env.production too); row level security protects the data. Vercel env vars win when set. */
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ptxtshirthnzovfbdyav.supabase.co";
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_C76AjkTIovUQmB_ZpDiNEA_OskXwgKR";

/** Calls a public database function. Gives up after 2.5 seconds so a slow database never blocks the page. */
export async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(2500),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}
