import { Icons } from "@apex/ui";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";

/** First sign-in: create the profile for this side of the app, and for a client, accept the invite. */
export function Onboarding({ db, session, side, onDone }: { db: SupabaseClient; session: Session; side: "coach" | "client"; onDone: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const invite = new URLSearchParams(location.search).get("invite");
  const blocked = side === "client" && !invite;

  const save = async () => {
    setBusy(true);
    setError("");
    // The write only passes the database's checks when it carries the sign-in token,
    // so make sure Supabase still has the session before asking it to save.
    if (!(await hasSession(db))) {
      setError("Your sign-in didn't carry over to this page. Open the sign-in link in your normal browser, or sign in again.");
      setBusy(false);
      return;
    }
    const { error: e1 } = await db.from("profiles").insert({ id: session.user.id, role: side, full_name: name.trim() });
    if (e1) { setError(e1.message); setBusy(false); return; }
    if (side === "client" && invite) {
      const { error: e2 } = await db.rpc("accept_invite", { p_token: invite });
      if (e2) { setError(e2.message); setBusy(false); return; }
    }
    onDone();
  };

  return (
    <div className="sel">
      <div className="wordmark"><Icons.logo /><b>APEX</b></div>
      <div className="card" style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14, padding: 22 }}>
        {blocked ? (
          <>
            <h1 className="h1" style={{ fontSize: 24 }}>Ask your coach for an invite</h1>
            <p className="sub">Client accounts are set up from your coach's invite link. Open the link they sent you and you'll come straight back here.</p>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void save(); }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h1 className="h1" style={{ fontSize: 24 }}>{side === "coach" ? "Set up your coach account" : "Welcome to APEX"}</h1>
            <p className="sub">Signed in as {session.user.email}. What should we call you?</p>
            <label className="small" htmlFor="fullname">Your name</label>
            <input id="fullname" className="field" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
            <button className={`btn ${side === "coach" ? "act" : "sec"} block`} disabled={busy || name.trim().length < 2}>{busy ? "Saving…" : "Continue"}</button>
            {error && <p className="small" role="alert" style={{ color: "var(--crit)", margin: 0 }}>{error}</p>}
          </form>
        )}
        <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => void db.auth.signOut()}>Sign out</button>
      </div>
    </div>
  );
}

/** True when Supabase can still read the signed-in session, refreshing it once if needed. */
async function hasSession(db: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await db.auth.getSession();
    if (data.session) return true;
    const { data: refreshed } = await db.auth.refreshSession();
    return Boolean(refreshed.session);
  } catch {
    return false;
  }
}
