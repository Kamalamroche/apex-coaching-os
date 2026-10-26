import {
  INITIAL_WORKOUT, bestKgByExercise, latestSetByExercise, nextHistory, toItemRows, toLoggedSetRows, toMessages, toPreviousSession, toSessionLog, toWorkout,
  type ApexState, type ApexStore, type LoggedSetRow, type MessageRow, type PreviousSessionRow, type SessionRow, type Workout, type WorkoutItemRow, type WorkoutRow,
} from "@apex/core";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";


export interface LiveStore extends ApexStore {
  status(): "loading" | "ready" | "no-program" | "error";
  error(): string | null;
  /** Coach only: create the client's first program from the starter template. */
  createProgram(): Promise<void>;
  close(): void;
}

interface Ids {
  coachId: string;
  clientId: string;
  /** Who is signed in. Decides which side of the thread a message comes from. */
  me: string;
}

const SAVE_DELAY_MS = 400;
/** Ignore realtime echoes this long after a local edit so they can't overwrite typing. */
const ECHO_GUARD_MS = 1500;

const empty = (): ApexState => ({ workout: { ...INITIAL_WORKOUT, items: [] }, log: null, messages: [], history: { bestKg: {}, previous: null } });

/** Postgres "undefined column" (select) and PostgREST "column not in schema cache" (insert). */
const isMissingColumn = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST204";

/** ApexStore backed by Supabase. Loads the client's latest published program and keeps it live. */
export function createSupabaseStore(db: SupabaseClient, ids: Ids): LiveStore {
  let state = empty();
  let status: ReturnType<LiveStore["status"]> = "loading";
  let error: string | null = null;
  let workoutId: string | null = null;
  let savedKeys = new Set<string>();
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let lastLocalEdit = 0;
  let channel: RealtimeChannel | null = null;
  let loadSeq = 0;
  // False until the session_summary migration has run on this database; then we save without it.
  let hasSummaryColumn = true;
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const fail = (e: unknown) => {
    error = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
    status = "error";
    emit();
  };

  async function load() {
    // Realtime can fire several reloads at once; only the newest one may write the state.
    const seq = ++loadSeq;
    const stale = () => seq !== loadSeq;
    try {
      const { data: program, error: pErr } = await db.from("programs").select("id, weeks").eq("client_id", ids.clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (pErr) throw pErr;
      const messages = await loadMessages();
      if (stale()) return;
      if (!program) {
        status = "no-program";
        state = { ...empty(), messages };
        emit();
        return;
      }
      const { data: version, error: vErr } = await db.from("program_versions").select("id").eq("program_id", program.id).order("version", { ascending: false }).limit(1).maybeSingle();
      if (vErr) throw vErr;
      if (!version) throw new Error("This program has no published version yet");
      const { data: workout, error: wErr } = await db.from("workouts").select("id, name, week, est_minutes").eq("program_version_id", version.id).order("week").order("day_index").limit(1).maybeSingle<WorkoutRow>();
      if (wErr) throw wErr;
      if (!workout) throw new Error("This program has no workouts yet");
      workoutId = workout.id;

      const sessionCols = `id, started_at, finished_at, session_rpe, sets_completed, volume_kg, prs, note${hasSummaryColumn ? ", summary" : ""}`;
      const [{ data: items, error: iErr }, { data: recent, error: rErr }, { data: session, error: sErr }, { data: previous, error: lErr }] = await Promise.all([
        db.from("workout_items").select("*").eq("workout_id", workout.id).returns<WorkoutItemRow[]>(),
        db.from("logged_sets").select("exercise_id, load_kg, reps, seconds, rpe, sessions!inner(client_id)").eq("sessions.client_id", ids.clientId).order("completed_at", { ascending: false }).limit(300),
        db.from("sessions").select(sessionCols).eq("client_id", ids.clientId).eq("workout_id", workout.id).not("finished_at", "is", null).gte("finished_at", startOfToday()).order("finished_at", { ascending: false }).limit(1).maybeSingle<SessionRow>(),
        db.from("sessions").select("started_at, finished_at, sets_completed, volume_kg, workouts(name)").eq("client_id", ids.clientId).not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(1).maybeSingle<PreviousSessionRow>(),
      ]);
      if (iErr) throw iErr;
      if (rErr) throw rErr;
      if (sErr && isMissingColumn(sErr) && hasSummaryColumn) {
        hasSummaryColumn = false;
        return void (await load());
      }
      if (sErr) throw sErr;
      if (lErr) throw lErr;

      if (stale()) return;
      const recentSets = (recent ?? []) as unknown as Pick<LoggedSetRow, "exercise_id" | "load_kg" | "reps" | "seconds" | "rpe">[];
      const last = latestSetByExercise(recentSets);
      const w = toWorkout(workout, items ?? [], program.weeks, last);
      savedKeys = new Set(w.items.map((i) => i.key));
      state = {
        workout: w,
        log: session ? toSessionLog(session, w.name) : null,
        messages,
        history: { bestKg: bestKgByExercise(recentSets), previous: previous ? toPreviousSession(previous) : null },
      };
      status = "ready";
      error = null;
      emit();
      if (listeners.size) openChannel();
    } catch (e) {
      fail(e);
    }
  }

  async function loadMessages() {
    const { data, error: mErr } = await db.from("messages").select("sender_id, body, created_at").eq("coach_id", ids.coachId).eq("client_id", ids.clientId).order("created_at").returns<MessageRow[]>();
    if (mErr) throw mErr;
    return toMessages(data ?? [], ids.coachId);
  }

  // The realtime channel lives while someone is listening. Tying it to listeners (rather than to
  // React effects) keeps it alive through StrictMode's mount/unmount/mount in development.
  function openChannel() {
    clearTimeout(closeTimer);
    if (channel || !workoutId) return;
    const reload = () => {
      if (Date.now() - lastLocalEdit < ECHO_GUARD_MS) return;
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => void load(), 250);
    };
    channel = db
      .channel(`apex-${ids.clientId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workout_items", filter: `workout_id=eq.${workoutId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `client_id=eq.${ids.clientId}` }, reload)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `client_id=eq.${ids.clientId}` }, async () => {
        try { state = { ...state, messages: await loadMessages() }; emit(); } catch (e) { fail(e); }
      })
      // Catch anything that changed between the first load and the channel going live.
      .subscribe((s) => { if (s === "SUBSCRIBED") void load(); });
  }

  function closeChannel() {
    if (channel) void db.removeChannel(channel);
    channel = null;
  }

  async function persistWorkout(w: Workout) {
    if (!workoutId) return;
    const rows = toItemRows(w, workoutId);
    const removed = [...savedKeys].filter((k) => !w.items.some((i) => i.key === k));
    // Positions are unique per workout, so park the old rows out of the way before rewriting the order.
    if (rows.length) {
      const { error: e1 } = await db.from("workout_items").upsert(rows.map((r) => ({ ...r, position: r.position + 1000 })));
      if (e1) throw e1;
    }
    if (removed.length) {
      const { error: e2 } = await db.from("workout_items").delete().in("id", removed);
      if (e2) throw e2;
    }
    if (rows.length) {
      const { error: e3 } = await db.from("workout_items").upsert(rows);
      if (e3) throw e3;
    }
    const { error: e4 } = await db.from("workouts").update({ est_minutes: w.minutes, name: w.name }).eq("id", workoutId);
    if (e4) throw e4;
    savedKeys = new Set(w.items.map((i) => i.key));
  }

  void load();

  return {
    get: () => state,
    status: () => status,
    error: () => error,
    subscribe(listener) {
      listeners.add(listener);
      openChannel();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          clearTimeout(closeTimer);
          closeTimer = setTimeout(closeChannel, 1000);
        }
      };
    },
    saveWorkout(workout) {
      state = { ...state, workout };
      lastLocalEdit = Date.now();
      emit();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { lastLocalEdit = Date.now(); persistWorkout(state.workout).catch(fail); }, SAVE_DELAY_MS);
    },
    finishSession(log, sets) {
      state = { ...state, log, history: nextHistory(state.history, log, state.workout, sets) };
      emit();
      void (async () => {
        const startedAt = new Date(Date.now() - log.minutes * 60000).toISOString();
        const row: Record<string, unknown> = {
          client_id: ids.clientId, workout_id: workoutId, started_at: startedAt, finished_at: new Date().toISOString(),
          session_rpe: log.rpe, sets_completed: log.sets, volume_kg: log.volumeKg, prs: log.prs, note: log.note ?? null,
        };
        const insert = (withSummary: boolean) =>
          db.from("sessions").insert(withSummary ? { ...row, summary: log.summary ?? null } : row).select("id").single();
        let { data, error: e1 } = await insert(hasSummaryColumn);
        if (e1 && isMissingColumn(e1) && hasSummaryColumn) {
          hasSummaryColumn = false;
          ({ data, error: e1 } = await insert(false));
        }
        if (e1 || !data) throw e1 ?? new Error("The session wasn't saved");
        const rows = toLoggedSetRows(sets, state.workout, data.id);
        if (rows.length) {
          const { error: e2 } = await db.from("logged_sets").insert(rows);
          if (e2) throw e2;
        }
      })().catch(fail);
    },
    sendMessage(from, text) {
      state = { ...state, messages: [...state.messages, { from, text, time: "Now" }] };
      emit();
      void db.from("messages").insert({ coach_id: ids.coachId, client_id: ids.clientId, sender_id: ids.me, body: text }).then(({ error: e }) => { if (e) fail(e); });
    },
    async createProgram() {
      try {
        const { data: program, error: e1 } = await db.from("programs").insert({ coach_id: ids.coachId, client_id: ids.clientId, name: "Foundations", weeks: INITIAL_WORKOUT.ofWeeks }).select("id").single();
        if (e1) throw e1;
        const { data: version, error: e2 } = await db.from("program_versions").insert({ program_id: program.id, version: 1, published_at: new Date().toISOString(), published_by: ids.me }).select("id").single();
        if (e2) throw e2;
        const { data: workout, error: e3 } = await db.from("workouts").insert({ program_version_id: version.id, name: INITIAL_WORKOUT.name, week: 1, day_index: 0, est_minutes: INITIAL_WORKOUT.minutes }).select("id").single();
        if (e3) throw e3;
        const template: Workout = { ...INITIAL_WORKOUT, items: INITIAL_WORKOUT.items.map((i) => ({ ...i, key: crypto.randomUUID() })) };
        const { error: e4 } = await db.from("workout_items").insert(toItemRows(template, workout.id));
        if (e4) throw e4;
        await load();
      } catch (e) {
        fail(e);
      }
    },
    reset() {
      /* live data is never reset from the app */
    },
    close() {
      clearTimeout(saveTimer);
      clearTimeout(reloadTimer);
      closeChannel();
    },
  };
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
