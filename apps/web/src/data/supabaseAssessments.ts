import { answerForRow, assessmentFileProblem, assessmentPath, fromAssessmentRow, mediaKindOf, submitProblem, type AssessmentRow, type AssessmentState, type AssessmentStore, type ClientAnswer } from "@apex/core";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export const ASSESSMENT_BUCKET = "assessments";
/** Signed links last an hour; every reload makes fresh ones. */
const LINK_SECONDS = 3600;
const isMissingTable = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";
const NOT_ON = "Assessments aren't switched on yet. Ask your coach to finish the latest update.";

export interface LiveAssessmentStore extends AssessmentStore {
  close(): void;
}

/** AssessmentStore backed by the assessments table and the private assessments bucket, kept live with Realtime. */
export function createSupabaseAssessments(db: SupabaseClient, clientId: string): LiveAssessmentStore {
  let state: AssessmentState = { list: [], status: "loading" };
  let rows: AssessmentRow[] = [];
  let channel: RealtimeChannel | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;
  const listeners = new Set<() => void>();
  const set = (next: Partial<AssessmentState>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  const fail = (e: unknown) => {
    if (isMissingTable(e as { code?: string })) return set({ status: "needs-update" });
    set({ status: "error", error: e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e) });
  };

  async function load() {
    const mine = ++seq;
    const { data, error } = await db.from("assessments").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(30).returns<AssessmentRow[]>();
    if (error) return fail(error);
    const got = data ?? [];
    const paths = got.flatMap((r) => Object.values(r.answers ?? {}).map((a) => a?.media?.path).filter((p): p is string => !!p));
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await db.storage.from(ASSESSMENT_BUCKET).createSignedUrls(paths, LINK_SECONDS);
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    }
    if (mine !== seq) return;
    rows = got;
    set({ list: got.map((r) => fromAssessmentRow(r, urls)), status: "ready", error: undefined });
  }

  function open() {
    if (channel) return;
    channel = db
      .channel(`apex-assess-${clientId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assessments", filter: `client_id=eq.${clientId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => void load().catch(fail), 250);
      })
      .subscribe();
  }

  const changed = async (q: PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }>, what: string) => {
    const { data, error } = await q;
    if (error) throw new Error(isMissingTable(error) ? NOT_ON : error.message);
    if (!data?.length) throw new Error(`Couldn't ${what}. Reload and try again.`);
    await load();
  };

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
    async request(r) {
      const { error } = await db.from("assessments").insert({ client_id: clientId, title: r.title.slice(0, 80), tests: r.tests, retest_weeks: r.retestWeeks });
      if (error) throw new Error(isMissingTable(error) ? NOT_ON : error.message);
      await load();
    },
    async saveAnswer(id, key, answer, file) {
      const row = rows.find((r) => r.id === id);
      if (!row) throw new Error("Couldn't find that assessment. Reload and try again.");
      const old = row.answers?.[key];
      let media: ClientAnswer["media"] = old?.media ?? null;
      if (file) {
        const kind = mediaKindOf(file.type);
        const problem = assessmentFileProblem({ size: file.size, type: file.type }, kind);
        if (problem) throw new Error(problem);
        const path = assessmentPath(clientId, id, key, file.type);
        const up = await db.storage.from(ASSESSMENT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw new Error(/bucket not found/i.test(up.error.message) ? NOT_ON : `Couldn't upload: ${up.error.message}`);
        media = { path, kind, url: null };
      }
      const answers = { ...(row.answers ?? {}), [key]: answerForRow({ ...answer, media }) };
      await changed(db.from("assessments").update({ answers }).eq("id", id).select("id"), "save that test");
      // The replaced photo or video is no longer needed.
      if (file && old?.media?.path) await db.storage.from(ASSESSMENT_BUCKET).remove([old.media.path]);
    },
    async submit(id) {
      const a = state.list.find((x) => x.id === id);
      const problem = a && submitProblem(a);
      if (problem) throw new Error(problem);
      await changed(db.from("assessments").update({ status: "submitted" }).eq("id", id).select("id"), "send it");
    },
    async review(id, r) {
      const row = rows.find((x) => x.id === id);
      const review = { ...(row?.review ?? {}), ...r.reviews };
      await changed(db.from("assessments").update({ review, summary: r.summary.trim() || null, focus: r.focus, ...(r.done ? { status: "reviewed" } : {}) }).eq("id", id).select("id"), "save the review");
    },
    async remove(id) {
      const { error } = await db.from("assessments").delete().eq("id", id).eq("status", "requested");
      if (error) throw new Error(error.message);
      set({ list: state.list.filter((x) => x.id !== id || x.status !== "requested") });
    },
    close() {
      clearTimeout(timer);
      if (channel) void db.removeChannel(channel);
      channel = null;
      listeners.clear();
    },
  };
}
