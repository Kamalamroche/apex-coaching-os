import {
  INITIAL_WORKOUT, bestKgByExercise, latestSetByExercise, newKey, nextDayKey, nextHistory, programFromWorkout, stateForWorkout, toItemRows, toLoggedSetRows, toMessages,
  toPreviousSession, toSessionLog, toWorkout, trendFromSets, withDayWorkout, withProgram,
  type ApexState, type ApexStore, type LoggedSetRow, type MessageRow, type PreviousSessionRow, type Program, type ProgramDay, type ReadinessPoint, type SessionRow, type Workout,
  type WorkoutItemRow, type WorkoutRow,
} from "@apex/core";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";


export interface LiveStore extends ApexStore {
  status(): "loading" | "ready" | "no-program" | "error";
  error(): string | null;
  /** Coach only: create the client's first program from the starter template. */
  createProgram(): Promise<void>;
  /** True once the program-builder migration (per-set targets, circuits) is in the database. */
  hasPlanColumns(): boolean;
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

const empty = (): ApexState => stateForWorkout({ ...INITIAL_WORKOUT, items: [] }, { log: null, messages: [], history: { bestKg: {}, previous: null } });

interface DayRow extends WorkoutRow {
  day_index: number;
}

/** The new columns from the program-builder migration. Stripped when the database doesn't have them yet. */
const PLAN_COLUMNS = ["set_plan", "block_style"] as const;
const withoutPlan = (rows: WorkoutItemRow[]) => rows.map(({ set_plan: _p, block_style: _b, ...r }) => r);

/** Postgres "undefined column" (select) and PostgREST "column not in schema cache" (insert). */
const isMissingColumn = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST204";

/** ApexStore backed by Supabase. Loads the client's latest published program and keeps it live. */
export function createSupabaseStore(db: SupabaseClient, ids: Ids): LiveStore {
  let state = empty();
  let status: ReturnType<LiveStore["status"]> = "loading";
  let error: string | null = null;
  let workoutId: string | null = null;
  let programId: string | null = null;
  let versionId: string | null = null;
  /** Day the coach opened; the client always gets the next day to train. */
  let chosenDay: string | null = null;
  let savedKeys = new Set<string>();
  let savedDays = new Set<string>();
  let hasPlanColumns = true;
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
      const { data: program, error: pErr } = await db.from("programs").select("id, name, weeks").eq("client_id", ids.clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (pErr) throw pErr;
      const messages = await loadMessages();
      if (stale()) return;
      if (!program) {
        status = "no-program";
        state = { ...empty(), messages };
        emit();
        return;
      }
      programId = program.id;
      const { data: version, error: vErr } = await db.from("program_versions").select("id").eq("program_id", program.id).order("version", { ascending: false }).limit(1).maybeSingle();
      if (vErr) throw vErr;
      if (!version) throw new Error("This program has no published version yet");
      versionId = version.id;
      const { data: dayRows, error: wErr } = await db.from("workouts").select("id, name, week, day_index, est_minutes").eq("program_version_id", version.id).order("week").order("day_index").returns<DayRow[]>();
      if (wErr) throw wErr;
      if (!dayRows?.length) throw new Error("This program has no workouts yet");
      const dayIds = dayRows.map((d) => d.id);

      const [{ data: items, error: iErr }, { data: recent, error: rErr }, { data: finished, error: fErr }, { data: previous, error: lErr }] = await Promise.all([
        db.from("workout_items").select("*").in("workout_id", dayIds).returns<WorkoutItemRow[]>(),
        db.from("logged_sets").select("session_id, exercise_id, load_kg, reps, seconds, rpe, sessions!inner(client_id)").eq("sessions.client_id", ids.clientId).order("completed_at", { ascending: false }).limit(300),
        db.from("sessions").select("workout_id, finished_at").eq("client_id", ids.clientId).in("workout_id", dayIds).not("finished_at", "is", null).order("finished_at", { ascending: false }).returns<{ workout_id: string; finished_at: string }[]>(),
        db.from("sessions").select("started_at, finished_at, sets_completed, volume_kg, workouts(name)").eq("client_id", ids.clientId).not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(1).maybeSingle<PreviousSessionRow>(),
      ]);
      if (iErr) throw iErr;
      if (rErr) throw rErr;
      if (fErr) throw fErr;
      if (lErr) throw lErr;
      if (stale()) return;

      const recentSets = (recent ?? []) as unknown as Pick<LoggedSetRow, "session_id" | "exercise_id" | "load_kg" | "reps" | "seconds" | "rpe">[];
      // Sessions where the client chose the lighter version after the readiness check: left out of plateau alerts.
      // Readiness from recent sessions: the trend on the readiness screen, and lighter days to leave out of plateau alerts.
      const lighter = new Set<string>();
      const readiness: ReadinessPoint[] = [];
      if (hasSummaryColumn) {
        const { data: rows } = await db.from("sessions").select("id, started_at, readiness:summary->readiness").eq("client_id", ids.clientId).not("summary->readiness", "is", null).order("started_at", { ascending: false }).limit(100);
        for (const row of (rows ?? []) as { id: string; started_at: string; readiness: { score?: number; adjusted?: boolean } | null }[]) {
          if (row.readiness?.adjusted) lighter.add(row.id);
          if (typeof row.readiness?.score === "number" && readiness.length < 14) readiness.unshift({ at: row.started_at, score: row.readiness.score });
        }
        if (stale()) return;
      }
      const last = latestSetByExercise(recentSets);
      const days: ProgramDay[] = dayRows.map((d) => ({ ...toWorkout(d, (items ?? []).filter((i) => i.workout_id === d.id), program.weeks, last), key: d.id, dayIndex: d.day_index }));
      const plan: Program = { name: program.name, weeks: program.weeks, days };
      const today = startOfToday();
      const doneToday = (finished ?? []).find((f) => f.finished_at >= today)?.workout_id ?? null;
      const coach = ids.me !== ids.clientId;
      const active = (coach && chosenDay && dayIds.includes(chosenDay) ? chosenDay : null) ?? nextDayKey(plan, new Set((finished ?? []).map((f) => f.workout_id)), doneToday);
      workoutId = active;

      const sessionCols = `id, started_at, finished_at, session_rpe, sets_completed, volume_kg, prs, note${hasSummaryColumn ? ", summary" : ""}`;
      const { data: session, error: sErr } = await db.from("sessions").select(sessionCols).eq("client_id", ids.clientId).eq("workout_id", active ?? "").not("finished_at", "is", null).gte("finished_at", today).order("finished_at", { ascending: false }).limit(1).maybeSingle<SessionRow>();
      if (sErr && isMissingColumn(sErr) && hasSummaryColumn) {
        hasSummaryColumn = false;
        return void (await load());
      }
      if (sErr) throw sErr;
      hasPlanColumns = !(items ?? []).length || PLAN_COLUMNS.every((c) => c in (items?.[0] ?? {}));
      if (stale()) return;
      const next = withProgram({ ...state, messages, history: { bestKg: bestKgByExercise(recentSets), previous: previous ? toPreviousSession(previous) : null, trend: trendFromSets(recentSets, lighter), readiness } }, plan, active ?? undefined);
      savedKeys = new Set(next.workout.items.map((i) => i.key));
      savedDays = new Set(dayIds);
      state = { ...next, log: session ? toSessionLog(session, next.workout.name) : null };
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
      .on("postgres_changes", { event: "*", schema: "public", table: "workouts", filter: `program_version_id=eq.${versionId}` }, reload)
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

  /** Writes item rows, dropping the per-set and circuit columns if the migration hasn't run yet. */
  async function upsertItems(rows: WorkoutItemRow[]) {
    const send = hasPlanColumns ? rows : withoutPlan(rows);
    const { error: e } = await db.from("workout_items").upsert(send);
    if (e && isMissingColumn(e) && hasPlanColumns) {
      hasPlanColumns = false;
      emit();
      return upsertItems(rows);
    }
    if (e) throw e;
  }

  /** Saves one day's items. Takes the day's id and saved keys up front, so a day switch mid-save can't mix them up. */
  async function persistWorkout(w: Workout, id = workoutId, saved = savedKeys) {
    if (!id) return;
    const rows = toItemRows(w, id);
    const removed = [...saved].filter((k) => !w.items.some((i) => i.key === k));
    // Positions are unique per workout, so park the old rows out of the way before rewriting the order.
    if (rows.length) await upsertItems(rows.map((r) => ({ ...r, position: r.position + 1000 })));
    if (removed.length) {
      const { error: e2 } = await db.from("workout_items").delete().in("id", removed);
      if (e2) throw e2;
    }
    if (rows.length) await upsertItems(rows);
    const { error: e4 } = await db.from("workouts").update({ est_minutes: w.minutes, name: w.name }).eq("id", id);
    if (e4) throw e4;
    if (id === workoutId) savedKeys = new Set(w.items.map((i) => i.key));
  }


  /** Adds, removes and re-dates days. Items of days that already exist are saved by persistWorkout. */
  async function persistProgram(before: Program, after: Program) {
    if (!versionId || !programId) return;
    const removed = before.days.filter((d) => !after.days.some((a) => a.key === d.key)).map((d) => d.key).filter((k) => savedDays.has(k));
    const added = after.days.filter((d) => !savedDays.has(d.key));
    const moved = after.days.filter((d) => {
      const b = before.days.find((x) => x.key === d.key);
      return b && savedDays.has(d.key) && (b.week !== d.week || b.dayIndex !== d.dayIndex || b.name !== d.name || b.minutes !== d.minutes);
    });
    if (removed.length) {
      const { error: e } = await db.from("workouts").delete().in("id", removed);
      if (e) throw e;
    }
    if (added.length) {
      const { error: e } = await db.from("workouts").insert(added.map((d) => dayRow(d, versionId as string)));
      if (e) throw e;
      const rows = added.flatMap((d) => toItemRows(d, d.key));
      if (rows.length) await upsertItems(rows);
    }
    for (const d of moved) {
      const { error: e } = await db.from("workouts").update({ name: d.name, week: d.week, day_index: d.dayIndex, est_minutes: d.minutes }).eq("id", d.key);
      if (e) throw e;
    }
    if (before.weeks !== after.weeks || before.name !== after.name) {
      const { error: e } = await db.from("programs").update({ weeks: after.weeks, name: after.name }).eq("id", programId);
      if (e) throw e;
    }
    savedDays = new Set(after.days.map((d) => d.key));
  }

  void load();

  return {
    get: () => state,
    status: () => status,
    error: () => error,
    hasPlanColumns: () => hasPlanColumns,
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
      state = { ...state, workout, program: withDayWorkout(state.program, state.activeDay, workout) };
      lastLocalEdit = Date.now();
      emit();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { lastLocalEdit = Date.now(); persistWorkout(state.workout).catch(fail); }, SAVE_DELAY_MS);
    },
    selectDay(key) {
      if (key === state.activeDay) return;
      clearTimeout(saveTimer);
      // Save what was typed on the day being left before switching.
      const leaving = state.workout;
      const pending = workoutId ? persistWorkout(leaving) : Promise.resolve();
      chosenDay = key;
      state = withProgram({ ...state, log: null }, state.program, key);
      workoutId = state.activeDay;
      savedKeys = new Set(state.workout.items.map((i) => i.key));
      emit();
      closeChannel();
      void pending.then(() => load()).catch(fail);
    },
    saveProgram(program, activeDay) {
      const before = state.program;
      const switching = activeDay !== undefined && activeDay !== state.activeDay;
      if (switching) chosenDay = activeDay;
      state = withProgram(state, program, activeDay);
      workoutId = state.activeDay;
      if (switching) savedKeys = new Set(before.days.find((d) => d.key === state.activeDay)?.items.map((i) => i.key) ?? []);
      lastLocalEdit = Date.now();
      emit();
      void persistProgram(before, state.program).then(() => { if (switching) { closeChannel(); return load(); } }).catch(fail);
    },
    startProgram(program) {
      status = "loading";
      emit();
      chosenDay = null;
      void insertProgram(db, { ...ids, hasPlanColumns }, program).then(() => load()).catch(fail);
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
        const day = { ...INITIAL_WORKOUT, items: INITIAL_WORKOUT.items.map((i) => ({ ...i, key: newKey() })) };
        await insertProgram(db, { ...ids, hasPlanColumns }, programFromWorkout(day, newKey(), "Foundations"));
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

const dayRow = (d: ProgramDay, version: string) => ({ id: d.key, program_version_id: version, name: d.name, week: d.week, day_index: d.dayIndex, est_minutes: d.minutes });

/** Gives a client a new program (a template, an import, the starter): the latest program is the one that counts,
    older ones stay as history. Used for the open client and when assigning a template to several clients. */
export async function insertProgram(db: SupabaseClient, ids: { coachId: string; clientId: string; me: string; hasPlanColumns?: boolean }, plan: Program): Promise<void> {
  const { data: program, error: e1 } = await db.from("programs").insert({ coach_id: ids.coachId, client_id: ids.clientId, name: plan.name, weeks: Math.min(52, Math.max(1, plan.weeks)) }).select("id").single();
  if (e1) throw e1;
  const { data: version, error: e2 } = await db.from("program_versions").insert({ program_id: program.id, version: 1, published_at: new Date().toISOString(), published_by: ids.me }).select("id").single();
  if (e2) throw e2;
  const { error: e3 } = await db.from("workouts").insert(plan.days.map((d) => dayRow(d, version.id)));
  if (e3) throw e3;
  const rows = plan.days.flatMap((d) => toItemRows(d, d.key));
  if (!rows.length) return;
  const first = await db.from("workout_items").insert(ids.hasPlanColumns === false ? withoutPlan(rows) : rows);
  if (first.error && isMissingColumn(first.error)) {
    const { error: e5 } = await db.from("workout_items").insert(withoutPlan(rows));
    if (e5) throw e5;
  } else if (first.error) throw first.error;
}
