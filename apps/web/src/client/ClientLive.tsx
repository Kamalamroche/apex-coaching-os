import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import type { StravaLink } from "../data/ActivityContext";
import type { LiveActivityStore } from "../data/supabaseActivities";
import { AppInfoProvider } from "../app/AppContext";
import { Splash, type Live } from "../app/Gate";
import { ActivityProvider } from "../data/ActivityContext";
import { StoreProvider } from "../data/StoreContext";
import { finishStravaConnect, liveStravaLink } from "../data/strava";
import { createSupabaseActivities } from "../data/supabaseActivities";
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
  const stravaNotice = useStravaReturn(db, activities, strava);

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
        <ActivityProvider store={activities} strava={strava}>
          <ClientApp notice={stravaNotice} />
        </ActivityProvider>
      </StoreProvider>
    </AppInfoProvider>
  );
}

/** Back from Strava's "Authorise" page: finish connecting, bring in recent activities, and say how it went. */
function useStravaReturn(db: SupabaseClient, store: LiveActivityStore, strava: StravaLink): string | null {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    finishStravaConnect(db)
      .then(async (done) => {
        if (!done) return;
        await store.reload();
        const n = await strava.sync();
        if (live) setNotice(`Strava connected${n ? ` · ${n} activit${n === 1 ? "y" : "ies"} brought in` : ""}`);
      })
      .catch((e: unknown) => live && setNotice(e instanceof Error ? e.message : String(e)));
    return () => { live = false; };
  }, [db, store, strava]);
  return notice;
}
