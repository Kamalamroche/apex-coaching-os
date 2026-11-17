// The email someone gets when a message has waited unread. Pure: no Deno or browser APIs, so it is
// tested with the rest of the code (content.test.ts) and imported by index.ts.

export interface AlertInput {
  firstName: string;
  role: "coach" | "client" | string;
  senders: string[];
  unread: number;
  latest: string;
  appUrl: string;
}

export interface AlertEmail {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** First 140 characters on one line, cut at a word. */
export function snippet(body: string, max = 140): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, "")}…`;
}

/** "Priya", "Priya and James", "Priya, James and 2 others". */
export function namesList(names: string[]): string {
  const n = names.filter(Boolean);
  if (n.length === 0) return "Someone";
  if (n.length === 1) return n[0];
  if (n.length === 2) return `${n[0]} and ${n[1]}`;
  const rest = n.length - 2;
  return `${n[0]}, ${n[1]} and ${rest} other${rest === 1 ? "" : "s"}`;
}

export function appLink(appUrl: string, role: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/${role === "coach" ? "coach" : "client"}/`;
}

export function buildAlertEmail(a: AlertInput): AlertEmail {
  const who = namesList(a.senders);
  const many = a.unread > 1;
  const subject = many ? `${a.unread} new messages from ${who} on APEX` : `New message from ${who} on APEX`;
  const link = appLink(a.appUrl, a.role);
  const quote = snippet(a.latest);
  const hello = a.firstName ? `Hi ${a.firstName},` : "Hi,";
  const lead = many ? `You have ${a.unread} unread messages from ${who}. The latest:` : `${who} sent you a message:`;
  const off = "You get this email because a message waited unread for a while. Switch these emails off in APEX under Privacy and account.";
  const text = [hello, "", lead, "", `"${quote}"`, "", `Open APEX to reply: ${link}`, "", "—", off].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F3F5F9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0B1324">
<div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #DCE2EC;border-radius:12px;padding:24px">
<!-- Colours are the light Athletic Tech tokens (packages/ui/src/tokens.css); emails cannot read CSS variables. -->
<div style="font-weight:800;letter-spacing:.06em;font-size:14px;margin-bottom:16px">APEX</div>
<p style="margin:0 0 12px">${esc(hello)}</p>
<p style="margin:0 0 12px">${esc(lead)}</p>
<blockquote style="margin:0 0 20px;padding:12px 14px;background:#F3F5F9;border-left:3px solid #E85A0C;border-radius:6px">${esc(quote)}</blockquote>
<a href="${esc(link)}" style="display:inline-block;background:#E85A0C;color:#FFFFFF;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">Open APEX to reply</a>
<p style="margin:20px 0 0;font-size:12px;color:#7A869C">${esc(off)}</p>
</div></body></html>`;
  return { subject, text, html };
}

// Leads: the welcome email someone gets straight after asking to train, and the coach's alert.

export interface LeadMailInput {
  coachName: string;
  leadName: string;
  goal: string;
  message: string;
  phone: string;
  how: string;
  source: string;
  /** The coach's own words; {first} becomes the lead's first name. Empty uses the default. */
  welcomeText: string;
  appUrl: string;
}

export const DEFAULT_WELCOME = "Thanks for getting in touch, {first}. I read every enquiry myself and I'll reply within a day with a few questions about your goal, your week and any injuries. Then we'll find the right start for you.";

const firstOf = (name: string) => name.trim().split(/\s+/)[0] || "";
const HOW: Record<string, string> = { online: "Online", hybrid: "Hybrid", in_person: "In person" };

const frame = (inner: string) => `<!doctype html><html><body style="margin:0;padding:24px;background:#F3F5F9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0B1324">
<div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #DCE2EC;border-radius:12px;padding:24px">
<div style="font-weight:800;letter-spacing:.06em;font-size:14px;margin-bottom:16px">APEX</div>
${inner}
</div></body></html>`;

/** To the person who asked: the coach's welcome, signed by the coach. Replies go to the coach. */
export function buildLeadWelcome(a: LeadMailInput): AlertEmail {
  const first = firstOf(a.leadName) || "there";
  const coach = a.coachName.trim() || "Your coach";
  const body = (a.welcomeText.trim() || DEFAULT_WELCOME).replace(/\{first\}/g, first);
  const subject = `Thanks for getting in touch · ${coach}`;
  const foot = `You get this one email because you asked to train with ${coach} on APEX. Reply to this email to reach ${firstOf(coach) || coach}.`;
  const text = [`Hi ${first},`, "", body, "", firstOf(coach) || coach, "", "—", foot].join("\n");
  const paras = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px;line-height:1.5">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const html = frame(`<p style="margin:0 0 12px">Hi ${esc(first)},</p>
${paras}
<p style="margin:16px 0 0;font-weight:700">${esc(firstOf(coach) || coach)}</p>
<p style="margin:20px 0 0;font-size:12px;color:#7A869C">${esc(foot)}</p>`);
  return { subject, text, html };
}

/** To the coach: someone new asked, with what they said and a link to the pipeline. */
export function buildLeadAlert(a: LeadMailInput): AlertEmail {
  const lead = a.leadName.trim() || "Someone";
  const subject = `New enquiry from ${lead}${a.goal ? ` · ${a.goal}` : ""}`;
  const link = `${appLink(a.appUrl, "coach")}?open=leads`;
  const facts: [string, string][] = [["Goal", a.goal], ["How", HOW[a.how] ?? ""], ["Phone", a.phone], ["From", a.source === "page" ? "Your page" : a.source === "referral" ? "A client's invite" : a.source]];
  const shown = facts.filter(([, v]) => v);
  const quote = a.message ? snippet(a.message, 300) : "";
  const off = "Switch these alerts off in APEX under Messages → Train with me → Welcome email.";
  const text = [`${lead} asked to train with you.`, "", ...shown.map(([k, v]) => `${k}: ${v}`), ...(quote ? ["", `"${quote}"`] : []), "", `Reply soon: ${link}`, "", "—", off].join("\n");
  const html = frame(`<p style="margin:0 0 12px"><b>${esc(lead)}</b> asked to train with you.</p>
${shown.length ? `<table style="margin:0 0 12px;font-size:14px;border-collapse:collapse">${shown.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#7A869C">${esc(k)}</td><td style="padding:2px 0">${esc(v)}</td></tr>`).join("")}</table>` : ""}
${quote ? `<blockquote style="margin:0 0 20px;padding:12px 14px;background:#F3F5F9;border-left:3px solid #E85A0C;border-radius:6px">${esc(quote)}</blockquote>` : ""}
<a href="${esc(link)}" style="display:inline-block;background:#E85A0C;color:#FFFFFF;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">Open my leads</a>
<p style="margin:20px 0 0;font-size:12px;color:#7A869C">${esc(off)}</p>`);
  return { subject, text, html };
}
