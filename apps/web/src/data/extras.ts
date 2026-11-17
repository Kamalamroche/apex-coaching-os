import {
  ANSWER_STARTERS, DEMO_CLIENT_ID, SESSION_NOTE_MAX, sampleSessionNotes, sessionNoteProblem, type SessionNote, agreementProblem, answerProblem, classProblem, demoJoin, demoLeave, sampleAgreements,
  type Agreement, type ClassSpot, type ClassView, type CoachAnswer, type GroupClass, type Signature,
} from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, createElement, useContext, type ReactNode } from "react";

/* Contracts and waivers, group classes and quick answers, for both sides. Demo: this browser (shared by the coach and
   client tabs, so signing or booking on one shows on the other). Live: Supabase, with the fair-queue rules in SQL. */

export type AgreementInput = { id?: string; title: string; body: string; required: boolean; active: boolean };
export type ClassInput = Omit<GroupClass, "id" | "cancelled"> & { id?: string };

export interface ExtrasApi {
  side: "coach" | "client";
  live: boolean;
  /** The signed-in client (client side). */
  me: string;
  agreements: {
    list(): Promise<{ agreements: Agreement[]; signatures: Signature[] }>;
    save(a: AgreementInput): Promise<void>;
    remove(id: string): Promise<void>;
    sign(id: string, typedName: string): Promise<void>;
  };
  classes: {
    list(): Promise<ClassView[]>;
    spots(classId: string): Promise<ClassSpot[]>;
    save(c: ClassInput): Promise<void>;
    cancel(id: string): Promise<void>;
    join(id: string): Promise<"booked" | "waitlist">;
    leave(id: string, clientId?: string): Promise<void>;
  };
  answers: {
    list(): Promise<CoachAnswer[]>;
    save(a: { id?: string; question: string; answer: string }): Promise<void>;
    remove(id: string): Promise<void>;
  };
  /** Session notes. Coach: every note for one client. Client: only the notes shared with them (clientId ignored). */
  notes: {
    list(clientId: string): Promise<SessionNote[]>;
    add(n: { clientId: string; body: string; shared: boolean; session: string | null }): Promise<SessionNote>;
    setShared(id: string, shared: boolean): Promise<void>;
    remove(id: string): Promise<void>;
  };
}

export const NOTES_NEED_SQL = "Session notes need the latest database update (20261123090000_one_to_one.sql)";
const failNote = (e: { code?: string; message: string }) => new Error(missing(e) ? NOTES_NEED_SQL : e.message);
type NoteRow = { id: string; client_id: string; body: string; shared: boolean; session_label: string | null; created_at: string };
const fromNote = (r: NoteRow): SessionNote => ({ id: r.id, clientId: r.client_id, body: r.body, shared: r.shared, session: r.session_label, createdAt: r.created_at });
const cleanNote = (body: string) => { check(sessionNoteProblem(body)); return body.trim().slice(0, SESSION_NOTE_MAX); };

export const EXTRAS_NEED_SQL = "This needs the latest database update (20261121090000_contracts_classes_inbox.sql)";
const missing = (e: { code?: string } | null) => ["42P01", "PGRST205", "PGRST202", "42883"].includes(e?.code ?? "");
const fail = (e: { code?: string; message: string }) => new Error(missing(e) ? EXTRAS_NEED_SQL : e.message);
const check = (p: string | null) => { if (p) throw new Error(p); };

type AgreementRow = { id: string; title: string; body: string; required: boolean; version: number; active: boolean; updated_at: string };
type SignatureRow = { id: string; agreement_id: string | null; client_id: string; version: number; title: string; body: string; typed_name: string; signed_at: string };
type ClassRow = { id: string; title: string; starts_at: string; minutes: number; capacity: number; place: string; note: string; cancelled: boolean };

const fromAgreement = (r: AgreementRow): Agreement => ({ id: r.id, title: r.title, body: r.body, required: r.required, version: r.version, active: r.active, updatedAt: r.updated_at });
const fromSignature = (r: SignatureRow): Signature => ({ id: r.id, agreementId: r.agreement_id, clientId: r.client_id, version: r.version, title: r.title, body: r.body, typedName: r.typed_name, signedAt: r.signed_at });
const fromClass = (r: ClassRow): GroupClass => ({ id: r.id, title: r.title, startsAt: r.starts_at, minutes: r.minutes, capacity: r.capacity, place: r.place, note: r.note, cancelled: r.cancelled });

export function liveExtras(db: SupabaseClient, o: { side: "coach" | "client"; coachId: string; me: string }): ExtrasApi {
  return {
    side: o.side,
    live: true,
    me: o.me,
    agreements: {
      async list() {
        const [a, s] = await Promise.all([
          db.from("coach_agreements").select("id, title, body, required, version, active, updated_at").eq("coach_id", o.coachId).order("created_at"),
          db.from("agreement_signatures").select("id, agreement_id, client_id, version, title, body, typed_name, signed_at").eq("coach_id", o.coachId).order("signed_at", { ascending: false }).limit(1000),
        ]);
        if (a.error) throw fail(a.error);
        if (s.error) throw fail(s.error);
        return { agreements: (a.data as AgreementRow[]).map(fromAgreement), signatures: (s.data as SignatureRow[]).map(fromSignature) };
      },
      async save(a) {
        check(agreementProblem(a));
        const row = { title: a.title.trim(), body: a.body.trim(), required: a.required, active: a.active };
        const { error } = a.id ? await db.from("coach_agreements").update(row).eq("id", a.id) : await db.from("coach_agreements").insert({ ...row, coach_id: o.coachId });
        if (error) throw fail(error);
      },
      async remove(id) {
        const { error } = await db.from("coach_agreements").delete().eq("id", id);
        if (error) throw fail(error);
      },
      async sign(id, typedName) {
        const { error } = await db.rpc("sign_agreement", { p_agreement: id, p_name: typedName });
        if (error) throw fail(error);
      },
    },
    classes: {
      async list() {
        if (o.side === "client") {
          const { data, error } = await db.rpc("class_list");
          if (error) throw fail(error);
          return (data as (ClassRow & { booked: number; waiting: number; my_status: ClassView["myStatus"]; my_place: number | null })[]).map((r) => ({ ...fromClass(r), booked: r.booked, waiting: r.waiting, myStatus: r.my_status, myPlace: r.my_place }));
        }
        const since = new Date(Date.now() - 2 * 3600e3).toISOString();
        const { data, error } = await db.from("group_classes").select("id, title, starts_at, minutes, capacity, place, note, cancelled, class_spots(status)").eq("coach_id", o.coachId).gte("starts_at", since).order("starts_at").limit(60);
        if (error) throw fail(error);
        return (data as (ClassRow & { class_spots: { status: string }[] })[]).map((r) => ({
          ...fromClass(r),
          booked: r.class_spots.filter((s) => s.status === "booked").length,
          waiting: r.class_spots.filter((s) => s.status === "waitlist").length,
          myStatus: null,
          myPlace: null,
        }));
      },
      async spots(classId) {
        const { data, error } = await db.from("class_spots").select("client_id, status, joined_at, profiles!class_spots_client_id_fkey(full_name)").eq("class_id", classId);
        if (error) throw fail(error);
        return (data as unknown as { client_id: string; status: ClassSpot["status"]; joined_at: string; profiles: { full_name: string } | null }[]).map((r) => ({ clientId: r.client_id, name: r.profiles?.full_name ?? "Client", status: r.status, joinedAt: r.joined_at }));
      },
      async save(c) {
        check(classProblem(c, new Date()));
        const row = { title: c.title.trim(), starts_at: c.startsAt, minutes: c.minutes, capacity: c.capacity, place: c.place.trim(), note: c.note.trim() };
        const { error } = c.id ? await db.from("group_classes").update(row).eq("id", c.id) : await db.from("group_classes").insert({ ...row, coach_id: o.coachId });
        if (error) throw fail(error);
      },
      async cancel(id) {
        const { error } = await db.from("group_classes").update({ cancelled: true }).eq("id", id);
        if (error) throw fail(error);
      },
      async join(id) {
        const { data, error } = await db.rpc("join_class", { p_class: id });
        if (error) throw fail(error);
        return data as "booked" | "waitlist";
      },
      async leave(id, clientId) {
        const { error } = await db.rpc("leave_class", clientId ? { p_class: id, p_client: clientId } : { p_class: id });
        if (error) throw fail(error);
      },
    },
    answers: {
      async list() {
        const { data, error } = await db.from("coach_answers").select("id, question, answer").eq("coach_id", o.coachId).order("created_at").limit(100);
        if (error) throw fail(error);
        return data as CoachAnswer[];
      },
      async save(a) {
        check(answerProblem(a));
        const row = { question: a.question.trim(), answer: a.answer.trim() };
        const { error } = a.id ? await db.from("coach_answers").update(row).eq("id", a.id) : await db.from("coach_answers").insert({ ...row, coach_id: o.coachId });
        if (error) throw fail(error);
      },
      async remove(id) {
        const { error } = await db.from("coach_answers").delete().eq("id", id);
        if (error) throw fail(error);
      },
    },
    notes: {
      async list(clientId) {
        let q = db.from("session_notes").select("id, client_id, body, shared, session_label, created_at").order("created_at", { ascending: false }).limit(200);
        q = o.side === "client" ? q.eq("client_id", o.me).eq("shared", true) : q.eq("client_id", clientId).eq("coach_id", o.coachId);
        const { data, error } = await q;
        if (error) throw failNote(error);
        return (data as NoteRow[]).map(fromNote);
      },
      async add(n) {
        const row = { coach_id: o.coachId, client_id: n.clientId, body: cleanNote(n.body), shared: n.shared, session_label: n.session?.slice(0, 200) ?? null };
        const { data, error } = await db.from("session_notes").insert(row).select("id, client_id, body, shared, session_label, created_at").single();
        if (error || !data) throw failNote(error ?? { message: "The note wasn't saved" });
        return fromNote(data as NoteRow);
      },
      async setShared(id, shared) {
        const { error } = await db.from("session_notes").update({ shared }).eq("id", id);
        if (error) throw failNote(error);
      },
      async remove(id) {
        const { error } = await db.from("session_notes").delete().eq("id", id);
        if (error) throw failNote(error);
      },
    },
  };
}

/* ---------- Demo ---------- */

const KEY = "apex-extras-v1";
export const DEMO_CLIENT = { id: "demo-client", name: "Priya Sharma" };
interface DemoState { agreements: Agreement[]; signatures: Signature[]; classes: GroupClass[]; spots: Record<string, ClassSpot[]>; answers: CoachAnswer[]; notes?: SessionNote[] }
/** The demo client in the coach's list. The client app's demo is the same person, so shared notes show up there. */
const DEMO_NOTES_CLIENT = String(DEMO_CLIENT_ID);

function sample(now: Date): DemoState {
  const day = (d: number, h: number) => { const t = new Date(now); t.setDate(t.getDate() + d); t.setHours(h, 0, 0, 0); return t.toISOString(); };
  const spot = (clientId: string, name: string, status: ClassSpot["status"], ago: number): ClassSpot => ({ clientId, name, status, joinedAt: new Date(now.getTime() - ago * 3600e3).toISOString() });
  const { agreements } = sampleAgreements(now);
  // A few sample clients have signed already, so the coach's list shows both signed and waiting.
  const signed: [string, string, string, number][] = [["ag-1", "1", "Sarah Mitchell", 20], ["ag-2", "1", "Sarah Mitchell", 20], ["ag-1", "2", "James Kowalski", 14], ["ag-2", "2", "James Kowalski", 14], ["ag-1", "4", "Omar Tahir", 6]];
  const signatures: Signature[] = signed.map(([agreementId, clientId, name, d]) => {
    const a = agreements.find((x) => x.id === agreementId)!;
    return { id: `sig-${agreementId}-${clientId}`, agreementId, clientId, version: a.version, title: a.title, body: a.body, typedName: name, signedAt: new Date(now.getTime() - d * 864e5).toISOString() };
  });
  return {
    agreements,
    signatures,
    classes: [
      { id: "cl-1", title: "Saturday circuits", startsAt: day(2, 9), minutes: 45, capacity: 8, place: "Studio 2, Riverside Gym", note: "Bring water and a towel.", cancelled: false },
      { id: "cl-2", title: "Kettlebell basics", startsAt: day(3, 18), minutes: 40, capacity: 4, place: "Studio 1", note: "", cancelled: false },
      { id: "cl-3", title: "Mobility and stretch", startsAt: day(5, 7), minutes: 30, capacity: 12, place: "Online, link in the class note", note: "Camera optional.", cancelled: false },
    ],
    spots: {
      "cl-1": [spot("1", "Sarah Mitchell", "booked", 30), spot("2", "James Kowalski", "booked", 26), spot("3", "Lena Rossi", "booked", 20), spot("4", "Omar Tahir", "booked", 12), spot("6", "Marcus Webb", "booked", 8)],
      "cl-2": [spot("2", "James Kowalski", "booked", 40), spot("4", "Omar Tahir", "booked", 30), spot("6", "Marcus Webb", "booked", 22), spot("3", "Lena Rossi", "booked", 18), spot("1", "Sarah Mitchell", "waitlist", 6)],
      "cl-3": [spot("3", "Lena Rossi", "booked", 50)],
    },
    answers: ANSWER_STARTERS.map((a, i) => ({ ...a, id: `qa-${i}` })),
    notes: sampleSessionNotes(DEMO_NOTES_CLIENT, now),
  };
}

function demoStore() {
  const read = (): DemoState => {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as DemoState; } catch { /* sample */ }
    return sample(new Date());
  };
  const write = (s: DemoState) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* this visit only */ } };
  const update = (fn: (s: DemoState) => DemoState) => write(fn(read()));
  return { read, update };
}

export function demoExtras(side: "coach" | "client"): ExtrasApi {
  const st = demoStore();
  const me = DEMO_CLIENT.id;
  const view = (s: DemoState, c: GroupClass): ClassView => {
    const spots = s.spots[c.id] ?? [];
    const waiting = spots.filter((x) => x.status === "waitlist").sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
    const mine = spots.find((x) => x.clientId === me);
    return { ...c, booked: spots.filter((x) => x.status === "booked").length, waiting: waiting.length, myStatus: side === "client" ? mine?.status ?? null : null, myPlace: mine?.status === "waitlist" ? waiting.findIndex((x) => x.clientId === me) + 1 : null };
  };
  return {
    side,
    live: false,
    me,
    agreements: {
      list: async () => { const s = st.read(); return { agreements: s.agreements.filter((a) => side === "coach" || a.active), signatures: s.signatures }; },
      async save(a) {
        check(agreementProblem(a));
        st.update((s) => {
          if (!a.id) return { ...s, agreements: [...s.agreements, { id: crypto.randomUUID(), title: a.title.trim(), body: a.body.trim(), required: a.required, active: a.active, version: 1, updatedAt: new Date().toISOString() }] };
          return { ...s, agreements: s.agreements.map((x) => (x.id !== a.id ? x : { ...x, ...a, title: a.title.trim(), body: a.body.trim(), version: x.version + (x.title !== a.title.trim() || x.body !== a.body.trim() ? 1 : 0), updatedAt: new Date().toISOString() })) };
        });
      },
      async remove(id) { st.update((s) => ({ ...s, agreements: s.agreements.filter((a) => a.id !== id) })); },
      async sign(id, typedName) {
        st.update((s) => {
          const a = s.agreements.find((x) => x.id === id);
          if (!a || s.signatures.some((x) => x.agreementId === id && x.clientId === me && x.version === a.version)) return s;
          return { ...s, signatures: [{ id: crypto.randomUUID(), agreementId: id, clientId: me, version: a.version, title: a.title, body: a.body, typedName: typedName.trim(), signedAt: new Date().toISOString() }, ...s.signatures] };
        });
      },
    },
    classes: {
      list: async () => { const s = st.read(); return s.classes.filter((c) => Date.parse(c.startsAt) > Date.now() - 2 * 3600e3).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((c) => view(s, c)); },
      spots: async (id) => st.read().spots[id] ?? [],
      async save(c) {
        check(classProblem(c, new Date()));
        st.update((s) => {
          if (!c.id) return { ...s, classes: [...s.classes, { ...c, id: crypto.randomUUID(), cancelled: false }] };
          const next = { ...s, classes: s.classes.map((x) => (x.id === c.id ? { ...x, ...c, id: x.id } : x)) };
          // More room: the waitlist moves up, like the database does.
          return { ...next, spots: { ...next.spots, [c.id]: demoLeave(next.spots[c.id] ?? [], c.capacity, "") } };
        });
      },
      async cancel(id) { st.update((s) => ({ ...s, classes: s.classes.map((c) => (c.id === id ? { ...c, cancelled: true } : c)) })); },
      async join(id) {
        let status: "booked" | "waitlist" = "booked";
        st.update((s) => {
          const c = s.classes.find((x) => x.id === id);
          if (!c || c.cancelled) throw new Error("This class isn't open");
          const r = demoJoin(s.spots[id] ?? [], c.capacity, me, DEMO_CLIENT.name, new Date().toISOString());
          status = r.status;
          return { ...s, spots: { ...s.spots, [id]: r.spots } };
        });
        return status;
      },
      async leave(id, clientId) {
        st.update((s) => {
          const c = s.classes.find((x) => x.id === id);
          return c ? { ...s, spots: { ...s.spots, [id]: demoLeave(s.spots[id] ?? [], c.capacity, clientId ?? me) } } : s;
        });
      },
    },
    answers: {
      list: async () => st.read().answers,
      async save(a) {
        check(answerProblem(a));
        st.update((s) => ({ ...s, answers: a.id ? s.answers.map((x) => (x.id === a.id ? { id: x.id, question: a.question.trim(), answer: a.answer.trim() } : x)) : [...s.answers, { id: crypto.randomUUID(), question: a.question.trim(), answer: a.answer.trim() }] }));
      },
      async remove(id) { st.update((s) => ({ ...s, answers: s.answers.filter((x) => x.id !== id) })); },
    },
    notes: {
      async list(clientId) {
        const all = notesOf(st.read());
        const id = side === "client" ? DEMO_NOTES_CLIENT : clientId;
        return all.filter((n) => n.clientId === id && (side === "coach" || n.shared)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      async add(n) {
        const note: SessionNote = { id: crypto.randomUUID(), clientId: n.clientId, body: cleanNote(n.body), shared: n.shared, session: n.session, createdAt: new Date().toISOString() };
        st.update((s) => ({ ...s, notes: [note, ...notesOf(s)] }));
        return note;
      },
      async setShared(id, shared) { st.update((s) => ({ ...s, notes: notesOf(s).map((n) => (n.id === id ? { ...n, shared } : n)) })); },
      async remove(id) { st.update((s) => ({ ...s, notes: notesOf(s).filter((n) => n.id !== id) })); },
    },
  };
}

/** Browsers that saved the demo before session notes existed get the samples too. */
const notesOf = (s: DemoState): SessionNote[] => s.notes ?? sampleSessionNotes(DEMO_NOTES_CLIENT, new Date());

const Ctx = createContext<ExtrasApi | null>(null);
export function ExtrasProvider({ value, children }: { value: ExtrasApi | null; children: ReactNode }) {
  return createElement(Ctx.Provider, { value }, children);
}
export const useExtras = () => useContext(Ctx);
