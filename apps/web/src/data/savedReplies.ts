import { MAX_REPLIES, REPLY_IDEAS, replyProblem, type SavedReply } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The coach's saved chat replies. Demo: this browser. Live: saved_replies. */
export interface RepliesApi {
  list(): Promise<SavedReply[]>;
  add(r: Omit<SavedReply, "id">): Promise<SavedReply>;
  update(r: SavedReply): Promise<void>;
  remove(id: string): Promise<void>;
}

const isMissingTable = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";
const NEEDS_SQL = "Saved replies need the latest database update (20261120090000_business_chat_tools.sql)";
const check = (r: { title: string; body: string }) => {
  const p = replyProblem(r);
  if (p) throw new Error(p);
  return { title: r.title.trim(), body: r.body.trim() };
};

export function liveReplies(db: SupabaseClient, coachId: string): RepliesApi {
  const fail = (e: { code?: string; message: string }) => new Error(isMissingTable(e) ? NEEDS_SQL : e.message);
  return {
    async list() {
      const { data, error } = await db.from("saved_replies").select("id, title, body").eq("coach_id", coachId).order("created_at").limit(MAX_REPLIES);
      if (error) throw fail(error);
      return (data ?? []) as SavedReply[];
    },
    async add(r) {
      const { data, error } = await db.from("saved_replies").insert({ coach_id: coachId, ...check(r) }).select("id, title, body").single();
      if (error) throw fail(error);
      return data as SavedReply;
    },
    async update(r) {
      const { error } = await db.from("saved_replies").update(check(r)).eq("id", r.id).eq("coach_id", coachId);
      if (error) throw fail(error);
    },
    async remove(id) {
      const { error } = await db.from("saved_replies").delete().eq("id", id).eq("coach_id", coachId);
      if (error) throw fail(error);
    },
  };
}

const KEY = "apex.savedReplies";
export function demoReplies(): RepliesApi {
  const read = (): SavedReply[] => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as SavedReply[];
    } catch { /* fall through to the starters */ }
    return REPLY_IDEAS.slice(0, 3).map((r, i) => ({ ...r, id: `demo-${i}` }));
  };
  const write = (list: SavedReply[]) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* the demo still works without saving */ } };
  return {
    list: async () => read(),
    async add(r) {
      const list = read();
      if (list.length >= MAX_REPLIES) throw new Error(`Up to ${MAX_REPLIES} saved replies`);
      const item = { id: crypto.randomUUID(), ...check(r) };
      write([...list, item]);
      return item;
    },
    async update(r) { write(read().map((x) => (x.id === r.id ? { id: r.id, ...check(r) } : x))); },
    async remove(id) { write(read().filter((x) => x.id !== id)); },
  };
}
