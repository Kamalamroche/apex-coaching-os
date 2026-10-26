import {
  INITIAL_WORKOUT, emptyProgress, emptyState, hasMeasurements, latestSetByExercise, photoPath, toCheckIn, toCheckInRow, toItemRows, toLoggedSetRows,
  toMeasurement, toMeasurementRow, toMessages, toPhoto, toSessionLog, toWorkout,
  type ApexStore, type CheckInRow, type LoggedSetRow, type MeasurementInput, type MeasurementRow, type MessageRow, type PhotoRow, type PhotoUpload,
  type ProgressState, type SessionRow, type Workout, type WorkoutItemRow, type WorkoutRow,
} from "@apex/core";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_BUCKET = "progress-photos";
/** Signed photo links last an hour; every progress reload makes fresh ones. */
const PHOTO_URL_SECONDS = 3600;

export interface LiveStore extends ApexStore {
  status(): "loading" | "ready" | "no-program" | "error";
  error(): string | null;
  /** Check-ins, measurements or photos failed to load (e.g. the database update hasn't been run yet). The rest still works. */
  progressError(): string | null;
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

const empty = emptyState;

const message = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);

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
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let progressTimer: ReturnType<typeof setTimeout> | undefined;
  let progressError: string | null = null;
  let progressSeq = 0;
  let channelWorkoutId: string | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const fail = (e: unknown) => {
    error = message(e);
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
      const [messages, progress] = await Promise.all([loadMessages(), loadProgress()]);
      if (stale()) return;
      if (!program) {
        status = "no-program";
        state = { ...empty(), messages, progress };
        emit();
        if (listeners.size) openChannel();
        return;
      }
      const { data: version, error: vErr } = await db.from("program_versions").select("id").eq("program_id", program.id).order("version", { ascending: false }).limit(1).maybeSingle();
      if (vErr) throw vErr;
      if (!version) throw new Error("This program has no published version yet");
      const { data: workout, error: wErr } = await db.from("workouts").select("id, name, week, est_minutes").eq("program_version_id", version.id).order("week").order("day_index").limit(1).maybeSingle<WorkoutRow>();
      if (wErr) throw wErr;
      if (!workout) throw new Error("This program has no workouts yet");
      workoutId = workout.id;

      const [{ data: items, error: iErr }, { data: recent, error: rErr }, { data: session, error: sErr }] = await Promise.all([
        db.from("workout_items").select("*").eq("workout_id", workout.id).returns<WorkoutItemRow[]>(),
        db.from("logged_sets").select("exercise_id, load_kg, reps, seconds, rpe, sessions!inner(client_id)").eq("sessions.client_id", ids.clientId).order("completed_at", { ascending: false }).limit(300),
        db.from("sessions").select("id, started_at, finished_at, session_rpe, sets_completed, volume_kg, prs").eq("client_id", ids.clientId).eq("workout_id", workout.id).not("finished_at", "is", null).gte("finished_at", startOfToday()).order("finished_at", { ascending: false }).limit(1).maybeSingle<SessionRow>(),
      ]);
      if (iErr) throw iErr;
      if (rErr) throw rErr;
      if (sErr) throw sErr;

      if (stale()) return;
      const last = latestSetByExercise((recent ?? []) as unknown as Pick<LoggedSetRow, "exercise_id" | "load_kg" | "reps" | "seconds" | "rpe">[]);
      const w = toWorkout(workout, items ?? [], program.weeks, last);
      savedKeys = new Set(w.items.map((i) => i.key));
      state = { workout: w, log: session ? toSessionLog(session, w.name) : null, messages, progress };
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

  /** Never throws: progress is extra, so a failure here must not take the program and messages down with it. */
  async function loadProgress(): Promise<ProgressState> {
    try {
      const [ci, ms, ph, rel] = await Promise.all([
        db.from("check_ins").select("*").eq("client_id", ids.clientId).order("submitted_at", { ascending: false }).limit(104).returns<CheckInRow[]>(),
        db.from("body_measurements").select("*").eq("client_id", ids.clientId).order("measured_at").limit(500).returns<MeasurementRow[]>(),
        db.from("progress_photos").select("*").eq("client_id", ids.clientId).order("taken_at").limit(300).returns<PhotoRow[]>(),
        db.from("coach_clients").select("check_in_day").eq("coach_id", ids.coachId).eq("client_id", ids.clientId).maybeSingle<{ check_in_day: number }>(),
      ]);
      for (const r of [ci, ms, ph, rel]) if (r.error) throw r.error;
      const photos = ph.data ?? [];
      const urls = new Map<string, string>();
      if (photos.length) {
        const { data, error: uErr } = await db.storage.from(PHOTO_BUCKET).createSignedUrls(photos.map((r) => r.storage_path), PHOTO_URL_SECONDS);
        if (uErr) throw uErr;
        for (const u of data ?? []) if (u.path && u.signedUrl) urls.set(u.path, u.signedUrl);
      }
      progressError = null;
      return {
        checkIns: (ci.data ?? []).map(toCheckIn),
        measurements: (ms.data ?? []).map(toMeasurement),
        photos: photos.map((r) => toPhoto(r, urls.get(r.storage_path) ?? null)),
        checkInDay: rel.data?.check_in_day ?? 0,
      };
    } catch (e) {
      progressError = message(e);
      return state.progress ?? emptyProgress();
    }
  }

  async function reloadProgress() {
    const seq = ++progressSeq;
    const progress = await loadProgress();
    if (seq !== progressSeq) return;
    state = { ...state, progress };
    emit();
  }

  async function uploadPhotos(photos: PhotoUpload[], checkInId: string | null) {
    for (const p of photos) {
      const id = crypto.randomUUID();
      const path = photoPath(ids.clientId, p.pose, id);
      const { error: upErr } = await db.storage.from(PHOTO_BUCKET).upload(path, p.file, { contentType: p.file.type || "image/jpeg", upsert: false });
      if (upErr) throw upErr;
      const { error: rowErr } = await db.from("progress_photos").insert({ id, client_id: ids.clientId, check_in_id: checkInId, pose: p.pose, storage_path: path });
      if (rowErr) {
        await db.storage.from(PHOTO_BUCKET).remove([path]);
        throw rowErr;
      }
    }
  }

  async function insertMeasurements(m: MeasurementInput, checkInId: string | null) {
    if (!hasMeasurements(m)) return;
    const { error: mErr } = await db.from("body_measurements").insert(toMeasurementRow(m, ids.clientId, crypto.randomUUID(), checkInId));
    if (mErr) throw mErr;
  }

  // The realtime channel lives while someone is listening. Tying it to listeners (rather than to
  // React effects) keeps it alive through StrictMode's mount/unmount/mount in development.
  function openChannel() {
    clearTimeout(closeTimer);
    // Wait for the first load, then (re)open once we know which workout to follow.
    if (status === "loading") return;
    if (channel && channelWorkoutId === workoutId) return;
    closeChannel();
    channelWorkoutId = workoutId;
    const reload = () => {
      if (Date.now() - lastLocalEdit < ECHO_GUARD_MS) return;
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => void load(), 250);
    };
    const progressChanged = () => {
      clearTimeout(progressTimer);
      progressTimer = setTimeout(() => void reloadProgress(), 250);
    };
    let ch = db.channel(`apex-${ids.clientId}-${Math.random().toString(36).slice(2)}`);
    if (workoutId) ch = ch.on("postgres_changes", { event: "*", schema: "public", table: "workout_items", filter: `workout_id=eq.${workoutId}` }, reload);
    for (const table of ["check_ins", "body_measurements", "progress_photos"]) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `client_id=eq.${ids.clientId}` }, progressChanged);
    }
    channel = ch
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
    progressError: () => progressError,
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
      state = { ...state, log };
      emit();
      void (async () => {
        const startedAt = new Date(Date.now() - log.minutes * 60000).toISOString();
        const { data, error: e1 } = await db.from("sessions").insert({
          client_id: ids.clientId, workout_id: workoutId, started_at: startedAt, finished_at: new Date().toISOString(),
          session_rpe: log.rpe, sets_completed: log.sets, volume_kg: log.volumeKg, prs: log.prs,
        }).select("id").single();
        if (e1) throw e1;
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
    async submitCheckIn(checkIn, measurements, photos) {
      const id = crypto.randomUUID();
      const { error: e1 } = await db.from("check_ins").insert(toCheckInRow(checkIn, ids.clientId, id));
      if (e1) throw e1;
      try {
        await insertMeasurements(measurements, id);
        await uploadPhotos(photos, id);
      } catch (e) {
        // The check-in itself is in, so sending again would duplicate it. Say what's missing instead.
        throw Object.assign(new Error(`Your check-in was sent, but some measurements or photos didn't save (${message(e)}). You can add them from Progress.`), { sent: true });
      } finally {
        await reloadProgress();
      }
    },
    async logMeasurements(measurements) {
      await insertMeasurements(measurements, null);
      await reloadProgress();
    },
    async addPhotos(photos) {
      try {
        await uploadPhotos(photos, null);
      } finally {
        await reloadProgress();
      }
    },
    async deletePhoto(id) {
      const photo = state.progress.photos.find((p) => p.id === id);
      const { error: e1 } = await db.from("progress_photos").delete().eq("id", id);
      if (e1) throw e1;
      if (photo) await db.storage.from(PHOTO_BUCKET).remove([photo.path]);
      await reloadProgress();
    },
    async reviewCheckIn(id, reply) {
      const { data, error: e1 } = await db.from("check_ins").update({ coach_reply: reply.trim() || null, reviewed_at: new Date().toISOString() }).eq("id", id).select("id");
      if (e1) throw e1;
      if (!data?.length) throw new Error("Couldn't save the reply. Check the database update has been run.");
      await reloadProgress();
    },
    async setCheckInDay(day) {
      const { data, error: e1 } = await db.from("coach_clients").update({ check_in_day: day }).eq("coach_id", ids.coachId).eq("client_id", ids.clientId).select("check_in_day");
      if (e1) throw e1;
      if (!data?.length) throw new Error("Couldn't change the check-in day");
      await reloadProgress();
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
      clearTimeout(progressTimer);
      closeChannel();
    },
  };
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
