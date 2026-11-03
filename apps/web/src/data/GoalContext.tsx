import { emptyGoalStore, type GoalState, type GoalStore } from "@apex/core";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

/* Goals of the client in view. One store per client, like LifestyleContext. */

const Ctx = createContext<GoalStore>(emptyGoalStore());

export const GoalProvider = ({ store, children }: { store: GoalStore; children: ReactNode }) => <Ctx.Provider value={store}>{children}</Ctx.Provider>;

export const useGoalStore = (): GoalStore => useContext(Ctx);

export function useGoals(): GoalState {
  const store = useContext(Ctx);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
