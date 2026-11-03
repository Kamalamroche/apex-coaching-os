// Emails people about messages that have waited unread, through Resend. Runs on Supabase Edge
// Functions (Deno), called every 10 minutes by a Supabase Cron job (see docs/email.md).
// Secrets (Supabase dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY   from resend.com → API Keys
//   EMAIL_FROM       e.g. "APEX <hello@yourdomain.co.uk>" on a domain verified in Resend
//   APP_URL          e.g. https://apex-coaching-os-web.vercel.app
//   CRON_SECRET      any long random text; the cron job sends it in the x-cron-secret header
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildAlertEmail } from "./content.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const MAX_PER_RUN = 50;

interface Pending {
  user_id: string;
  email: string;
  first_name: string;
  role: string;
  senders: string[];
  unread: number;
  latest: string;
  message_ids: string[];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!env("CRON_SECRET") || req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return json({ error: "Not allowed" }, 401);
  if (!env("RESEND_API_KEY") || !env("EMAIL_FROM") || !env("APP_URL")) return json({ error: "Email isn't set up yet: add RESEND_API_KEY, EMAIL_FROM and APP_URL." }, 503);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("pending_email_alerts");
  if (error) return json({ error: error.message }, 500);

  const due = ((data ?? []) as Pending[]).slice(0, MAX_PER_RUN);
  let sent = 0;
  const failed: string[] = [];
  for (const p of due) {
    const mail = buildAlertEmail({ firstName: p.first_name, role: p.role, senders: p.senders, unread: p.unread, latest: p.latest, appUrl: env("APP_URL") });
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env("EMAIL_FROM"), to: [p.email], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) {
      failed.push(`${res.status}: ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    // Only mark what actually went, so a failed send is tried again next run.
    const { error: markError } = await admin.rpc("mark_email_alerts_sent", { p_ids: p.message_ids });
    if (markError) failed.push(markError.message);
    else sent += 1;
  }
  return json({ due: due.length, sent, failed });
});
