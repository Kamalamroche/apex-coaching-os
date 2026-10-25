import type { ApexStore } from "@apex/core";
import { createContext, useContext, type ReactNode } from "react";

const StoreContext = createContext<ApexStore | null>(null);

export const StoreProvider = ({ store, children }: { store: ApexStore; children: ReactNode }) => (
  <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
);

export function useStore(): ApexStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
