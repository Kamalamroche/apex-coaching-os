import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export interface Profile {
  id: string;
  role: "coach" | "client";
  full_name: string;
}

export type AuthState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "no-profile"; session: Session }
  | { kind: "ready"; session: Session; profile: Profile };

/** Session plus the user's APEX profile, kept in sync with Supabase Auth. */
export function useAuth(db: SupabaseClient): [AuthState, () => void] {
  const [state, setState] = useState<AuthState>({ kind: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const resolve = async (session: Session | null) => {
      if (!session) return alive && setState({ kind: "signed-out" });
      const { data } = await db.from("profiles").select("id, role, full_name").eq("id", session.user.id).maybeSingle<Profile>();
      if (!alive) return;
      setState(data ? { kind: "ready", session, profile: data } : { kind: "no-profile", session });
    };
    void db.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: sub } = db.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void resolve(session);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [db, tick]);
  return [state, () => setTick((t) => t + 1)];
}
