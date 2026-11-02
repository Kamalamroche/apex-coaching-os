import { emptyProgress, hasMeasurements, type CheckInInput, type MeasurementInput, type PhotoUpload, type ProgressState } from "./checkins";
import { INITIAL_PROGRESS } from "./data/progress";
import { INITIAL_HISTORY, INITIAL_MESSAGES, INITIAL_WORKOUT } from "./data/workout";
import { dayWorkout, programFromWorkout, sortDays, withDayWorkout } from "./program";
import { nextHistory } from "./summary";
import type { Message, Program, SessionLog, TrainingHistory, Workout } from "./types";
import type { SessionSets } from "./session";

/* The data both apps share, behind one interface with two implementations:
   - the demo store (here): localStorage, so a coach edit in one tab shows up in the client
     tab straight away (the browser fires a `storage` event);
   - the Supabase store (apps/web/src/data): the database, kept live with Realtime.
   Screens only talk to this interface, so they work the same in both modes. */

export interface ApexState {
  /** The day open in the builder, and the one the client trains next. Always the active day of `program`. */
  workout: Workout;
  /** Every week and day. */
  program: Program;
  /** Key of the day `workout` shows. */
  activeDay: string;
  log: SessionLog | null;
  messages: Message[];
  /** Personal bests and the previous session, for the post-workout summary. */
  history: TrainingHistory;
  /** Check-ins, measurements and photos of the client being coached. */
  progress: ProgressState;
}

export interface ApexStore {
  get(): ApexState;
  subscribe(listener: () => void): () => void;
  /** Coach edit to the open day. Saved as you type. */
  saveWorkout(workout: Workout): void;
  /** Opens another day of the program (coach). */
  selectDay(key: string): void;
  /** Coach change to the program's shape: days added, removed, copied, moved or renamed. Items of the open day go through saveWorkout. */
  saveProgram(program: Program, activeDay?: string): void;
  /** Replaces the client's program with a new one, e.g. from a template. The old one is kept as history where the store can. */
  startProgram(program: Program): void;
  /** Client finished a session. `sets` is every set as logged. */
  finishSession(log: SessionLog, sets: SessionSets): void;
  sendMessage(from: Message["from"], text: string): void;
  /** Client sends the weekly check-in, with any measurements and photos taken for it. */
  submitCheckIn(checkIn: CheckInInput, measurements: MeasurementInput, photos: PhotoUpload[]): Promise<void>;
  /** Client logs measurements on their own, outside a check-in. */
  logMeasurements(measurements: MeasurementInput): Promise<void>;
  /** Client adds progress photos outside a check-in. */
  addPhotos(photos: PhotoUpload[]): Promise<void>;
  deletePhoto(id: string): Promise<void>;
  /** Coach replies to a check-in and marks it reviewed. */
  reviewCheckIn(id: string, reply: string): Promise<void>;
  /** Coach sets the client's check-in day, 0 = Monday … 6 = Sunday. */
  setCheckInDay(day: number): Promise<void>;
  /** Demo only: back to the sample data. */
  reset(): void;
}

export const DEMO_STORAGE_KEY = "apex-demo-v1";

/** Program and open day in step: `workout` is always the active day. An unknown key opens the first day. */
export function withProgram<S extends ApexState>(state: S, program: Program, activeDay: string = state.activeDay): S {
  const days = sortDays(program.days);
  const day = days.find((d) => d.key === activeDay) ?? days[0];
  const workout = day ? dayWorkout(program, day) : { ...state.workout, name: program.name, ofWeeks: program.weeks, items: [] };
  return { ...state, program: { ...program, days }, activeDay: day?.key ?? "", workout };
}

/** A state around a single workout (sample data, older saved state). No progress given means none yet. */
export const stateForWorkout = (workout: Workout, rest: Omit<ApexState, "workout" | "program" | "activeDay" | "progress"> & { progress?: ProgressState }): ApexState => {
  const program = programFromWorkout(workout, "day-1", "Strength block");
  return { ...rest, progress: rest.progress ?? emptyProgress(), workout, program, activeDay: "day-1" };
};

export const initialState = (): ApexState => stateForWorkout(INITIAL_WORKOUT, { log: null, messages: INITIAL_MESSAGES, history: INITIAL_HISTORY, progress: INITIAL_PROGRESS });

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface StorageEventTarget {
  addEventListener(type: "storage", fn: (e: StorageEvent) => void): void;
  removeEventListener(type: "storage", fn: (e: StorageEvent) => void): void;
}

function read(storage: StorageLike | null): ApexState {
  try {
    const raw = storage?.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<ApexState>;
      // Saved before plateau alerts: keep the sample trend so the demo still shows one.
      if (saved.history && !saved.history.trend) saved.history = { ...saved.history, trend: initialState().history.trend ?? {} };
      if (saved.history && !saved.history.readiness) saved.history = { ...saved.history, readiness: initialState().history.readiness ?? [] };
      // Saved before programs had days: wrap the one workout in a program.
      if (!saved.program && saved.workout) return { ...initialState(), ...saved, ...stateForWorkout(saved.workout, { ...initialState(), ...saved }) };
      return { ...initialState(), ...saved };
    }
  } catch {
    /* private mode or corrupt data: fall back to the sample state */
  }
  return initialState();
}

export function createDemoStore(
  storage: StorageLike | null = safeLocalStorage(),
  events: StorageEventTarget | null = typeof window === "undefined" ? null : window,
  initial: () => ApexState = initialState,
): ApexStore {
  let state = storage ? read(storage) : initial();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const onStorage = (e: StorageEvent) => {
    if (e.key !== DEMO_STORAGE_KEY && e.key !== null) return;
    state = read(storage);
    emit();
  };

  const update = (updater: (s: ApexState) => ApexState) => {
    state = updater(state);
    try {
      storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: the change still applies in this tab */
    }
    emit();
  };

  const now = () => new Date().toISOString();
  const withProgress = (fn: (p: ProgressState) => ProgressState) => update((s) => ({ ...s, progress: fn(s.progress) }));
  // Demo photos keep only the small preview, so a few check-ins fit in localStorage.
  const demoPhotos = (photos: PhotoUpload[], checkInId: string | null) =>
    photos.map((p) => ({ id: crypto.randomUUID(), checkInId, pose: p.pose, path: `demo/${p.pose}`, takenAt: now(), url: p.preview }));

  return {
    get: () => state,
    saveWorkout: (workout) => update((s) => ({ ...s, workout, program: withDayWorkout(s.program, s.activeDay, workout) })),
    selectDay: (key) => update((s) => withProgram(s, s.program, key)),
    saveProgram: (program, activeDay) => update((s) => withProgram(s, program, activeDay)),
    startProgram: (program) => update((s) => withProgram({ ...s, log: null }, program, "")),
    finishSession: (log, sets) => update((s) => ({ ...s, log, history: nextHistory(s.history, log, s.workout, sets) })),
    sendMessage: (from, text) => update((s) => ({ ...s, messages: [...s.messages, { from, text, time: "Now" }] })),
    async submitCheckIn(checkIn, measurements, photos) {
      const id = crypto.randomUUID();
      const at = now();
      withProgress((p) => ({
        ...p,
        checkIns: [{ ...checkIn, id, submittedAt: at, coachReply: null, reviewedAt: null }, ...p.checkIns],
        measurements: hasMeasurements(measurements) ? [...p.measurements, { ...measurements, id: crypto.randomUUID(), measuredAt: at, checkInId: id }] : p.measurements,
        photos: [...p.photos, ...demoPhotos(photos, id)],
      }));
    },
    async logMeasurements(measurements) {
      if (!hasMeasurements(measurements)) return;
      withProgress((p) => ({ ...p, measurements: [...p.measurements, { ...measurements, id: crypto.randomUUID(), measuredAt: now(), checkInId: null }] }));
    },
    async addPhotos(photos) {
      withProgress((p) => ({ ...p, photos: [...p.photos, ...demoPhotos(photos, null)] }));
    },
    async deletePhoto(id) {
      withProgress((p) => ({ ...p, photos: p.photos.filter((x) => x.id !== id) }));
    },
    async reviewCheckIn(id, reply) {
      withProgress((p) => ({ ...p, checkIns: p.checkIns.map((c) => (c.id === id ? { ...c, coachReply: reply.trim() || null, reviewedAt: now() } : c)) }));
    },
    async setCheckInDay(day) {
      withProgress((p) => ({ ...p, checkInDay: day }));
    },
    subscribe(listener) {
      if (listeners.size === 0) events?.addEventListener("storage", onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) events?.removeEventListener("storage", onStorage);
      };
    },
    reset() {
      try {
        storage?.removeItem(DEMO_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      state = initialState();
      emit();
    },
  };
}

function safeLocalStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
