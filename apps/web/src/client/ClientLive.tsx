import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { WEARABLES } from "@apex/core";
import type { StravaLink, WearableLink } from "../data/ActivityContext";
import type { LiveActivityStore } from "../data/supabaseActivities";
import { AppInfoProvider } from "../app/AppContext";
import { Splash, type Live } from "../app/Gate";
import { ActivityProvider } from "../data/ActivityContext";
import { StoreProvider } from "../data/StoreContext";
import { finishStravaConnect, liveStravaLink } from "../data/strava";
import { finishWearableConnect, liveWearableLink } from "../data/wearables";
import { createSupabaseActivities } from "../data/supabaseActivities";
import { LifestyleProvider } from "../data/LifestyleContext";
import { createSupabaseLifestyle } from "../data/supabaseLifestyle";
import { FormCheckProvider } from "../data/FormCheckContext";
import { createSupabaseFormChecks } from "../data/supabaseFormChecks";
import { GoalProvider } from "../data/GoalContext";
import { createSupabaseGoals } from "../data/supabaseGoals";
import { BookingProvider, liveBookings } from "../data/bookings";
import { ChallengeProvider, liveChallenges } from "../data/challenges";
import { ResourceProvider, liveResources } from "../data/resources";
import { createSupabaseStore } from "../data/supabaseStore";
import { ClientApp } from "./ClientApp";

/** Live client: finds the client's coach, then runs the client app on their real program. */
export function ClientLive({ db, profile, signOut }: Live) {
  const [coach, setCoach] = useState<{ id: string; name: string } | null | undefined>(undefined);
  useEffect(() => {
    void db
      .from("coach_clients")
      .select("coach_id, profiles!coach_clients_coach_id_fkey(full_name)")
      .eq("client_id", profile.id)
      .neq("status", "ended")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const p = data?.profiles as unknown as { full_name: string } | null;
        setCoach(data ? { id: data.coach_id as string, name: p?.full_name ?? "your coach" } : null);
      });
  }, [db, profile.id]);

  const store = useMemo(() => (coach ? createSupabaseStore(db, { coachId: coach.id, clientId: profile.id, me: profile.id }) : null), [db, coach, profile.id]);
  const activities = useMemo(() => createSupabaseActivities(db, profile.id), [db, profile.id]);
  const strava = useMemo(() => liveStravaLink(db, activities), [db, activities]);
  useEffect(() => () => activities.close(), [activities]);
  const lifestyle = useMemo(() => createSupabaseLifestyle(db, profile.id), [db, profile.id]);
  useEffect(() => () => lifestyle.close(), [lifestyle]);
  const formChecks = useMemo(() => createSupabaseFormChecks(db, profile.id), [db, profile.id]);
  useEffect(() => () => formChecks.close(), [formChecks]);
  const goals = useMemo(() => createSupabaseGoals(db, profile.id), [db, profile.id]);
  useEffect(() => () => goals.close(), [goals]);
  const challenges = useMemo(() => (coach ? liveChallenges(db, { side: "client", coachId: coach.id, me: profile.id }) : null), [db, coach, profile.id]);
  const resources = useMemo(() => (coach ? liveResources(db, coach.id) : null), [db, coach]);
  const bookings = useMemo(() => (coach ? liveBookings(db, { side: "client", coachId: coach.id, me: profile.id }) : null), [db, coach, profile.id]);
  const wearables = useMemo(() => liveWearableLink(db, activities), [db, activities]);
  const notice = useConnectReturn(db, activities, strava, wearables);

  if (coach === undefined) return <Splash />;
  if (!coach || !store) {
    return (
      <Splash>
        <h1 className="h1" style={{ fontSize: 22 }}>You're not linked to a coach yet</h1>
        <p className="sub" style={{ maxWidth: 380, textAlign: "center" }}>Open the invite link your coach sent you and you'll be connected.</p>
        <button className="btn ghost" onClick={signOut}>Sign out</button>
      </Splash>
    );
  }
  return (
    <AppInfoProvider info={{ mode: "live", coachName: coach.name.split(" ")[0] ?? coach.name, clientName: profile.full_name, signOut }}>
      <StoreProvider store={store}>
        <ActivityProvider store={activities} strava={strava} wearables={wearables}>
          <LifestyleProvider store={lifestyle}>
            <FormCheckProvider store={formChecks}>
              <GoalProvider store={goals}>
                <BookingProvider value={bookings}>
                  <ChallengeProvider value={challenges}>
                    <ResourceProvider value={resources}>
                      <ClientApp notice={notice} />
                    </ResourceProvider>
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

/** Back from Strava's or a watch maker's "Allow" page: finish connecting, bring in recent data, and say how it went. */
function useConnectReturn(db: SupabaseClient, store: LiveActivityStore, strava: StravaLink, wearables: WearableLink): string | null {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    finishStravaConnect(db)
      .then(async (done) => {
        if (done) {
          await store.reload();
          const n = await strava.sync();
          if (live) setNotice(`Strava connected${n ? ` · ${n} activit${n === 1 ? "y" : "ies"} brought in` : ""}`);
          return;
        }
        const w = await finishWearableConnect(db);
        if (!w) return;
        await store.reload();
        const n = await wearables.sync(w.provider);
        if (live) setNotice(`${WEARABLES[w.provider].name} connected${n ? ` · ${n} nights brought in` : ""}`);
      })
      .catch((e: unknown) => live && setNotice(e instanceof Error ? e.message : String(e)));
    return () => { live = false; };
  }, [db, store, strava, wearables]);
  return notice;
}
