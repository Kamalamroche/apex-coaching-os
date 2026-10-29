import type { ActivityState, ActivityStore, WearableProvider } from "@apex/core";
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

/** The same for watches and rings (Whoop, Oura, Fitbit, Polar; Garmin once approved). */
export interface WearableLink {
  /** False until that provider's client id is set (VITE_WHOOP_CLIENT_ID and so on). */
  available(p: WearableProvider): boolean;
  connect(p: WearableProvider): void;
  /** Brings in recent mornings. Resolves to how many came in. */
  sync(p: WearableProvider): Promise<number>;
  disconnect(p: WearableProvider): Promise<void>;
}

interface Value {
  store: ActivityStore;
  strava: StravaLink | null;
  wearables: WearableLink | null;
  /** False on the coach side: the coach reads a client's cardio but never changes it. */
  editable: boolean;
}

const Ctx = createContext<Value | null>(null);

export const ActivityProvider = ({ store, strava = null, wearables = null, editable = true, children }: { store: ActivityStore; strava?: StravaLink | null; wearables?: WearableLink | null; editable?: boolean; children: ReactNode }) => (
  <Ctx.Provider value={{ store, strava, wearables, editable }}>{children}</Ctx.Provider>
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

const EMPTY = emptyActivityStore();

/** Like useActivities, but empty outside an ActivityProvider (screens shared with places that have none). */
export function useActivitiesIfAny(): ActivityState {
  const store = useContext(Ctx)?.store ?? EMPTY;
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** A store with nothing in it, for a coach with no clients yet. */
export function emptyActivityStore(): ActivityStore {
  const state: ActivityState = { activities: [], connections: [], recovery: [], status: "ready" };
  return { get: () => state, subscribe: () => () => {}, save: () => {}, remove: () => {}, saveRecovery: () => {}, setConnection: () => {}, removeConnection: () => {} };
}
