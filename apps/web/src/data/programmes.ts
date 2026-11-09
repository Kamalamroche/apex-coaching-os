import {
  fromEnrolmentRow, fromListingRow, fromPublicProgrammeRow, listingProblem, sampleProgrammes, toListingRow, toPublicProgramme,
  type Enrolment, type EnrolmentRow, type ListingRow, type PaidVia, type ProgrammeListing, type PublicProgramme, type PublicProgrammeRow,
} from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

/** On-demand programmes. The coach makes and sells them; clients browse their coach's live ones, ask, and start. */
export interface ProgrammeApi {
  live: boolean;
  side: "coach" | "client";
  /** Who is signed in: the client's own enrolments are theirs. */
  me: string;
  listings(): Promise<ProgrammeListing[]>;
  enrolments(): Promise<Enrolment[]>;
  /* coach */
  save(l: ProgrammeListing): Promise<void>;
  remove(id: string): Promise<void>;
  /** Coach unlocks a request (paid by bank transfer or cash), gives it free, or says no. */
  answer(id: string, change: { status: "active"; paidPence: number; paidVia: Extract<PaidVia, "manual" | "gift"> } | { status: "declined" }): Promise<void>;
  /* client */
  request(listingId: string): Promise<void>;
  /** Copies the programme into the client's own new program on the server (live). Demo: the caller starts it in the store. */
  start(listingId: string): Promise<void>;
}

export const PROGRAMMES_NEED_UPDATE = "needs-update";
const isMissing = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205" || e?.code === "PGRST202" || e?.code === "42883";
const err = (e: { code?: string; message: string }) =>
  isMissing(e) ? new Error(PROGRAMMES_NEED_UPDATE)
    : e.code === "23503" ? new Error("People have joined this programme, so it can't be deleted. Switch it to draft instead.")
      : new Error(e.message);

export function liveProgrammes(db: SupabaseClient, who: { side: "coach" | "client"; coachId: string; me: string }): ProgrammeApi {
  return {
    live: true,
    side: who.side,
    me: who.me,
    async listings() {
      // RLS shows a client only their coach's live programmes.
      const { data, error } = await db.from("programme_listings").select("*").eq("coach_id", who.coachId).order("created_at", { ascending: false }).limit(100).returns<ListingRow[]>();
      if (error) throw err(error);
      return (data ?? []).map(fromListingRow);
    },
    async enrolments() {
      if (who.side === "client") {
        const { data, error } = await db.from("programme_enrolments").select("*").eq("client_id", who.me).returns<EnrolmentRow[]>();
        if (error) throw err(error);
        return (data ?? []).map(fromEnrolmentRow);
      }
      const { data, error } = await db.from("programme_enrolments").select("*, profiles!programme_enrolments_client_id_fkey(full_name)").eq("coach_id", who.coachId).order("created_at", { ascending: false }).limit(500);
      if (error) throw err(error);
      return (data ?? []).map((r) => fromEnrolmentRow({ ...(r as EnrolmentRow), client_name: (r as { profiles?: { full_name?: string } | null }).profiles?.full_name ?? null }));
    },
    async save(l) {
      const problem = listingProblem(l);
      if (problem) throw new Error(problem);
      const { error } = await db.from("programme_listings").upsert({ ...toListingRow(l, who.coachId), updated_at: new Date().toISOString() });
      if (error) throw err(error);
    },
    async remove(id) {
      const { error } = await db.from("programme_listings").delete().eq("id", id);
      if (error) throw err(error);
    },
    async answer(id, change) {
      const patch = change.status === "active"
        ? { status: "active", paid_pence: change.paidPence, paid_via: change.paidVia, updated_at: new Date().toISOString() }
        : { status: "declined", updated_at: new Date().toISOString() };
      const { error } = await db.from("programme_enrolments").update(patch).eq("id", id);
      if (error) throw err(error);
    },
    async request(listingId) {
      const { error } = await db.rpc("request_programme", { p_listing: listingId });
      if (error) throw err(error);
    },
    async start(listingId) {
      const { error } = await db.rpc("start_programme", { p_listing: listingId });
      if (error) throw err(error);
    },
  };
}

/* ---------- demo: one shop in this browser, seen from both sides ---------- */

const KEY = "apex-programmes-v1";
export const DEMO_CLIENT = "demo-client";

interface DemoShop { listings: ProgrammeListing[]; enrolments: Enrolment[] }

export function demoProgrammes(side: "coach" | "client"): ProgrammeApi {
  const read = (): DemoShop => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as DemoShop;
    } catch { /* sample */ }
    return sampleProgrammes();
  };
  const write = (v: DemoShop) => {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* this visit only */ }
  };
  const upsertEnrolment = (shop: DemoShop, listingId: string, patch: Partial<Enrolment>) => {
    const cur = shop.enrolments.find((e) => e.listingId === listingId && e.clientId === DEMO_CLIENT);
    const next: Enrolment = { id: crypto.randomUUID(), listingId, clientId: DEMO_CLIENT, clientName: "Priya Shah", status: "requested", paidPence: 0, paidVia: null, programId: null, startedAt: null, createdAt: new Date().toISOString(), ...cur, ...patch };
    write({ ...shop, enrolments: cur ? shop.enrolments.map((e) => (e === cur ? next : e)) : [next, ...shop.enrolments] });
  };
  const live = (id: string) => {
    const l = read().listings.find((x) => x.id === id && x.status === "live");
    if (!l) throw new Error("This programme isn't available.");
    return l;
  };
  return {
    live: false,
    side,
    me: side === "client" ? DEMO_CLIENT : "demo-coach",
    async listings() {
      const all = read().listings;
      return side === "client" ? all.filter((l) => l.status === "live") : all;
    },
    async enrolments() {
      const all = read().enrolments;
      return side === "client" ? all.filter((e) => e.clientId === DEMO_CLIENT) : all;
    },
    async save(l) {
      const problem = listingProblem(l);
      if (problem) throw new Error(problem);
      const shop = read();
      write({ ...shop, listings: shop.listings.some((x) => x.id === l.id) ? shop.listings.map((x) => (x.id === l.id ? l : x)) : [l, ...shop.listings] });
    },
    async remove(id) {
      const shop = read();
      if (shop.enrolments.some((e) => e.listingId === id && e.status === "active")) throw new Error("People have joined this programme, so it can't be deleted. Switch it to draft instead.");
      write({ listings: shop.listings.filter((x) => x.id !== id), enrolments: shop.enrolments.filter((e) => e.listingId !== id) });
    },
    async answer(id, change) {
      const shop = read();
      write({ ...shop, enrolments: shop.enrolments.map((e) => (e.id !== id ? e : change.status === "active" ? { ...e, status: "active", paidPence: change.paidPence, paidVia: change.paidVia } : { ...e, status: "declined" })) });
    },
    async request(listingId) {
      const l = live(listingId);
      if (!l.pricePence) throw new Error("This one is free: start it straight away.");
      const shop = read();
      const cur = shop.enrolments.find((e) => e.listingId === listingId && e.clientId === DEMO_CLIENT);
      if (cur && cur.status !== "declined") return;
      upsertEnrolment(shop, listingId, { status: "requested", createdAt: new Date().toISOString() });
    },
    async start(listingId) {
      const l = live(listingId);
      const shop = read();
      const cur = shop.enrolments.find((e) => e.listingId === listingId && e.clientId === DEMO_CLIENT);
      if (l.pricePence && cur?.status !== "active") throw new Error("Your coach needs to unlock this one first.");
      upsertEnrolment(shop, listingId, { status: "active", paidVia: cur?.paidVia ?? "free", startedAt: new Date().toISOString() });
    },
  };
}

/** Anyone: the programmes on a coach's public page. */
export async function livePublicProgrammes(db: SupabaseClient, slug: string): Promise<PublicProgramme[]> {
  const { data, error } = await db.rpc("public_programmes", { p_slug: slug });
  if (error) return []; // The page still works before the SQL has been run.
  return ((data ?? []) as PublicProgrammeRow[]).map(fromPublicProgrammeRow);
}

export function demoPublicProgrammes(): PublicProgramme[] {
  return sampleProgrammes().listings.filter((l) => l.status === "live" && l.onPage).map(toPublicProgramme);
}

const Ctx = createContext<ProgrammeApi | null>(null);
export const ProgrammeProvider = Ctx.Provider;
export const useProgrammeApi = (): ProgrammeApi | null => useContext(Ctx);
