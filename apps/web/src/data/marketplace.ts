import { sampleCredentials, sampleTrainers, credentialProblem, type Credential, type CredentialDraft, type CredentialKind, type CredentialReview, type CredentialStatus, type TrainerCard, type TrainingModeName } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";

export const MARKETPLACE_SQL = "20261130090000_marketplace.sql";
export const MARKETPLACE_NEEDS_UPDATE = `Find a trainer needs a database update first: run ${MARKETPLACE_SQL} in Supabase.`;
const missing = (e: { code?: string } | null) => !!e && ["42P01", "PGRST205", "PGRST202", "42703", "PGRST204", "42883"].includes(e.code ?? "");
const fail = (e: { code?: string; message: string }) => (missing(e) ? new Error(MARKETPLACE_NEEDS_UPDATE) : new Error(e.message));
const BUCKET = "credentials";
const LINK_SECONDS = 600;

/** Anyone: the directory, and the badge on one page. */
export interface DirectoryApi {
  live: boolean;
  trainers(): Promise<TrainerCard[]>;
  /** Null when the page isn't published or the SQL hasn't run. */
  trust(slug: string): Promise<PageTrust | null>;
}

export interface PageTrust { verified: boolean; listed: boolean; credentials: { kind: CredentialKind; title: string; issuer: string }[] }

/** Coach: being in the directory and the certificates behind the badge. Checkers: the queue. */
export interface ListingApi {
  live: boolean;
  listed(): Promise<boolean>;
  setListed(on: boolean): Promise<void>;
  credentials(): Promise<Credential[]>;
  addCredential(d: CredentialDraft, file: File, today: string): Promise<void>;
  removeCredential(c: Credential): Promise<void>;
  /** A short-lived link to open a certificate file. */
  fileUrl(path: string): Promise<string | null>;
  isChecker(): Promise<boolean>;
  queue(status: CredentialStatus | null): Promise<CredentialReview[]>;
  review(id: string, approve: boolean, note: string): Promise<void>;
}

interface TrainerRow {
  slug: string; name: string; headline: string; city: string; specialties: string[]; modes: string[]; clients: number | null;
  rating: number | string | null; reviews: number; from_pence: number | null; verified: boolean; intro_offer: boolean; listed_at: string; updated_at: string;
}

export const fromTrainerRow = (r: TrainerRow): TrainerCard => ({
  slug: r.slug, name: r.name, headline: r.headline ?? "", city: r.city ?? "", specialties: r.specialties ?? [], modes: (r.modes ?? []) as TrainingModeName[],
  rating: r.rating !== null && r.reviews > 0 ? { average: Number(r.rating), count: r.reviews } : null,
  fromPence: r.from_pence ?? null, verified: !!r.verified, clients: r.clients ?? null, introOffer: !!r.intro_offer, listedAt: r.listed_at,
});

interface CredentialRow { id: string; kind: CredentialKind; title: string; issuer: string; expires: string | null; status: CredentialStatus; note: string; file_name: string; file_path: string; created_at: string }
const fromCredentialRow = (r: CredentialRow): Credential => ({
  id: r.id, kind: r.kind, title: r.title, issuer: r.issuer, expires: r.expires, status: r.status, note: r.note ?? "", fileName: r.file_name ?? "", createdAt: r.created_at,
});
const paths = new Map<string, string>();

export function liveDirectory(db: SupabaseClient): DirectoryApi {
  return {
    live: true,
    async trainers() {
      const { data, error } = await db.rpc("public_trainers");
      if (error) throw fail(error);
      return ((data ?? []) as TrainerRow[]).map(fromTrainerRow);
    },
    async trust(slug) {
      const { data, error } = await db.rpc("public_coach_trust", { p_slug: slug });
      if (error || !data) return null;
      return data as PageTrust;
    },
  };
}

const safeName = (name: string) => name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "certificate";

export function liveListing(db: SupabaseClient, coachId: string): ListingApi {
  return {
    live: true,
    async listed() {
      const { data, error } = await db.from("coach_pages").select("listed").eq("coach_id", coachId).maybeSingle();
      if (error) throw fail(error);
      return !!(data as { listed?: boolean } | null)?.listed;
    },
    async setListed(on) {
      const { error } = await db.rpc("set_listed", { p_listed: on });
      if (error) throw fail(error);
    },
    async credentials() {
      const { data, error } = await db.from("coach_credentials").select("id, kind, title, issuer, expires, status, note, file_name, file_path, created_at").eq("coach_id", coachId).order("created_at", { ascending: false });
      if (error) throw fail(error);
      return ((data ?? []) as CredentialRow[]).map((r) => { paths.set(r.id, r.file_path); return fromCredentialRow(r); });
    },
    async addCredential(d, file, today) {
      const problem = credentialProblem(d, file, today);
      if (problem) throw new Error(problem);
      const path = `${coachId}/${Date.now()}-${safeName(file.name)}`;
      const up = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw new Error(/bucket/i.test(up.error.message) ? MARKETPLACE_NEEDS_UPDATE : up.error.message);
      const { error } = await db.from("coach_credentials").insert({ coach_id: coachId, kind: d.kind, title: d.title.trim(), issuer: d.issuer.trim(), expires: d.expires, file_path: path, file_name: file.name.slice(0, 200) });
      if (error) { await db.storage.from(BUCKET).remove([path]); throw fail(error); }
    },
    async removeCredential(c) {
      const { error } = await db.from("coach_credentials").delete().eq("id", c.id);
      if (error) throw fail(error);
      const path = paths.get(c.id);
      if (path) await db.storage.from(BUCKET).remove([path]);
    },
    async fileUrl(pathOrId) {
      const path = paths.get(pathOrId) ?? pathOrId;
      const { data } = await db.storage.from(BUCKET).createSignedUrl(path, LINK_SECONDS);
      return data?.signedUrl ?? null;
    },
    async isChecker() {
      const { data, error } = await db.rpc("is_platform_admin");
      return !error && data === true;
    },
    async queue(status) {
      const { data, error } = await db.rpc("admin_credentials", { p_status: status });
      if (error) throw fail(error);
      return ((data ?? []) as (CredentialRow & { coach_name: string; slug: string | null })[]).map((r) => ({ ...fromCredentialRow(r), coachName: r.coach_name, slug: r.slug, filePath: r.file_path }));
    },
    async review(id, approve, note) {
      const { error } = await db.rpc("review_credential", { p_id: id, p_approve: approve, p_note: note.trim() });
      if (error) throw fail(error);
    },
  };
}

// ── Demo: localStorage, shared by the coach tab and the public pages ─────────

const KEY = "apex-marketplace-v1";
interface DemoState { listed: boolean; credentials: Credential[]; queue: CredentialReview[] }

const sampleQueue = (): CredentialReview[] => {
  const at = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
  return [
    { id: "q-1", kind: "qualification", title: "Level 3 Personal Trainer", issuer: "Northfield Fitness Academy", expires: null, status: "pending", note: "", fileName: "certificate.jpg", createdAt: at(20), coachName: "Diego Ramírez", slug: "diego-ramirez", filePath: "" },
    { id: "q-2", kind: "insurance", title: "Public liability £5m", issuer: "Shieldline Insurance", expires: new Date(Date.now() + 300 * 864e5).toISOString().slice(0, 10), status: "pending", note: "", fileName: "policy.pdf", createdAt: at(6), coachName: "Tom Walsh", slug: "tom-walsh", filePath: "" },
  ];
};

const readDemo = (): DemoState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch { /* sample */ }
  return { listed: true, credentials: sampleCredentials(), queue: sampleQueue() };
};
const writeDemo = (s: DemoState) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* this visit only */ } };

export function demoDirectory(): DirectoryApi {
  return {
    live: false,
    async trainers() {
      const s = readDemo();
      // The demo coach (Kamal) follows their own listing switch and badge.
      return sampleTrainers().filter((t) => t.slug !== "kamal" || s.listed).map((t) => (t.slug === "kamal" ? { ...t, verified: s.credentials.filter((c) => c.status === "approved").length >= 2 } : t));
    },
    async trust(slug) {
      const s = readDemo();
      const t = sampleTrainers().find((x) => x.slug === slug);
      if (!t) return null;
      if (slug !== "kamal") return { verified: t.verified, listed: true, credentials: t.verified ? [{ kind: "qualification", title: "Level 3 Personal Trainer", issuer: "Northfield Fitness Academy" }] : [] };
      const approved = s.credentials.filter((c) => c.status === "approved");
      return { verified: approved.some((c) => c.kind === "qualification") && approved.some((c) => c.kind === "insurance"), listed: s.listed, credentials: approved.filter((c) => c.kind !== "insurance").map(({ kind, title, issuer }) => ({ kind, title, issuer })) };
    },
  };
}

export function demoListing(): ListingApi {
  return {
    live: false,
    async listed() { return readDemo().listed; },
    async setListed(on) { writeDemo({ ...readDemo(), listed: on }); },
    async credentials() { return readDemo().credentials; },
    async addCredential(d, file, today) {
      const problem = credentialProblem(d, file, today);
      if (problem) throw new Error(problem);
      const c: Credential = { id: `cr-${Date.now()}`, kind: d.kind, title: d.title.trim(), issuer: d.issuer.trim(), expires: d.expires, status: "pending", note: "", fileName: file.name, createdAt: new Date().toISOString() };
      const s = readDemo();
      writeDemo({ ...s, credentials: [c, ...s.credentials], queue: [...s.queue, { ...c, coachName: "Kamal Amroche", slug: "kamal", filePath: "" }] });
    },
    async removeCredential(c) {
      const s = readDemo();
      writeDemo({ ...s, credentials: s.credentials.filter((x) => x.id !== c.id), queue: s.queue.filter((x) => x.id !== c.id) });
    },
    async fileUrl() { return null; },
    async isChecker() { return true; },
    async queue(status) { return readDemo().queue.filter((q) => status === null || q.status === status); },
    async review(id, approve, note) {
      if (!approve && note.trim().length < 3) throw new Error("Say why, so the trainer can fix it.");
      const s = readDemo();
      const status: CredentialStatus = approve ? "approved" : "rejected";
      const patch = (c: Credential) => (c.id === id ? { ...c, status, note: approve ? "" : note.trim() } : c);
      writeDemo({ ...s, queue: s.queue.map((q) => (q.id === id ? { ...q, status, note: approve ? "" : note.trim() } : q)), credentials: s.credentials.map(patch) });
    },
  };
}
