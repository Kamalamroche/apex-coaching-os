import { cleanTags, fromNoteRow, noteProblem, sampleNotes, type ClientNote, type ClientNoteRow } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

/** Private coach notes and tags on clients. Coach only. */
export interface NotesApi {
  tags(): Promise<Record<string, string[]>>;
  setTags(clientId: string, tags: string[]): Promise<void>;
  notes(clientId: string): Promise<ClientNote[]>;
  add(clientId: string, body: string): Promise<void>;
  pin(id: string, pinned: boolean): Promise<void>;
  remove(id: string): Promise<void>;
}

const isMissing = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";
export const NOTES_NEED_UPDATE = "needs-update";
const err = (e: { code?: string; message: string }) => (isMissing(e) ? new Error(NOTES_NEED_UPDATE) : new Error(e.message));

export function liveNotes(db: SupabaseClient, coachId: string): NotesApi {
  return {
    async tags() {
      const { data, error } = await db.from("coach_client_tags").select("client_id, tags").eq("coach_id", coachId);
      if (error) throw err(error);
      return Object.fromEntries((data ?? []).map((r) => [r.client_id as string, (r.tags as string[]) ?? []]));
    },
    async setTags(clientId, tags) {
      const { error } = await db.from("coach_client_tags").upsert({ coach_id: coachId, client_id: clientId, tags: cleanTags(tags) });
      if (error) throw err(error);
    },
    async notes(clientId) {
      const { data, error } = await db.from("coach_client_notes").select("*").eq("coach_id", coachId).eq("client_id", clientId).order("created_at", { ascending: false }).limit(200).returns<ClientNoteRow[]>();
      if (error) throw err(error);
      return (data ?? []).map(fromNoteRow);
    },
    async add(clientId, body) {
      const problem = noteProblem(body);
      if (problem) throw new Error(problem);
      const { error } = await db.from("coach_client_notes").insert({ coach_id: coachId, client_id: clientId, body: body.trim() });
      if (error) throw err(error);
    },
    async pin(id, pinned) {
      const { error } = await db.from("coach_client_notes").update({ pinned }).eq("id", id);
      if (error) throw err(error);
    },
    async remove(id) {
      const { error } = await db.from("coach_client_notes").delete().eq("id", id);
      if (error) throw err(error);
    },
  };
}

const KEY = "apex-client-notes-v1";
type DemoState = { notes: ClientNote[]; tags: Record<string, string[]> };

export function demoNotes(): NotesApi {
  const read = (): DemoState => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as DemoState;
    } catch { /* sample */ }
    return sampleNotes();
  };
  const write = (v: DemoState) => {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* this visit only */ }
  };
  const update = (fn: (s: DemoState) => DemoState) => write(fn(read()));
  return {
    async tags() { return read().tags; },
    async setTags(clientId, tags) { update((s) => ({ ...s, tags: { ...s.tags, [clientId]: cleanTags(tags) } })); },
    async notes(clientId) { return read().notes.filter((n) => n.clientId === clientId); },
    async add(clientId, body) {
      const problem = noteProblem(body);
      if (problem) throw new Error(problem);
      update((s) => ({ ...s, notes: [{ id: crypto.randomUUID(), clientId, body: body.trim(), pinned: false, createdAt: new Date().toISOString() }, ...s.notes] }));
    },
    async pin(id, pinned) { update((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, pinned } : n)) })); },
    async remove(id) { update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) })); },
  };
}

const Ctx = createContext<NotesApi | null>(null);
export const NotesProvider = Ctx.Provider;
export const useNotesApi = (): NotesApi | null => useContext(Ctx);
