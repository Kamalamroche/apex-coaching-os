import { fromFormCheckRow, toFormCheckRow, videoPath, videoProblem, type FormCheckRow, type FormCheckState, type FormCheckStore } from "@apex/core";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export const VIDEO_BUCKET = "form-videos";
/** Signed video links last an hour; every reload makes fresh ones. */
const LINK_SECONDS = 3600;
const isMissingTable = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";

export interface LiveFormCheckStore extends FormCheckStore {
  close(): void;
}

/** FormCheckStore backed by the form_checks table and the private form-videos bucket, kept live with Realtime. */
export function createSupabaseFormChecks(db: SupabaseClient, clientId: string): LiveFormCheckStore {
  let state: FormCheckState = { checks: [], status: "loading" };
  let channel: RealtimeChannel | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;
  const listeners = new Set<() => void>();
  const set = (next: Partial<FormCheckState>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  const fail = (e: unknown) => {
    if (isMissingTable(e as { code?: string })) return set({ status: "needs-update" });
    set({ status: "error", error: e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e) });
  };

  async function load() {
    const mine = ++seq;
    const { data, error } = await db.from("form_checks").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(50).returns<FormCheckRow[]>();
    if (error) return fail(error);
    const rows = data ?? [];
    const urls = new Map<string, string>();
    if (rows.length) {
      const { data: signed } = await db.storage.from(VIDEO_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), LINK_SECONDS);
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    }
    if (mine !== seq) return;
    set({ checks: rows.map((r) => fromFormCheckRow(r, urls.get(r.storage_path) ?? null)), status: "ready", error: undefined });
  }

  function open() {
    if (channel) return;
    channel = db
      .channel(`apex-form-${clientId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "form_checks", filter: `client_id=eq.${clientId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => void load().catch(fail), 250);
      })
      .subscribe();
  }

  void load().catch(fail);

  return {
    get: () => state,
    subscribe(l) {
      listeners.add(l);
      open();
      return () => {
        listeners.delete(l);
        if (!listeners.size && channel) { void db.removeChannel(channel); channel = null; }
      };
    },
    async submit(u) {
      const problem = videoProblem({ size: u.file.size, type: u.file.type });
      if (problem) throw new Error(problem);
      const id = crypto.randomUUID();
      const path = videoPath(clientId, id, u.file.type);
      const up = await db.storage.from(VIDEO_BUCKET).upload(path, u.file, { contentType: u.file.type, upsert: false });
      if (up.error) throw new Error(/bucket not found/i.test(up.error.message) ? "Video form checks aren't switched on yet. Ask your coach to finish the latest update." : `Couldn't upload the video: ${up.error.message}`);
      const { error } = await db.from("form_checks").insert(toFormCheckRow(u, clientId, id, path));
      if (error) {
        await db.storage.from(VIDEO_BUCKET).remove([path]);
        throw new Error(isMissingTable(error) ? "Video form checks aren't switched on yet. Ask your coach to finish the latest update." : error.message);
      }
      await load();
    },
    async reply(id, text) {
      const { data, error } = await db.from("form_checks").update({ coach_reply: text.trim() || null, reviewed_at: new Date().toISOString() }).eq("id", id).select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("Couldn't save the reply. Reload and try again.");
      await load();
    },
    async remove(id) {
      const c = state.checks.find((x) => x.id === id);
      const { error } = await db.from("form_checks").delete().eq("id", id);
      if (error) throw new Error(error.message);
      if (c) await db.storage.from(VIDEO_BUCKET).remove([c.path]);
      set({ checks: state.checks.filter((x) => x.id !== id) });
    },
    close() {
      clearTimeout(timer);
      if (channel) void db.removeChannel(channel);
      channel = null;
      listeners.clear();
    },
  };
}
