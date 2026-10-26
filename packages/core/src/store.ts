import { INITIAL_HISTORY, INITIAL_MESSAGES, INITIAL_WORKOUT } from "./data/workout";
import { nextHistory } from "./summary";
import type { Message, SessionLog, TrainingHistory, Workout } from "./types";
import type { SessionSets } from "./session";

/* The data both apps share, behind one interface with two implementations:
   - the demo store (here): localStorage, so a coach edit in one tab shows up in the client
     tab straight away (the browser fires a `storage` event);
   - the Supabase store (apps/web/src/data): the database, kept live with Realtime.
   Screens only talk to this interface, so they work the same in both modes. */

export interface ApexState {
  workout: Workout;
  log: SessionLog | null;
  messages: Message[];
  /** Personal bests and the previous session, for the post-workout summary. */
  history: TrainingHistory;
}

export interface ApexStore {
  get(): ApexState;
  subscribe(listener: () => void): () => void;
  /** Coach edit to the program. Saved as you type. */
  saveWorkout(workout: Workout): void;
  /** Client finished a session. `sets` is every set as logged. */
  finishSession(log: SessionLog, sets: SessionSets): void;
  sendMessage(from: Message["from"], text: string): void;
  /** Demo only: back to the sample data. */
  reset(): void;
}

export const DEMO_STORAGE_KEY = "apex-demo-v1";

export const initialState = (): ApexState => ({ workout: INITIAL_WORKOUT, log: null, messages: INITIAL_MESSAGES, history: INITIAL_HISTORY });

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface StorageEventTarget {
  addEventListener(type: "storage", fn: (e: StorageEvent) => void): void;
  removeEventListener(type: "storage", fn: (e: StorageEvent) => void): void;
}

function read(storage: StorageLike | null): ApexState {
  try {
    const raw = storage?.getItem(DEMO_STORAGE_KEY);
    if (raw) return { ...initialState(), ...(JSON.parse(raw) as Partial<ApexState>) };
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
    saveWorkout: (workout) => update((s) => ({ ...s, workout })),
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
