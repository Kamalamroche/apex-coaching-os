import { INITIAL_MESSAGES, INITIAL_WORKOUT } from "./data/workout";
import type { Message, SessionLog, Workout } from "./types";

/* The data both apps share. In demo mode it lives in localStorage, so a coach edit in one
   tab shows up in the client tab straight away (the browser fires a `storage` event).
   The Supabase implementation will keep the same get/update/subscribe shape, backed by
   the database and Realtime instead. */

export interface ApexState {
  workout: Workout;
  log: SessionLog | null;
  messages: Message[];
}

export interface ApexStore {
  get(): ApexState;
  update(updater: (s: ApexState) => ApexState): void;
  subscribe(listener: () => void): () => void;
  reset(): void;
}

export const DEMO_STORAGE_KEY = "apex-demo-v1";

export const initialState = (): ApexState => ({ workout: INITIAL_WORKOUT, log: null, messages: INITIAL_MESSAGES });

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
): ApexStore {
  let state = read(storage);
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const onStorage = (e: StorageEvent) => {
    if (e.key !== DEMO_STORAGE_KEY && e.key !== null) return;
    state = read(storage);
    emit();
  };

  return {
    get: () => state,
    update(updater) {
      state = updater(state);
      try {
        storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* storage full or blocked: the change still applies in this tab */
      }
      emit();
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
