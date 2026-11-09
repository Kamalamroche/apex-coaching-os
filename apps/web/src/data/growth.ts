import { blankPage, defaultLeadSettings, fromPageRow, manualLeadProblem, onStageChange, onStatusChange, pageLink, pageProblem, phoneProblem, readSource, referralSummary, requestProblem, sampleLeads, samplePage, slugProblem, stageFromStatus, welcomeProblem, type CoachPage, type JoinRequestDraft, type JoinRequestStatus, type Lead, type LeadSettings, type LeadStage, type ManualLead, type PageRow, type ReferralSummary, type TrainingModeName } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

/** Coach: my public page and the requests it brings in. Client: my invite-a-friend link. */
export interface GrowthApi {
  live: boolean;
  side: "coach" | "client";
  /** Coach: my page (a blank one until saved). Client: my coach's page, or null when it isn't published. */
  page(): Promise<CoachPage | null>;
  savePage(p: CoachPage): Promise<void>;
  /** Coach: everyone who asked or was added, as a pipeline. */
  requests(): Promise<Lead[]>;
  /** Makes an invite for this request and returns the link to send. */
  invite(id: string): Promise<string>;
  setStatus(id: string, status: JoinRequestStatus): Promise<void>;
  setStage(id: string, stage: LeadStage): Promise<void>;
  /** Private notes, a follow-up date, a phone number. */
  updateLead(id: string, patch: LeadPatch): Promise<void>;
  /** A lead the coach met elsewhere (a DM, the gym). Never emailed automatically. */
  addLead(d: ManualLead): Promise<void>;
  removeLead(id: string): Promise<void>;
  leadSettings(): Promise<LeadSettings>;
  saveLeadSettings(s: LeadSettings): Promise<void>;
  /** Client: my link to my coach's page, with my friend code. */
  friendLink(): Promise<string | null>;
  referrals(): Promise<ReferralSummary>;
}

export interface LeadPatch { notes?: string; followUp?: string | null; phone?: string }

/** Anyone opening a coach's page. */
export interface PublicPageApi {
  live: boolean;
  load(slug: string): Promise<CoachPage | null>;
  request(slug: string, d: JoinRequestDraft, ref: string | null, source?: string | null): Promise<void>;
}

const isMissing = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205" || e?.code === "PGRST202";
const isMissingColumn = (e: { code?: string } | null) => isMissing(e) || e?.code === "42703" || e?.code === "PGRST204";
export const GROWTH_NEEDS_UPDATE = "needs-update";
/** Thrown by lead tools until 20261118090000_leads.sql has run. */
export const LEADS_NEEDS_UPDATE = "leads-needs-update";
export const LEADS_SQL = "20261118090000_leads.sql";
const leadErr = (e: { code?: string; message: string }) => (isMissingColumn(e) ? new Error(LEADS_NEEDS_UPDATE) : new Error(e.message));

/** The coach app was opened from a new-enquiry email (?open=leads). */
export const openedForLeads = (): boolean => {
  try { return new URLSearchParams(location.search).get("open") === "leads"; } catch { return false; }
};

interface LeadRow {
  id: string; name: string; email: string; goal: string; message: string; status: JoinRequestStatus; created_at: string; referred_by: string | null;
  invite_token?: string | null; stage?: LeadStage; phone?: string; how?: string; source?: string; notes?: string; follow_up?: string | null; welcomed_at?: string | null;
}

const fromLeadRow = (r: LeadRow): Lead => ({
  id: r.id, name: r.name, email: r.email, goal: r.goal, message: r.message, status: r.status, at: r.created_at, referredBy: r.referred_by,
  stage: r.stage ?? stageFromStatus(r.status), phone: r.phone ?? "", how: (r.how ?? "") as TrainingModeName | "",
  source: r.source ?? (r.referred_by ? "referral" : "page"), notes: r.notes ?? "", followUp: r.follow_up ?? null, welcomedAt: r.welcomed_at ?? null,
});

const patchProblem = (p: LeadPatch): string | null =>
  (p.phone !== undefined ? phoneProblem(p.phone) : null) ?? (p.notes !== undefined && p.notes.length > 1000 ? "Keep notes to 1000 characters." : null);
const err = (e: { code?: string; message: string }) => (isMissing(e) ? new Error(GROWTH_NEEDS_UPDATE) : e.code === "23505" && /slug/.test(e.message) ? new Error("That page address is taken. Try another.") : new Error(e.message));

export function liveGrowth(db: SupabaseClient, who: { side: "coach" | "client"; coachId: string; coachName: string; me: string }): GrowthApi {
  return {
    live: true,
    side: who.side,
    async page() {
      const { data, error } = await db.from("coach_pages").select("slug, headline, bio, city, specialties, modes, published, show_clients").eq("coach_id", who.coachId).maybeSingle();
      if (error) throw err(error);
      if (!data) return who.side === "coach" ? blankPage(who.coachName) : null;
      const page = fromPageRow({ ...(data as Omit<PageRow, "name">), name: who.coachName });
      if (who.side === "client" && !page.published) return null;
      return { ...page, clients: (data as { show_clients: boolean }).show_clients ? 0 : null };
    },
    async savePage(p) {
      const problem = p.published ? pageProblem(p) : slugProblem(p.slug);
      if (problem) throw new Error(problem);
      const { error } = await db.from("coach_pages").upsert({
        coach_id: who.coachId, slug: p.slug, headline: p.headline.trim(), bio: p.bio.trim(), city: p.city.trim(),
        specialties: p.specialties, modes: p.modes, published: p.published, show_clients: p.clients !== null, updated_at: new Date().toISOString(),
      });
      if (error) throw err(error);
    },
    async requests() {
      const { data, error } = await db.rpc("coach_join_requests");
      if (error) throw err(error);
      return ((data ?? []) as LeadRow[]).map(fromLeadRow);
    },
    async invite(id) {
      const { data: existing } = await db.from("join_requests").select("invite_token").eq("id", id).maybeSingle();
      let token = (existing as { invite_token: string | null } | null)?.invite_token ?? null;
      if (!token) {
        const { data, error } = await db.from("invites").insert({ coach_id: who.coachId }).select("token").single();
        if (error) throw err(error);
        token = (data as { token: string }).token;
        const { error: e2 } = await db.from("join_requests").update({ status: "invited", invite_token: token }).eq("id", id);
        if (e2) throw err(e2);
      }
      return `${location.origin}/client/?invite=${token}`;
    },
    async setStatus(id, status) {
      const { error } = await db.from("join_requests").update({ status }).eq("id", id);
      if (error) throw err(error);
    },
    async setStage(id, stage) {
      // The database trigger keeps the invite status in step.
      const { error } = await db.from("join_requests").update({ stage }).eq("id", id);
      if (error) throw leadErr(error);
    },
    async updateLead(id, patch) {
      const problem = patchProblem(patch);
      if (problem) throw new Error(problem);
      const row: Record<string, unknown> = {};
      if (patch.notes !== undefined) row.notes = patch.notes.trim();
      if (patch.followUp !== undefined) row.follow_up = patch.followUp;
      if (patch.phone !== undefined) row.phone = patch.phone.trim();
      const { error } = await db.from("join_requests").update(row).eq("id", id);
      if (error) throw leadErr(error);
    },
    async addLead(d) {
      const problem = manualLeadProblem(d);
      if (problem) throw new Error(problem);
      const { error } = await db.from("join_requests").insert({
        coach_id: who.coachId, name: d.name.trim(), email: d.email.trim().toLowerCase(), phone: d.phone.trim(), goal: d.goal.slice(0, 40),
        source: readSource(d.source) ?? "manual", notes: d.notes.trim(), added_by_coach: true,
      });
      if (error) throw leadErr(error);
    },
    async removeLead(id) {
      const { error } = await db.from("join_requests").delete().eq("id", id);
      if (error) throw err(error);
    },
    async leadSettings() {
      const { data, error } = await db.from("lead_settings").select("welcome_on, welcome_text, notify_on").eq("coach_id", who.coachId).maybeSingle();
      if (error) throw leadErr(error);
      const r = data as { welcome_on: boolean; welcome_text: string; notify_on: boolean } | null;
      return r ? { welcomeOn: r.welcome_on, welcomeText: r.welcome_text, notifyOn: r.notify_on } : defaultLeadSettings();
    },
    async saveLeadSettings(st) {
      const problem = welcomeProblem(st.welcomeText);
      if (problem) throw new Error(problem);
      const { error } = await db.from("lead_settings").upsert({ coach_id: who.coachId, welcome_on: st.welcomeOn, welcome_text: st.welcomeText.trim(), notify_on: st.notifyOn, updated_at: new Date().toISOString() });
      if (error) throw leadErr(error);
    },
    async friendLink() {
      const page = await this.page();
      if (!page) return null;
      const { data, error } = await db.rpc("my_referral_code", { p_coach: who.coachId });
      if (error) throw err(error);
      return pageLink(location.origin, page.slug, data as string);
    },
    async referrals() {
      const { data, error } = await db.rpc("my_referrals", { p_coach: who.coachId });
      if (error) throw err(error);
      const r = ((data ?? []) as { asked: number; joined: number }[])[0];
      return { asked: Number(r?.asked ?? 0), joined: Number(r?.joined ?? 0) };
    },
  };
}

export function livePublicPage(db: SupabaseClient): PublicPageApi {
  return {
    live: true,
    async load(slug) {
      const { data, error } = await db.rpc("public_coach_page", { p_slug: slug });
      if (error) throw err(error);
      const r = ((data ?? []) as PageRow[])[0];
      return r ? fromPageRow(r) : null;
    },
    async request(slug, d, ref, source) {
      const problem = requestProblem(d);
      if (problem) throw new Error(problem);
      const base = { p_slug: slug, p_name: d.name.trim(), p_email: d.email.trim(), p_goal: d.goal, p_message: d.message.trim(), p_ref: ref };
      let { error } = await db.rpc("request_to_train", { ...base, p_phone: (d.phone ?? "").trim(), p_how: d.how ?? "", p_source: readSource(source) });
      // Before the leads update the function only takes the first six: send those so the request still lands.
      if (error?.code === "PGRST202") ({ error } = await db.rpc("request_to_train", base));
      if (error) throw err(error);
    },
  };
}

const KEY = "apex-growth-v1";
interface DemoState { page: CoachPage; requests: Lead[]; settings?: LeadSettings }

const readDemo = (): DemoState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as DemoState;
      // Saved before leads existed: fill in the pipeline fields.
      return { ...s, requests: s.requests.map((r) => ({ ...fromLeadRow({ ...r, created_at: r.at, referred_by: r.referredBy } as LeadRow), ...r, stage: r.stage ?? stageFromStatus(r.status) })) };
    }
  } catch { /* sample */ }
  return { page: samplePage(), requests: sampleLeads() };
};
const writeDemo = (s: DemoState) => {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* this visit only */ }
};
const updateDemo = (fn: (s: DemoState) => DemoState) => writeDemo(fn(readDemo()));
const updateLeadDemo = (id: string, fn: (l: Lead) => Lead) => updateDemo((s) => ({ ...s, requests: s.requests.map((r) => (r.id === id ? fn(r) : r)) }));

/** Demo: Kamal's sample page and leads in localStorage, shared by the coach tab, the client tab and the public page. */
export function demoGrowth(side: "coach" | "client"): GrowthApi {
  return {
    live: false,
    side,
    async page() {
      const p = readDemo().page;
      return side === "client" && !p.published ? null : p;
    },
    async savePage(p) {
      const problem = p.published ? pageProblem(p) : slugProblem(p.slug);
      if (problem) throw new Error(problem);
      updateDemo((s) => ({ ...s, page: p }));
    },
    async requests() { return readDemo().requests; },
    async invite(id) {
      updateLeadDemo(id, (r) => (r.status === "new" ? { ...r, ...onStatusChange(r, "invited") } : r));
      return `${location.origin}/client/?invite=demo-${id}`;
    },
    async setStatus(id, status) { updateLeadDemo(id, (r) => ({ ...r, ...onStatusChange(r, status) })); },
    async setStage(id, stage) { updateLeadDemo(id, (r) => { const { hasInvite: _h, ...next } = onStageChange({ stage: r.stage, status: r.status, hasInvite: r.status !== "new" }, stage); return { ...r, ...next }; }); },
    async updateLead(id, patch) {
      const problem = patchProblem(patch);
      if (problem) throw new Error(problem);
      updateLeadDemo(id, (r) => ({ ...r, ...(patch.notes !== undefined ? { notes: patch.notes.trim() } : {}), ...(patch.followUp !== undefined ? { followUp: patch.followUp } : {}), ...(patch.phone !== undefined ? { phone: patch.phone.trim() } : {}) }));
    },
    async addLead(d) {
      const problem = manualLeadProblem(d);
      if (problem) throw new Error(problem);
      const lead: Lead = {
        id: `m-${Date.now()}`, name: d.name.trim(), email: d.email.trim().toLowerCase(), phone: d.phone.trim(), goal: d.goal, message: "", at: new Date().toISOString(),
        status: "new", stage: "new", source: readSource(d.source) ?? "manual", notes: d.notes.trim(), followUp: null, welcomedAt: null, how: "", referredBy: null,
      };
      updateDemo((s) => ({ ...s, requests: [lead, ...s.requests] }));
    },
    async removeLead(id) { updateDemo((s) => ({ ...s, requests: s.requests.filter((r) => r.id !== id) })); },
    async leadSettings() { return readDemo().settings ?? defaultLeadSettings(); },
    async saveLeadSettings(st) {
      const problem = welcomeProblem(st.welcomeText);
      if (problem) throw new Error(problem);
      updateDemo((s) => ({ ...s, settings: { ...st, welcomeText: st.welcomeText.trim() } }));
    },
    async friendLink() {
      const p = readDemo().page;
      return p.published ? pageLink(location.origin, p.slug, "pr1ya5sx") : null;
    },
    async referrals() { return referralSummary(readDemo().requests.filter((r) => r.referredBy === "Priya S.")); },
  };
}

export function demoPublicPage(): PublicPageApi {
  return {
    live: false,
    async load(slug) {
      const p = readDemo().page;
      return p.published && p.slug === slug ? p : null;
    },
    async request(_slug, d, ref, source) {
      const problem = requestProblem(d);
      if (problem) throw new Error(problem);
      if (readDemo().requests.some((r) => r.email === d.email.trim().toLowerCase() && ["new", "contacted", "trial"].includes(r.stage))) throw new Error("You have already asked. Your coach will be in touch.");
      const now = new Date().toISOString();
      const r: Lead = {
        id: `r-${Date.now()}`, name: d.name.trim(), email: d.email.trim().toLowerCase(), goal: d.goal, message: d.message.trim(), phone: (d.phone ?? "").trim(), how: d.how ?? "",
        at: now, status: "new", stage: "new", referredBy: ref ? "Priya S." : null, source: readSource(source) ?? (ref ? "referral" : "page"), notes: "", followUp: null,
        welcomedAt: (readDemo().settings ?? defaultLeadSettings()).welcomeOn ? now : null,
      };
      updateDemo((s) => ({ ...s, requests: [r, ...s.requests] }));
    },
  };
}

const Ctx = createContext<GrowthApi | null>(null);
export const GrowthProvider = Ctx.Provider;
export const useGrowthApi = (): GrowthApi | null => useContext(Ctx);
