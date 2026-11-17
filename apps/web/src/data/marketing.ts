import { DEFAULT_MARKETING, campaignProblem, fromHappinessRow, happinessProblem, sampleHappiness, sampleProof, sampleVisits, spotsProblem, type Campaign, type HappinessAnswer, type HappinessRow, type MarketingSettings, type PageVisits, type ProofNumbers } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

/** Coach: places, offer, visits, happiness answers and proof numbers. Client: my happiness answers and answering. */
export interface MarketingApi {
  live: boolean;
  side: "coach" | "client";
  settings(): Promise<MarketingSettings>;
  saveSettings(s: MarketingSettings, today: string): Promise<void>;
  /** Coach: every answer. Client: my own. */
  happiness(): Promise<HappinessAnswer[]>;
  answer(score: number, comment: string): Promise<void>;
  visits(days: number): Promise<PageVisits[]>;
  proof(days: number): Promise<ProofNumbers>;
  /** Clients who started this month (for places left). */
  joinedThisMonth(): Promise<number>;
}

export const MARKETING_SQL = "20261126090000_marketing.sql";
export const MARKETING_NEEDS_UPDATE = `Marketing needs a database update: run ${MARKETING_SQL} in Supabase.`;
const missing = (e: { code?: string } | null) => !!e && ["42P01", "PGRST205", "PGRST202", "42703", "PGRST204", "42883"].includes(e.code ?? "");
const fail = (e: { code?: string; message: string }) => (missing(e) ? new Error(MARKETING_NEEDS_UPDATE) : new Error(e.message));

const check = (s: MarketingSettings, today: string) => {
  const p = spotsProblem(s.spots) ?? campaignProblem(s.campaign, today);
  if (p) throw new Error(p);
};

const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); };

export function liveMarketing(db: SupabaseClient, who: { side: "coach" | "client"; coachId: string; me: string }): MarketingApi {
  return {
    live: true,
    side: who.side,
    async settings() {
      const { data, error } = await db.from("coach_pages").select("spots_month, campaign_title, campaign_text, campaign_ends").eq("coach_id", who.coachId).maybeSingle();
      if (error) throw fail(error);
      const r = data as { spots_month: number | null; campaign_title: string; campaign_text: string; campaign_ends: string | null } | null;
      if (!r) return DEFAULT_MARKETING;
      return { spots: r.spots_month, campaign: r.campaign_ends && r.campaign_title ? { title: r.campaign_title, text: r.campaign_text, ends: r.campaign_ends } : null };
    },
    async saveSettings(s, today) {
      check(s, today);
      const c: Campaign | null = s.campaign;
      const { data, error } = await db.from("coach_pages").update({
        spots_month: s.spots, campaign_title: c?.title.trim() ?? "", campaign_text: c?.text.trim() ?? "", campaign_ends: c?.ends ?? null,
      }).eq("coach_id", who.coachId).select("coach_id");
      if (error) throw fail(error);
      if (!data?.length) throw new Error("Set up your page first (Messages → Train with me → Page), then places and offers can show on it.");
    },
    async happiness() {
      if (who.side === "coach") {
        const { data, error } = await db.rpc("coach_happiness");
        if (error) throw fail(error);
        return ((data ?? []) as HappinessRow[]).map(fromHappinessRow);
      }
      const { data, error } = await db.from("happiness_checks").select("id, client_id, score, comment, created_at").eq("client_id", who.me).eq("coach_id", who.coachId).order("created_at", { ascending: false });
      if (error) throw fail(error);
      return ((data ?? []) as Omit<HappinessRow, "name">[]).map((r) => fromHappinessRow({ ...r, name: "You" }));
    },
    async answer(score, comment) {
      const p = happinessProblem(score, comment);
      if (p) throw new Error(p);
      const { error } = await db.from("happiness_checks").insert({ coach_id: who.coachId, client_id: who.me, score, comment: comment.trim() });
      if (error) throw fail(error);
    },
    async visits(days) {
      const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const { data, error } = await db.from("page_visits").select("day, source, visits").eq("coach_id", who.coachId).gte("day", from);
      if (error) throw fail(error);
      return ((data ?? []) as PageVisits[]).map((r) => ({ ...r, visits: Number(r.visits) }));
    },
    async proof(days) {
      const { data, error } = await db.rpc("coach_proof", { p_days: days });
      if (error) throw fail(error);
      const r = ((data ?? []) as { clients: number; workouts: number; kg: number | string; bests: number; sessions: number }[])[0];
      return { days, clients: Number(r?.clients ?? 0), workouts: Number(r?.workouts ?? 0), kg: Number(r?.kg ?? 0), bests: Number(r?.bests ?? 0), sessions: Number(r?.sessions ?? 0) };
    },
    async joinedThisMonth() {
      const { count, error } = await db.from("coach_clients").select("client_id", { count: "exact", head: true }).eq("coach_id", who.coachId).neq("status", "invited").gte("started_at", monthStart());
      if (error) throw fail(error);
      return count ?? 0;
    },
  };
}

/** Anyone opening a coach's page: count the visit, and read places left and the offer. */
export interface PageMarketing { spots: number | null; joined: number; campaign: Campaign | null }

export async function livePageMarketing(db: SupabaseClient, slug: string): Promise<PageMarketing | null> {
  const { data, error } = await db.rpc("public_coach_marketing", { p_slug: slug });
  if (error || !data) return null;
  const d = data as { spots: number | null; joined: number; campaign: Campaign | null };
  return { spots: d.spots ?? null, joined: Number(d.joined ?? 0), campaign: d.campaign ?? null };
}

export function liveCountVisit(db: SupabaseClient, slug: string, source: string | null): void {
  // One per page load and tab, so a refresh doesn't count twice.
  const key = `apex-visit-${slug}`;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* count it */ }
  void db.rpc("count_page_visit", { p_slug: slug, p_source: source }).then(() => undefined, () => undefined);
}

/* ---------- Demo: shared by the coach tab, the client tab and the public page ---------- */

const KEY = "apex-marketing-v1";
interface Demo { settings: MarketingSettings; answers: HappinessAnswer[]; extraVisits: PageVisits[] }
const inDays = (d: number) => { const t = new Date(Date.now() + d * 86400000); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
const read = (): Demo => {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as Demo; } catch { /* sample */ }
  return {
    settings: { spots: 3, campaign: { title: "Winter strong", text: "Start before the end of the month and your first two weeks are free.", ends: inDays(12) } },
    answers: sampleHappiness(),
    extraVisits: [],
  };
};
const write = (d: Demo) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* this visit only */ } };

/** Priya in the sample roster. */
const DEMO_PRIYA = "5";
/** Demo clients who started this month. */
const DEMO_JOINED = 1;

export function demoMarketing(side: "coach" | "client"): MarketingApi {
  return {
    live: false,
    side,
    async settings() { return read().settings; },
    async saveSettings(s, today) {
      check(s, today);
      const d = read();
      write({ ...d, settings: { spots: s.spots, campaign: s.campaign ? { title: s.campaign.title.trim(), text: s.campaign.text.trim(), ends: s.campaign.ends } : null } });
    },
    async happiness() {
      const all = read().answers;
      return side === "coach" ? all : all.filter((a) => a.clientId === DEMO_PRIYA);
    },
    async answer(score, comment) {
      const p = happinessProblem(score, comment);
      if (p) throw new Error(p);
      const d = read();
      write({ ...d, answers: [{ id: `h-${Date.now()}`, clientId: DEMO_PRIYA, name: "Priya S.", score, comment: comment.trim(), at: new Date().toISOString() }, ...d.answers] });
    },
    async visits() { return [...sampleVisits(), ...read().extraVisits]; },
    async proof(days) { return { ...sampleProof(), days }; },
    async joinedThisMonth() { return DEMO_JOINED; },
  };
}

export function demoPageMarketing(): PageMarketing {
  const s = read().settings;
  return { spots: s.spots, joined: DEMO_JOINED, campaign: s.campaign && s.campaign.ends >= inDays(0) ? s.campaign : null };
}

const Ctx = createContext<MarketingApi | null>(null);
export const MarketingProvider = Ctx.Provider;
export const useMarketingApi = (): MarketingApi | null => useContext(Ctx);
