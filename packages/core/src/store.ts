import { emptyProgress, hasMeasurements, type CheckInInput, type MeasurementInput, type PhotoUpload, type ProgressState } from "./checkins";
import { INITIAL_PROGRESS } from "./data/progress";
import { INITIAL_MESSAGES, INITIAL_WORKOUT } from "./data/workout";
import type { Message, SessionLog, Workout } from "./types";
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
  /** Check-ins, measurements and photos of the client being coached. */
  progress: ProgressState;
}

export interface ApexStore {
  get(): ApexState;
  subscribe(listener: () => void): () => void;
  /** Coach edit to the program. Saved as you type. */
  saveWorkout(workout: Workout): void;
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

export const initialState = (): ApexState => ({ workout: INITIAL_WORKOUT, log: null, messages: INITIAL_MESSAGES, progress: INITIAL_PROGRESS });

/** For a live store before anything has loaded. */
export const emptyState = (): ApexState => ({ workout: { ...INITIAL_WORKOUT, items: [] }, log: null, messages: [], progress: emptyProgress() });

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

  const now = () => new Date().toISOString();
  const withProgress = (fn: (p: ProgressState) => ProgressState) => update((s) => ({ ...s, progress: fn(s.progress) }));
  // Demo photos keep only the small preview, so a few check-ins fit in localStorage.
  const demoPhotos = (photos: PhotoUpload[], checkInId: string | null) =>
    photos.map((p) => ({ id: crypto.randomUUID(), checkInId, pose: p.pose, path: `demo/${p.pose}`, takenAt: now(), url: p.preview }));

  return {
    get: () => state,
    saveWorkout: (workout) => update((s) => ({ ...s, workout })),
    finishSession: (log) => update((s) => ({ ...s, log })),
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
