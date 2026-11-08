import { createDemoActivityStore, createDemoFormCheckStore, createDemoGoalStore, createDemoLifestyleStore, createDemoStore, type ActivityStore, type ApexStore, type FormCheckStore, type GoalStore, type LifestyleStore } from "@apex/core";
import { Icons } from "@apex/ui";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Onboarding } from "../auth/Onboarding";
import { SignIn } from "../auth/SignIn";
import { Welcome, welcomeSeen } from "../auth/Welcome";
import { Intro, introSeen } from "../auth/Intro";
import { useAuth, type Profile } from "../auth/useAuth";
import { ActivityProvider } from "../data/ActivityContext";
import { FormCheckProvider } from "../data/FormCheckContext";
import { GoalProvider } from "../data/GoalContext";
import { BookingProvider, demoBookings, type BookingApi } from "../data/bookings";
import { ChallengeProvider, demoChallenges, type ChallengeApi } from "../data/challenges";
import { TeamProvider, demoTeam, type TeamApi } from "../data/team";
import { GrowthProvider, demoGrowth, type GrowthApi } from "../data/growth";
import { ResourceProvider, demoResources } from "../data/resources";
import { NotesProvider, demoNotes } from "../data/clientNotes";
import { LifestyleProvider } from "../data/LifestyleContext";
import { StoreProvider } from "../data/StoreContext";
import { demoStravaLink } from "../data/strava";
import { demoWearableLink } from "../data/wearables";
import { isDemo, supabase } from "../data/supabase";
import { AppInfoProvider } from "./AppContext";
import { PrivacyProvider, demoPrivacy, livePrivacy, type PrivacyApi } from "../data/privacy";
import { PrivacyGate } from "./Privacy";
import { TwinProvider, demoTwin, type TwinApi } from "../data/twin";

const demoStore: { current: ApexStore | null } = { current: null };
const demoActivities: { current: ActivityStore | null } = { current: null };
const demoLifestyle: { current: LifestyleStore | null } = { current: null };
const demoFormChecks: { current: FormCheckStore | null } = { current: null };
const demoGoals: { current: GoalStore | null } = { current: null };
const demoBookingApi: { current: BookingApi | null } = { current: null };
const demoChallengeApis: Partial<Record<"coach" | "client", ChallengeApi>> = {};
const demoTeamApis: Partial<Record<"coach" | "client", TeamApi>> = {};
const demoGrowthApis: Partial<Record<"coach" | "client", GrowthApi>> = {};
const demoResourceApi = demoResources();
const demoNotesApi = demoNotes();
const demoTwinApi: { current: TwinApi | null } = { current: null };
const demoPrivacyApis: Partial<Record<"coach" | "client", PrivacyApi>> = {};

export interface Live {
  db: SupabaseClient;
  profile: Profile;
  signOut: () => void;
}

/**
 * Decides demo vs live for a page. Demo: sample data in localStorage. Live: sign in,
 * create a profile on first visit, then hand the signed-in profile to the app.
 */
export function Gate({ side, demo, live }: { side: "coach" | "client"; demo: () => ReactNode; live: (l: Live) => ReactNode }) {
  const [welcomed, setWelcomed] = useState(() => side !== "client" || welcomeSeen());
  const [introDone, setIntroDone] = useState(() => side !== "client" || introSeen());
  if (isDemo() || !supabase) {
    if (!welcomed && !introDone) return <Intro onDone={() => setIntroDone(true)} />;
    if (!welcomed) return <Welcome demo onContinue={() => setWelcomed(true)} />;
    demoStore.current ??= createDemoStore();
    demoActivities.current ??= createDemoActivityStore();
    demoLifestyle.current ??= createDemoLifestyleStore();
    demoFormChecks.current ??= createDemoFormCheckStore((b) => URL.createObjectURL(b));
    demoGoals.current ??= createDemoGoalStore();
    demoBookingApi.current ??= demoBookings();
    demoChallengeApis[side] ??= demoChallenges(side);
    demoTeamApis[side] ??= demoTeam(side);
    demoGrowthApis[side] ??= demoGrowth(side);
    demoTwinApi.current ??= demoTwin(() => demoStore.current as ApexStore);
    demoPrivacyApis[side] ??= demoPrivacy(side, side === "coach" ? "Kamal" : "Priya Sharma");
    return (
      <AppInfoProvider info={{ mode: "demo", coachName: "Kamal", clientName: "Priya Sharma" }}>
        <StoreProvider store={demoStore.current}>
          <ActivityProvider store={demoActivities.current} strava={demoStravaLink(demoActivities.current)} wearables={demoWearableLink(demoActivities.current)} editable={side === "client"}><LifestyleProvider store={demoLifestyle.current}><FormCheckProvider store={demoFormChecks.current}><GoalProvider store={demoGoals.current}><BookingProvider value={demoBookingApi.current}><ChallengeProvider value={demoChallengeApis[side] ?? null}><TeamProvider value={demoTeamApis[side] ?? null}><GrowthProvider value={demoGrowthApis[side] ?? null}><ResourceProvider value={demoResourceApi}><NotesProvider value={side === "coach" ? demoNotesApi : null}><PrivacyProvider value={demoPrivacyApis[side] ?? null}><PrivacyGate><TwinProvider value={side === "coach" ? demoTwinApi.current : null}>{demo()}</TwinProvider></PrivacyGate></PrivacyProvider></NotesProvider></ResourceProvider></GrowthProvider></TeamProvider></ChallengeProvider></BookingProvider></GoalProvider></FormCheckProvider></LifestyleProvider></ActivityProvider>
        </StoreProvider>
      </AppInfoProvider>
    );
  }
  return <LiveGate db={supabase} side={side} live={live} welcome={welcomed ? null : !introDone ? <Intro onDone={() => setIntroDone(true)} /> : <Welcome demo={false} onContinue={() => setWelcomed(true)} />} />;
}

function LiveGate({ db, side, live, welcome }: { db: SupabaseClient; side: "coach" | "client"; live: (l: Live) => ReactNode; welcome: ReactNode }) {
  const [auth, refresh] = useAuth(db);
  const invite = useInviteForExistingClient(db, auth.kind === "ready" ? auth.profile : null);
  const signOut = () => void db.auth.signOut();

  if (auth.kind === "loading" || invite === "pending") return <Splash />;
  if (auth.kind === "signed-out") return welcome ?? <SignIn db={db} side={side} />;
  if (auth.kind === "no-profile") return <Onboarding db={db} session={auth.session} side={side} onDone={refresh} />;
  if (auth.profile.role !== side) {
    const other = auth.profile.role;
    return (
      <Splash>
        <h1 className="h1" style={{ fontSize: 22 }}>This is a {other} account</h1>
        <p className="sub">Signed in as {auth.session.user.email}.</p>
        <div className="row"><a className="btn act" href={`/${other}/`}>Open the {other === "coach" ? "Coach OS" : "client app"}</a><button className="btn ghost" onClick={signOut}>Sign out</button></div>
      </Splash>
    );
  }
  return <LiveReady db={db} profile={auth.profile} email={auth.session.user.email ?? ""} signOut={signOut} live={live} />;
}

/** Signed in with the right kind of account: check the person's agreements, then open the app. */
function LiveReady({ db, profile, email, signOut, live }: { db: SupabaseClient; profile: Profile; email: string; signOut: () => void; live: (l: Live) => ReactNode }) {
  const privacy = useMemo(() => livePrivacy(db, { id: profile.id, role: profile.role, name: profile.full_name, email }), [db, profile.id, profile.role, profile.full_name, email]);
  return (
    <AppInfoProvider info={{ mode: "live", coachName: "", clientName: "", signOut }}>
      <PrivacyProvider value={privacy}>
        <PrivacyGate>{live({ db, profile, signOut })}</PrivacyGate>
      </PrivacyProvider>
    </AppInfoProvider>
  );
}

/** An existing client opening a new coach's invite link: accept it, then drop it from the URL. */
function useInviteForExistingClient(db: SupabaseClient, profile: Profile | null): "pending" | "done" {
  const token = new URLSearchParams(location.search).get("invite");
  const [state, setState] = useState<"pending" | "done">(token ? "pending" : "done");
  useEffect(() => {
    if (!token || !profile) return;
    const clear = () => { history.replaceState(null, "", location.pathname); setState("done"); };
    if (profile.role !== "client") return clear();
    void db.rpc("accept_invite", { p_token: token }).then(clear);
  }, [db, profile, token]);
  return profile || !token ? state : "done";
}

export function Splash({ children }: { children?: ReactNode }) {
  return (
    <div className="sel">
      <div className="wordmark"><Icons.logo /><b>APEX</b></div>
      {children ?? <p className="tiny" style={{ letterSpacing: ".2em" }}>LOADING…</p>}
    </div>
  );
}
