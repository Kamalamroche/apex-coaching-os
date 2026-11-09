import { DEFAULT_OFFER, fromReviewRow, newPack, reviewProblem, reviewUrlProblem, sampleReviews, toPackRow, type GrowOffer, type ReferralJoin, type Review, type ReviewRow } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

/** Growth tools: the coach's offers, referral rewards and reviews. Client: their own review and their coach's offer. */
export interface GrowApi {
  live: boolean;
  /** Coach: my offer. Client: my coach's offer (defaults until the coach saves one). */
  offer(): Promise<GrowOffer>;
  saveOffer(o: GrowOffer): Promise<void>;
  /** Coach: friends who joined through a client's link. */
  referralJoins(): Promise<ReferralJoin[]>;
  /** Coach: adds the free sessions to the client who brought the friend, once. */
  reward(r: ReferralJoin, sessions: number): Promise<void>;
  /** Coach: every review. Client: my review, if I wrote one. */
  reviews(): Promise<Review[]>;
  setApproved(id: string, approved: boolean): Promise<void>;
  removeReview(id: string): Promise<void>;
  /** Client: write or edit my review. An edit goes back to the coach for approval. */
  saveReview(stars: number, body: string, showName: boolean): Promise<void>;
}

export const GROW_NEEDS_UPDATE = "Rewards and reviews need the growth tools SQL in Supabase first.";
const missing = (e: { code?: string } | null) => !!e && ["42P01", "PGRST205", "PGRST202", "42703", "PGRST204"].includes(e.code ?? "");
const fail = (e: { code?: string; message: string }) => (missing(e) ? new Error(GROW_NEEDS_UPDATE) : new Error(e.message));

interface OfferRow { intro_offer: boolean; referral_reward: number; google_review_url: string }
const fromOffer = (r: OfferRow | null | undefined): GrowOffer => (r ? { introOffer: !!r.intro_offer, referralReward: Number(r.referral_reward ?? 1), googleReviewUrl: r.google_review_url ?? "" } : DEFAULT_OFFER);

export function liveGrow(db: SupabaseClient, who: { side: "coach" | "client"; coachId: string; me: string }): GrowApi {
  return {
    live: true,
    async offer() {
      const { data, error } = await db.rpc("my_coach_offer", { p_coach: who.coachId });
      if (error) throw fail(error);
      return fromOffer(((data ?? []) as OfferRow[])[0]);
    },
    async saveOffer(o) {
      const problem = reviewUrlProblem(o.googleReviewUrl);
      if (problem) throw new Error(problem);
      const { data, error } = await db.from("coach_pages").update({ intro_offer: o.introOffer, referral_reward: o.referralReward, google_review_url: o.googleReviewUrl.trim() }).eq("coach_id", who.coachId).select("coach_id");
      if (error) throw fail(error);
      if (!data?.length) throw new Error("Set up your page under Page first, then your offers can show on it.");
    },
    async referralJoins() {
      const { data, error } = await db.from("join_requests").select("id, name, ref_client, status, stage, reward_pack_id").eq("coach_id", who.coachId).not("ref_client", "is", null);
      if (error) throw fail(error);
      return ((data ?? []) as { id: string; name: string; ref_client: string; status: string; stage?: string; reward_pack_id: string | null }[])
        .map((r) => ({ id: r.id, friend: r.name, referrerId: r.ref_client, joined: r.status === "joined" || r.stage === "client", rewarded: !!r.reward_pack_id }));
    },
    async reward(r, sessions) {
      const pack = newPack(r.referrerId, sessions, 0, "free", 0, `For bringing ${r.friend}`, "referral");
      const { error } = await db.from("session_packs").insert(toPackRow(pack, who.coachId));
      if (error) throw fail(error);
      const { error: e2 } = await db.from("join_requests").update({ reward_pack_id: pack.id }).eq("id", r.id);
      if (e2) throw fail(e2);
    },
    async reviews() {
      if (who.side === "coach") {
        const { data, error } = await db.rpc("coach_reviews");
        if (error) throw fail(error);
        return ((data ?? []) as ReviewRow[]).map(fromReviewRow);
      }
      const { data, error } = await db.from("reviews").select("id, client_id, stars, body, approved, created_at, show_name").eq("client_id", who.me).eq("coach_id", who.coachId);
      if (error) throw fail(error);
      return ((data ?? []) as (ReviewRow & { show_name: boolean })[]).map((r) => fromReviewRow({ ...r, name: r.show_name ? "you" : null }));
    },
    async setApproved(id, approved) {
      const { error } = await db.from("reviews").update({ approved }).eq("id", id);
      if (error) throw fail(error);
    },
    async removeReview(id) {
      const { error } = await db.from("reviews").delete().eq("id", id);
      if (error) throw fail(error);
    },
    async saveReview(stars, body, showName) {
      const problem = reviewProblem(stars, body);
      if (problem) throw new Error(problem);
      const { error } = await db.from("reviews").upsert({ coach_id: who.coachId, client_id: who.me, stars, body: body.trim(), show_name: showName }, { onConflict: "coach_id,client_id" });
      if (error) throw fail(error);
    },
  };
}

/* ---------- Demo: shared by the coach and client tabs ---------- */

const KEY = "apex-grow-v1";
interface Demo { offer: GrowOffer; reviews: Review[]; rewarded: string[] }
const read = (): Demo => {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as Demo; } catch { /* sample */ }
  return { offer: { ...DEFAULT_OFFER, introOffer: true, googleReviewUrl: "https://g.page/r/apex-demo/review" }, reviews: sampleReviews(), rewarded: [] };
};
const write = (d: Demo) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* this visit only */ } };
const update = (f: (d: Demo) => Demo) => write(f(read()));

/** Demo: Priya brought Tom, who joined; Kamal hasn't rewarded her yet. */
const DEMO_JOINS: Omit<ReferralJoin, "rewarded">[] = [{ id: "demo-ref-1", friend: "Tom Reed", referrerId: "demo-priya", joined: true }];

export function demoGrow(side: "coach" | "client", addPack?: (clientId: string, sessions: number, note: string) => Promise<void>): GrowApi {
  return {
    live: false,
    async offer() { return read().offer; },
    async saveOffer(o) {
      const problem = reviewUrlProblem(o.googleReviewUrl);
      if (problem) throw new Error(problem);
      update((d) => ({ ...d, offer: { ...o, googleReviewUrl: o.googleReviewUrl.trim() } }));
    },
    async referralJoins() { const done = read().rewarded; return DEMO_JOINS.map((r) => ({ ...r, rewarded: done.includes(r.id) })); },
    async reward(r, sessions) {
      await addPack?.(r.referrerId, sessions, `For bringing ${r.friend}`);
      update((d) => ({ ...d, rewarded: [...d.rewarded, r.id] }));
    },
    async reviews() { const all = read().reviews; return side === "coach" ? all : all.filter((r) => r.clientId === "demo-priya"); },
    async setApproved(id, approved) { update((d) => ({ ...d, reviews: d.reviews.map((r) => (r.id === id ? { ...r, approved } : r)) })); },
    async removeReview(id) { update((d) => ({ ...d, reviews: d.reviews.filter((r) => r.id !== id) })); },
    async saveReview(stars, body, showName) {
      const problem = reviewProblem(stars, body);
      if (problem) throw new Error(problem);
      update((d) => ({ ...d, reviews: [{ id: "demo-review-priya", clientId: "demo-priya", name: showName ? "Priya S." : null, stars, body: body.trim(), approved: false, at: new Date().toISOString() }, ...d.reviews.filter((r) => r.clientId !== "demo-priya")] }));
    },
  };
}

/** The public page: the coach's intro offer and approved reviews. */
export interface PageExtras { introOffer: boolean; reviews: { name: string | null; stars: number; body: string; at: string }[] }

export async function livePageExtras(db: SupabaseClient, slug: string): Promise<PageExtras | null> {
  const { data, error } = await db.rpc("public_coach_extras", { p_slug: slug });
  if (error || !data) return null;
  const d = data as { intro_offer: boolean; reviews: PageExtras["reviews"] };
  return { introOffer: !!d.intro_offer, reviews: d.reviews ?? [] };
}

export function demoPageExtras(): PageExtras {
  const d = read();
  return { introOffer: d.offer.introOffer, reviews: d.reviews.filter((r) => r.approved).map((r) => ({ name: r.name, stars: r.stars, body: r.body, at: r.at })) };
}

const Ctx = createContext<GrowApi | null>(null);
export const GrowProvider = Ctx.Provider;
export const useGrowApi = (): GrowApi | null => useContext(Ctx);
