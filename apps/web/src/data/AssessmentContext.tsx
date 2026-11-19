import { emptyAssessmentStore, type AssessmentState, type AssessmentStore } from "@apex/core";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

/* Posture and mobility assessments of the client in view. One store per client, like FormCheckContext. */

const Ctx = createContext<AssessmentStore>(emptyAssessmentStore());

export const AssessmentProvider = ({ store, children }: { store: AssessmentStore; children: ReactNode }) => <Ctx.Provider value={store}>{children}</Ctx.Provider>;

export const useAssessmentStore = (): AssessmentStore => useContext(Ctx);

export function useAssessments(): AssessmentState {
  const store = useContext(Ctx);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
