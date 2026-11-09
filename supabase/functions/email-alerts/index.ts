// Emails people about messages that have waited unread, and new enquiries (a welcome to the person who
// asked, an alert to their coach), through Resend. Runs on Supabase Edge
// Functions (Deno), called every 10 minutes by a Supabase Cron job (see docs/email.md).
// Secrets (Supabase dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY   from resend.com → API Keys
//   EMAIL_FROM       e.g. "APEX <hello@yourdomain.co.uk>" on a domain verified in Resend
//   APP_URL          e.g. https://apex-coaching-os-web.vercel.app
//   CRON_SECRET      any long random text; the cron job sends it in the x-cron-secret header
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildAlertEmail, buildLeadAlert, buildLeadWelcome } from "./content.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const MAX_PER_RUN = 50;

interface PendingLead {
  request_id: string;
  kind: "welcome" | "coach";
  to_email: string;
  reply_to: string | null;
  coach_name: string;
  lead_name: string;
  goal: string;
  message: string;
  phone: string;
  how: string;
  source: string;
  welcome_text: string;
}

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

  // New enquiries. Missing until 20261118090000_leads.sql has run: then skip quietly.
  let leadsSent = 0;
  const { data: leadRows, error: leadError } = await admin.rpc("pending_lead_emails");
  if (leadError && !/pending_lead_emails|PGRST202|42883/.test(`${leadError.code} ${leadError.message}`)) failed.push(leadError.message);
  const welcomed: string[] = [];
  const told: string[] = [];
  for (const l of ((leadRows ?? []) as PendingLead[]).slice(0, MAX_PER_RUN)) {
    const input = { coachName: l.coach_name, leadName: l.lead_name, goal: l.goal, message: l.message, phone: l.phone, how: l.how, source: l.source, welcomeText: l.welcome_text, appUrl: env("APP_URL") };
    const mail = l.kind === "welcome" ? buildLeadWelcome(input) : buildLeadAlert(input);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env("EMAIL_FROM"), to: [l.to_email], subject: mail.subject, html: mail.html, text: mail.text, ...(l.reply_to ? { reply_to: l.reply_to } : {}) }),
    });
    if (!res.ok) {
      failed.push(`${res.status}: ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    (l.kind === "welcome" ? welcomed : told).push(l.request_id);
    leadsSent += 1;
  }
  if (welcomed.length || told.length) {
    const { error: markLeads } = await admin.rpc("mark_lead_emails_sent", { p_welcomed: welcomed, p_told: told });
    if (markLeads) failed.push(markLeads.message);
  }
  return json({ due: due.length, sent, leadsSent, failed });
});
