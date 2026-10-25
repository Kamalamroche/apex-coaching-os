import { useEffect, useMemo, useState } from "react";
import { AppInfoProvider } from "../app/AppContext";
import { Splash, type Live } from "../app/Gate";
import { StoreProvider } from "../data/StoreContext";
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
        <ClientApp />
      </StoreProvider>
    </AppInfoProvider>
  );
}
