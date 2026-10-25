import { createDemoStore, type ApexStore } from "@apex/core";
import { Icons } from "@apex/ui";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState, type ReactNode } from "react";
import { Onboarding } from "../auth/Onboarding";
import { SignIn } from "../auth/SignIn";
import { useAuth, type Profile } from "../auth/useAuth";
import { StoreProvider } from "../data/StoreContext";
import { isDemo, supabase } from "../data/supabase";
import { AppInfoProvider } from "./AppContext";

const demoStore: { current: ApexStore | null } = { current: null };

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
  if (isDemo() || !supabase) {
    demoStore.current ??= createDemoStore();
    return (
      <AppInfoProvider info={{ mode: "demo", coachName: "Kamal", clientName: "Priya Sharma" }}>
        <StoreProvider store={demoStore.current}>{demo()}</StoreProvider>
      </AppInfoProvider>
    );
  }
  return <LiveGate db={supabase} side={side} live={live} />;
}

function LiveGate({ db, side, live }: { db: SupabaseClient; side: "coach" | "client"; live: (l: Live) => ReactNode }) {
  const [auth, refresh] = useAuth(db);
  const invite = useInviteForExistingClient(db, auth.kind === "ready" ? auth.profile : null);
  const signOut = () => void db.auth.signOut();

  if (auth.kind === "loading" || invite === "pending") return <Splash />;
  if (auth.kind === "signed-out") return <SignIn db={db} side={side} />;
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
  return <>{live({ db, profile: auth.profile, signOut })}</>;
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
