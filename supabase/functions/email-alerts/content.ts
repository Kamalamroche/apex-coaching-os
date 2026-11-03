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
