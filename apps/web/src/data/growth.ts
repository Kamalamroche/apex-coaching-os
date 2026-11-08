import { blankPage, fromPageRow, pageLink, pageProblem, referralSummary, requestProblem, samplePage, sampleRequests, slugProblem, type CoachPage, type JoinRequest, type JoinRequestDraft, type JoinRequestStatus, type PageRow, type ReferralSummary } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

/** Coach: my public page and the requests it brings in. Client: my invite-a-friend link. */
export interface GrowthApi {
  live: boolean;
  side: "coach" | "client";
  /** Coach: my page (a blank one until saved). Client: my coach's page, or null when it isn't published. */
  page(): Promise<CoachPage | null>;
  savePage(p: CoachPage): Promise<void>;
  requests(): Promise<JoinRequest[]>;
  /** Makes an invite for this request and returns the link to send. */
  invite(id: string): Promise<string>;
  setStatus(id: string, status: JoinRequestStatus): Promise<void>;
  /** Client: my link to my coach's page, with my friend code. */
  friendLink(): Promise<string | null>;
  referrals(): Promise<ReferralSummary>;
}

/** Anyone opening a coach's page. */
export interface PublicPageApi {
  live: boolean;
  load(slug: string): Promise<CoachPage | null>;
  request(slug: string, d: JoinRequestDraft, ref: string | null): Promise<void>;
}

const isMissing = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205" || e?.code === "PGRST202";
export const GROWTH_NEEDS_UPDATE = "needs-update";
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
      return ((data ?? []) as { id: string; name: string; email: string; goal: string; message: string; status: JoinRequestStatus; created_at: string; referred_by: string | null }[])
        .map((r) => ({ id: r.id, name: r.name, email: r.email, goal: r.goal, message: r.message, status: r.status, at: r.created_at, referredBy: r.referred_by }));
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
    async request(slug, d, ref) {
      const problem = requestProblem(d);
      if (problem) throw new Error(problem);
      const { error } = await db.rpc("request_to_train", { p_slug: slug, p_name: d.name.trim(), p_email: d.email.trim(), p_goal: d.goal, p_message: d.message.trim(), p_ref: ref });
      if (error) throw err(error);
    },
  };
}

const KEY = "apex-growth-v1";
interface DemoState { page: CoachPage; requests: JoinRequest[] }

const readDemo = (): DemoState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch { /* sample */ }
  return { page: samplePage(), requests: sampleRequests() };
};
const writeDemo = (s: DemoState) => {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* this visit only */ }
};
const updateDemo = (fn: (s: DemoState) => DemoState) => writeDemo(fn(readDemo()));

/** Demo: Kamal's sample page and requests in localStorage, shared by the coach tab, the client tab and the public page. */
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
      updateDemo((s) => ({ ...s, requests: s.requests.map((r) => (r.id === id && r.status === "new" ? { ...r, status: "invited" } : r)) }));
      return `${location.origin}/client/?invite=demo-${id}`;
    },
    async setStatus(id, status) { updateDemo((s) => ({ ...s, requests: s.requests.map((r) => (r.id === id ? { ...r, status } : r)) })); },
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
    async request(_slug, d, ref) {
      const problem = requestProblem(d);
      if (problem) throw new Error(problem);
      const r: JoinRequest = { id: `r-${Date.now()}`, ...d, name: d.name.trim(), email: d.email.trim().toLowerCase(), message: d.message.trim(), at: new Date().toISOString(), status: "new", referredBy: ref ? "Priya S." : null };
      updateDemo((s) => ({ ...s, requests: [r, ...s.requests] }));
    },
  };
}

const Ctx = createContext<GrowthApi | null>(null);
export const GrowthProvider = Ctx.Provider;
export const useGrowthApi = (): GrowthApi | null => useContext(Ctx);
