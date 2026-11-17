/* Leads: the enquiry form on a coach's public page, the pipeline of people who aren't clients yet,
   and the automatic welcome email each new enquiry gets. Builds on growth.ts (join requests).
   Pure helpers mirrored by supabase/migrations/20261118090000_leads.sql. */

import { addDays } from "./lifestyle";
import { PHONE_PATTERN, pageLink, type JoinRequest, type JoinRequestStatus, type TrainingModeName } from "./growth";

export type LeadStage = "new" | "contacted" | "trial" | "client" | "lost";

export const LEAD_STAGES: LeadStage[] = ["new", "contacted", "trial", "client", "lost"];

export const LEAD_STAGE_LABEL: Record<LeadStage, string> = { new: "New", contacted: "Contacted", trial: "Trial", client: "Client", lost: "Lost" };

export const LEAD_STAGE_HINT: Record<LeadStage, string> = {
  new: "Just asked. Reply within a day.",
  contacted: "You've replied or sent the invite.",
  trial: "Trying a session or a first week.",
  client: "Signed up and training.",
  lost: "Not now. Keep for later.",
};

export interface Lead extends JoinRequest {
  stage: LeadStage;
  phone: string;
  /** How they'd like to train, when they said. */
  how: TrainingModeName | "";
  /** Where they came from: "page", "instagram", "manual"… */
  source: string;
  /** Private to the coach. */
  notes: string;
  /** Date to follow up, "2026-11-12", or null. */
  followUp: string | null;
  /** When the automatic welcome email went, or null. */
  welcomedAt: string | null;
}

/** The stage an old request starts on, from its invite status. */
export function stageFromStatus(status: JoinRequestStatus): LeadStage {
  return status === "invited" ? "contacted" : status === "joined" ? "client" : status === "declined" ? "lost" : "new";
}

type Pair = { stage: LeadStage; status: JoinRequestStatus; hasInvite?: boolean };

/** The invite status changed (invite sent, invite accepted, declined): move the stage to match. Same as the SQL trigger. */
export function onStatusChange(prev: Pair, status: JoinRequestStatus): Pair {
  if (status === prev.status) return prev;
  const stage = status === "joined" ? "client" : status === "declined" ? "lost" : status === "invited" && prev.stage === "new" ? "contacted" : prev.stage === "lost" && status === "new" ? "new" : prev.stage;
  return { ...prev, stage, status };
}

/** The coach moved a lead to another stage: keep the invite status (and referral counts) in step. Same as the SQL trigger. */
export function onStageChange(prev: Pair, stage: LeadStage): Pair {
  if (stage === prev.stage) return prev;
  let status = prev.status;
  if (stage === "lost" && (status === "new" || status === "invited")) status = "declined";
  else if (stage === "client") status = "joined";
  else if (status === "declined" || status === "joined") status = prev.hasInvite ? "invited" : "new";
  return { ...prev, stage, status };
}

/** How many leads sit on each stage. */
export function stageCounts(leads: Pick<Lead, "stage">[]): Record<LeadStage, number> {
  const out = { new: 0, contacted: 0, trial: 0, client: 0, lost: 0 } as Record<LeadStage, number>;
  for (const l of leads) out[l.stage] += 1;
  return out;
}

/** Share of decided leads (client or lost) who became clients, 0-100, or null before any are decided. */
export function winRate(leads: Pick<Lead, "stage">[]): number | null {
  const c = stageCounts(leads);
  const decided = c.client + c.lost;
  return decided ? Math.round((c.client / decided) * 100) : null;
}

/** Open leads whose follow-up date is today or past. */
export function followUpsDue<T extends Pick<Lead, "stage" | "followUp">>(leads: T[], today: string): T[] {
  return leads.filter((l) => l.followUp && l.followUp <= today && l.stage !== "client" && l.stage !== "lost");
}

/** Pipeline order: overdue follow-ups first, then by stage, newest first. */
export function sortLeads<T extends Pick<Lead, "stage" | "at" | "followUp">>(leads: T[], today: string): T[] {
  const rank = (l: T) => (l.followUp && l.followUp <= today && l.stage !== "client" && l.stage !== "lost" ? -1 : LEAD_STAGES.indexOf(l.stage));
  return [...leads].sort((a, b) => rank(a) - rank(b) || Date.parse(b.at) - Date.parse(a.at));
}

/** "Today", "Tomorrow", "In 3 days", "2 days late". */
export function followUpLabel(date: string, today: string): string {
  const d = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "1 day late";
  return d > 0 ? `In ${d} days` : `${-d} days late`;
}

export const SOURCE_CHOICES: [string, string][] = [["instagram", "Instagram"], ["tiktok", "TikTok"], ["website", "Website"], ["whatsapp", "WhatsApp"], ["flyer", "Flyer or QR"], ["gym", "Gym"]];
const SOURCE_NAMES: Record<string, string> = { page: "Your page", referral: "A client", manual: "Added by you", booking: "Booking link", ...Object.fromEntries(SOURCE_CHOICES) };

/** A safe source tag from a link's ?src=, or null. */
export function readSource(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{2,24}$/.test(s) ? s : null;
}

export function sourceLabel(source: string): string {
  return SOURCE_NAMES[source] ?? source.charAt(0).toUpperCase() + source.slice(1).replace(/-/g, " ");
}

/** Where leads came from, most first. */
export function sourceCounts(leads: Pick<Lead, "source">[]): { source: string; count: number }[] {
  const m = new Map<string, number>();
  for (const l of leads) m.set(l.source, (m.get(l.source) ?? 0) + 1);
  return [...m].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}

/** The enquiry form link: the coach's page, opened straight on the form, tagged with where it was shared. */
export function formLink(origin: string, slug: string, source?: string | null): string {
  const src = readSource(source);
  return `${pageLink(origin, slug)}&form=1${src ? `&src=${src}` : ""}`;
}

/** Code to put the form on the coach's own website. */
export function embedCode(origin: string, slug: string, source = "website"): string {
  const url = `${formLink(origin, slug, source)}&embed=1`;
  return `<iframe src="${url}" title="Train with me" style="width:100%;max-width:520px;height:760px;border:0;border-radius:16px" loading="lazy"></iframe>`;
}

/** What a page link asks for beyond the page: open the form, show only the form, and where it was shared. */
export function readFormLink(search: string): { form: boolean; embed: boolean; source: string | null } {
  const q = new URLSearchParams(search);
  const embed = q.get("embed") === "1";
  return { form: embed || q.get("form") === "1", embed, source: readSource(q.get("src")) };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Why a phone number can't be saved, or null. Empty is fine. */
export function phoneProblem(phone: string): string | null {
  const p = phone.trim();
  return !p || PHONE_PATTERN.test(p) ? null : "Check the phone number.";
}

export interface ManualLead {
  name: string;
  email: string;
  phone: string;
  goal: string;
  source: string;
  notes: string;
}

/** Why a lead the coach adds by hand can't be saved, or null. Email is optional (people often come by DM). */
export function manualLeadProblem(d: ManualLead): string | null {
  if (d.name.trim().length < 2) return "Add their name.";
  if (d.name.trim().length > 60) return "Keep the name to 60 characters.";
  if (d.email.trim() && !EMAIL.test(d.email.trim())) return "Check the email.";
  return phoneProblem(d.phone) ?? (d.notes.length > NOTES_MAX ? `Keep notes to ${NOTES_MAX} characters.` : null);
}

export const NOTES_MAX = 1000;
export const WELCOME_MAX = 800;

export interface LeadSettings {
  /** Email each new enquiry straight away. */
  welcomeOn: boolean;
  /** The coach's words. {first} becomes their first name. Empty uses the default. */
  welcomeText: string;
  /** Email the coach about each new enquiry. */
  notifyOn: boolean;
}

export const DEFAULT_WELCOME = "Thanks for getting in touch, {first}. I read every enquiry myself and I'll reply within a day with a few questions about your goal, your week and any injuries. Then we'll find the right start for you.";

export const defaultLeadSettings = (): LeadSettings => ({ welcomeOn: true, welcomeText: "", notifyOn: true });

/** The welcome text with the lead's first name filled in. */
export function welcomeBody(template: string, leadName: string): string {
  const first = leadName.trim().split(/\s+/)[0] || "there";
  return (template.trim() || DEFAULT_WELCOME).replace(/\{first\}/g, first);
}

export function welcomeProblem(text: string): string | null {
  return text.trim().length > WELCOME_MAX ? `Keep the welcome to ${WELCOME_MAX} characters.` : null;
}

export const LEAD_PRIVACY_NOTE = "Leads are private to you. People who ask get one welcome email from APEX with your words; replies come to your email.";

/** The demo coach's pipeline. */
export function sampleLeads(now = new Date()): Lead[] {
  const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  const day = (n: number) => addDays(now.toISOString().slice(0, 10), n);
  const base = { phone: "", how: "" as const, notes: "", followUp: null, welcomedAt: null, referredBy: null };
  return [
    { ...base, id: "r1", name: "Leo Martin", email: "leo@example.com", goal: "Run further", message: "Training for my first half marathon in spring.", at: ago(3), status: "new", stage: "new", source: "referral", referredBy: "Priya S.", how: "online", welcomedAt: ago(3) },
    { ...base, id: "r2", name: "Hana Ito", email: "hana@example.com", goal: "Get stronger", message: "", at: ago(26), status: "new", stage: "new", source: "instagram", welcomedAt: ago(26) },
    { ...base, id: "r4", name: "Dev Patel", email: "dev@example.com", phone: "07700 900123", goal: "Lose fat", message: "Desk job, two kids, 3 mornings a week free.", at: ago(52), status: "invited", stage: "contacted", source: "instagram", followUp: day(0), notes: "Called Tue. Wants to start after half-term.", welcomedAt: ago(52) },
    { ...base, id: "r5", name: "Grace Mensah", email: "grace@example.com", goal: "Race prep", message: "", at: ago(120), status: "invited", stage: "trial", source: "website", how: "hybrid", followUp: day(2), notes: "Trial week on. Check in Friday.", welcomedAt: ago(120) },
    { ...base, id: "r3", name: "Sam Okafor", email: "sam@example.com", goal: "Build muscle", message: "", at: ago(80), status: "joined", stage: "client", source: "referral", referredBy: "Priya S.", welcomedAt: ago(80) },
    { ...base, id: "r6", name: "Marta Silva", email: "", phone: "", goal: "Move better", message: "", at: ago(200), status: "joined", stage: "client", source: "gym", notes: "Met at the gym open day." },
    { ...base, id: "r7", name: "Tom Reid", email: "tom@example.com", goal: "Get stronger", message: "", at: ago(300), status: "declined", stage: "lost", source: "page", notes: "Price. Try again in January.", welcomedAt: ago(300) },
  ];
}
