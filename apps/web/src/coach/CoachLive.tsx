import { createDemoStore, emptyFormCheckStore, emptyGoalStore, emptyLifestyleStore, INITIAL_WORKOUT, stateForWorkout, type ApexStore } from "@apex/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppInfoProvider } from "../app/AppContext";
import type { Live } from "../app/Gate";
import { listClients, type LiveClient } from "../data/coach";
import { applyJoinedImports } from "../data/transfer";
import { ActivityProvider, emptyActivityStore } from "../data/ActivityContext";
import { StoreProvider } from "../data/StoreContext";
import { createSupabaseActivities } from "../data/supabaseActivities";
import { LifestyleProvider } from "../data/LifestyleContext";
import { createSupabaseLifestyle } from "../data/supabaseLifestyle";
import { FormCheckProvider } from "../data/FormCheckContext";
import { createSupabaseFormChecks } from "../data/supabaseFormChecks";
import { GoalProvider } from "../data/GoalContext";
import { createSupabaseGoals } from "../data/supabaseGoals";
import { BookingProvider, liveBookings } from "../data/bookings";
import { GrowProvider, liveGrow } from "../data/grow";
import { ChallengeProvider, liveChallenges } from "../data/challenges";
import { TeamProvider, liveTeam } from "../data/team";
import { GrowthProvider, liveGrowth } from "../data/growth";
import { ResourceProvider, liveResources } from "../data/resources";
import { CoachRecipeProvider, liveCoachRecipes } from "../data/coachRecipes";
import { NotesProvider, liveNotes } from "../data/clientNotes";
import { TwinProvider, liveTwin } from "../data/twin";
import { GymProvider, liveGym } from "../data/gym";
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

  const activities = useMemo(() => (activeId ? createSupabaseActivities(db, activeId) : emptyActivityStore()), [db, activeId]);
  useEffect(() => () => (activities as { close?: () => void }).close?.(), [activities]);
  const lifestyle = useMemo(() => (activeId ? createSupabaseLifestyle(db, activeId) : emptyLifestyleStore()), [db, activeId]);
  useEffect(() => () => (lifestyle as { close?: () => void }).close?.(), [lifestyle]);
  const formChecks = useMemo(() => (activeId ? createSupabaseFormChecks(db, activeId) : emptyFormCheckStore()), [db, activeId]);
  useEffect(() => () => (formChecks as { close?: () => void }).close?.(), [formChecks]);
  const goals = useMemo(() => (activeId ? createSupabaseGoals(db, activeId) : emptyGoalStore()), [db, activeId]);
  useEffect(() => () => (goals as { close?: () => void }).close?.(), [goals]);
  const challenges = useMemo(() => liveChallenges(db, { side: "coach", coachId: profile.id, me: profile.id }), [db, profile.id]);
  const resources = useMemo(() => liveResources(db, profile.id), [db, profile.id]);
  const coachRecipes = useMemo(() => liveCoachRecipes(db, profile.id), [db, profile.id]);
  const team = useMemo(() => liveTeam(db, { side: "coach", coachId: profile.id, me: profile.id }), [db, profile.id]);
  const growth = useMemo(() => liveGrowth(db, { side: "coach", coachId: profile.id, coachName: profile.full_name, me: profile.id }), [db, profile.id, profile.full_name]);
  const notes = useMemo(() => liveNotes(db, profile.id), [db, profile.id]);
  const clientsRef = useRef<LiveClient[]>([]);
  clientsRef.current = clients ?? [];
  const twin = useMemo(() => liveTwin(db, profile.id, () => clientsRef.current), [db, profile.id]);
  const gym = useMemo(() => liveGym(db, profile.id), [db, profile.id]);
  const grow = useMemo(() => liveGrow(db, { side: "coach", coachId: profile.id, me: profile.id }), [db, profile.id]);
  const bookings = useMemo(() => liveBookings(db, { side: "coach", coachId: profile.id, me: profile.id }), [db, profile.id]);

  const active = clients?.find((c) => c.id === activeId);
  return (
    <AppInfoProvider info={{ mode: "live", coachName: profile.full_name.split(" ")[0] ?? profile.full_name, clientName: active?.name ?? "", signOut }}>
      <StoreProvider store={store}>
        <ActivityProvider store={activities} editable={false}>
          <LifestyleProvider store={lifestyle}>
            <FormCheckProvider store={formChecks}>
              <GoalProvider store={goals}>
                <BookingProvider value={bookings}>
                  <ChallengeProvider value={challenges}>
                    <TeamProvider value={team}><GrowthProvider value={growth}><GrowProvider value={grow}>
                    <ResourceProvider value={resources}><CoachRecipeProvider value={coachRecipes}>
                      <NotesProvider value={notes}>
                        <TwinProvider value={clients ? twin : null}>
                        <GymProvider value={gym}>
                        <CoachApp live={{ db, coachId: profile.id, clients, activeClientId: activeId, setActiveClientId: setActiveId, refreshClients }} />
                        </GymProvider>
                        </TwinProvider>
                      </NotesProvider>
                    </CoachRecipeProvider></ResourceProvider>
                    </GrowProvider></GrowthProvider></TeamProvider>
                  </ChallengeProvider>
                </BookingProvider>
              </GoalProvider>
            </FormCheckProvider>
          </LifestyleProvider>
        </ActivityProvider>
      </StoreProvider>
    </AppInfoProvider>
  );
}
