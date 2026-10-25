import { useSyncExternalStore } from "react";
import type { ApexState, ApexStore } from "./store";

/** Subscribe a component to the shared store. */
export function useApexState(store: ApexStore): ApexState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
