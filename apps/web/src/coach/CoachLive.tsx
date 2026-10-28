import { createDemoStore, INITIAL_WORKOUT, stateForWorkout, type ApexStore } from "@apex/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppInfoProvider } from "../app/AppContext";
import type { Live } from "../app/Gate";
import { listClients, type LiveClient } from "../data/coach";
import { applyJoinedImports } from "../data/transfer";
import { StoreProvider } from "../data/StoreContext";
import { createSupabaseStore } from "../data/supabaseStore";
import { CoachApp } from "./CoachApp";

export interface CoachLiveInfo {
  clients: LiveClient[] | null;
  activeClientId: string | null;
  setActiveClientId: (id: string) => void;
  refreshClients: () => void;
}

/** Live coach: loads the coach's clients and points the shared store at the one being coached. */
export function CoachLive({ db, profile, signOut }: Live) {
  const [clients, setClients] = useState<LiveClient[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const refreshClients = useCallback(() => {
    void listClients(db, profile.id).then((list) => {
      setClients(list);
      setActiveId((cur) => cur ?? list[0]?.id ?? null);
    });
    // Imported clients who have joined since last time get their program and history now.
    void applyJoinedImports(db, profile.id).catch((e) => console.error("Couldn't bring in imported data", e));
  }, [db, profile.id]);
  useEffect(refreshClients, [refreshClients]);

  const store: ApexStore = useMemo(
    () => (activeId ? createSupabaseStore(db, { coachId: profile.id, clientId: activeId, me: profile.id }) : createDemoStore(null, null, () => stateForWorkout({ ...INITIAL_WORKOUT, items: [] }, { log: null, messages: [], history: { bestKg: {}, previous: null } }))),
    [db, profile.id, activeId],
  );

  const active = clients?.find((c) => c.id === activeId);
  return (
    <AppInfoProvider info={{ mode: "live", coachName: profile.full_name.split(" ")[0] ?? profile.full_name, clientName: active?.name ?? "", signOut }}>
      <StoreProvider store={store}>
        <CoachApp live={{ db, coachId: profile.id, clients, activeClientId: activeId, setActiveClientId: setActiveId, refreshClients }} />
      </StoreProvider>
    </AppInfoProvider>
  );
}
