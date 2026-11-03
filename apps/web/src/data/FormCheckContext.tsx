import { emptyFormCheckStore, type FormCheckState, type FormCheckStore } from "@apex/core";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

/* Video form checks of the client in view. One store per client, like LifestyleContext. */

const Ctx = createContext<FormCheckStore>(emptyFormCheckStore());

export const FormCheckProvider = ({ store, children }: { store: FormCheckStore; children: ReactNode }) => <Ctx.Provider value={store}>{children}</Ctx.Provider>;

export const useFormCheckStore = (): FormCheckStore => useContext(Ctx);

export function useFormChecks(): FormCheckState {
  const store = useContext(Ctx);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
