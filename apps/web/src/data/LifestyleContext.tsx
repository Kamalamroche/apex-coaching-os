import { emptyLifestyleStore, type LifestyleState, type LifestyleStore } from "@apex/core";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

/* Habits, nutrition and the questionnaire of the client in view. One store per client, like ActivityContext. */

const EMPTY = emptyLifestyleStore();
const Ctx = createContext<LifestyleStore>(EMPTY);

export const LifestyleProvider = ({ store, children }: { store: LifestyleStore; children: ReactNode }) => <Ctx.Provider value={store}>{children}</Ctx.Provider>;

export const useLifestyleStore = (): LifestyleStore => useContext(Ctx);

export function useLifestyle(): LifestyleState {
  const store = useContext(Ctx);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
