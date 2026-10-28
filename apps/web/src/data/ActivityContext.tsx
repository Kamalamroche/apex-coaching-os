import type { ActivityState, ActivityStore } from "@apex/core";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

/** What the Connected apps screen can do. The demo fakes it; the live app talks to the `strava` edge function. */
export interface StravaLink {
  /** False when the app was built without a Strava client id (VITE_STRAVA_CLIENT_ID). */
  available: boolean;
  /** Sends the client to Strava to say yes. Comes back to the client app. */
  connect(): void;
  /** Brings in activities since the last sync. Resolves to how many were new or changed. */
  sync(): Promise<number>;
  disconnect(): Promise<void>;
}

interface Value {
  store: ActivityStore;
  strava: StravaLink | null;
  /** False on the coach side: the coach reads a client's cardio but never changes it. */
  editable: boolean;
}

const Ctx = createContext<Value | null>(null);

export const ActivityProvider = ({ store, strava = null, editable = true, children }: { store: ActivityStore; strava?: StravaLink | null; editable?: boolean; children: ReactNode }) => (
  <Ctx.Provider value={{ store, strava, editable }}>{children}</Ctx.Provider>
);

export function useActivityContext(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useActivityContext outside ActivityProvider");
  return v;
}

export function useActivities(): ActivityState {
  const { store } = useActivityContext();
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** A store with nothing in it, for a coach with no clients yet. */
export function emptyActivityStore(): ActivityStore {
  const state: ActivityState = { activities: [], connections: [], status: "ready" };
  return { get: () => state, subscribe: () => () => {}, save: () => {}, remove: () => {}, setConnection: () => {}, removeConnection: () => {} };
}
