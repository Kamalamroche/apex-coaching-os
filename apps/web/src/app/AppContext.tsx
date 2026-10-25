import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { useStore } from "../data/StoreContext";
import type { LiveStore } from "../data/supabaseStore";

export interface AppInfo {
  mode: "demo" | "live";
  coachName: string;
  clientName: string;
  /** Live mode only. */
  signOut?: () => void;
}

const DEMO: AppInfo = { mode: "demo", coachName: "Kamal", clientName: "Priya Sharma" };
const AppContext = createContext<AppInfo>(DEMO);

export const AppInfoProvider = ({ info, children }: { info: AppInfo; children: ReactNode }) => (
  <AppContext.Provider value={info}>{children}</AppContext.Provider>
);

export const useAppInfo = (): AppInfo => useContext(AppContext);

export type StoreStatus = ReturnType<LiveStore["status"]>;

/** Loading / ready / no-program / error for the live store; always "ready" in the demo. */
export function useStoreStatus(): { status: StoreStatus; error: string | null } {
  const store = useStore() as Partial<LiveStore> & ReturnType<typeof useStore>;
  const status = useSyncExternalStore(store.subscribe, () => store.status?.() ?? "ready");
  return { status, error: store.error?.() ?? null };
}

/** Marks a section that still shows sample data in live mode. */
export function SampleNote() {
  const { mode } = useAppInfo();
  if (mode === "demo") return null;
  return <div className="tiny full" style={{ border: "1px dashed var(--line2)", borderRadius: "var(--r-sm)", padding: "8px 10px" }}>Sample data. This section connects to your real data in a later update.</div>;
}
