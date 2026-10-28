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

/** A state around a single workout (sample data, older saved state). */
export const stateForWorkout = (workout: Workout, rest: Omit<ApexState, "workout" | "program" | "activeDay">): ApexState => {
  const program = programFromWorkout(workout, "day-1", "Strength block");
  return { ...rest, workout, program, activeDay: "day-1" };
};

export const initialState = (): ApexState => stateForWorkout(INITIAL_WORKOUT, { log: null, messages: INITIAL_MESSAGES, history: INITIAL_HISTORY });

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

  return {
    get: () => state,
    saveWorkout: (workout) => update((s) => ({ ...s, workout, program: withDayWorkout(s.program, s.activeDay, workout) })),
    selectDay: (key) => update((s) => withProgram(s, s.program, key)),
    saveProgram: (program, activeDay) => update((s) => withProgram(s, program, activeDay)),
    startProgram: (program) => update((s) => withProgram({ ...s, log: null }, program, "")),
    finishSession: (log, sets) => update((s) => ({ ...s, log, history: nextHistory(s.history, log, s.workout, sets) })),
    sendMessage: (from, text) => update((s) => ({ ...s, messages: [...s.messages, { from, text, time: "Now" }] })),
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
