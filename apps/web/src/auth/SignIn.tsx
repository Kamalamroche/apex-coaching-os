import { Icons, ThemeButton } from "@apex/ui";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";

/** Passwordless sign-in: the user gets an email link that brings them straight back here. */
export function SignIn({ db, side }: { db: SupabaseClient; side: "coach" | "client" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const invite = new URLSearchParams(location.search).get("invite");

  const send = async () => {
    setState("sending");
    const { error: e } = await db.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: location.href } });
    if (e) { setError(e.message); setState("error"); } else setState("sent");
  };

  return (
    <div className="sel">
      <div className="wordmark"><Icons.logo /><b>APEX</b></div>
      <div className="card" style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14, padding: 22 }}>
        <div>
          <div className="eyebrow" style={{ color: side === "coach" ? "var(--act)" : "var(--data)" }}>{side === "coach" ? "Coach OS" : "Client app"}</div>
          <h1 className="h1" style={{ fontSize: 24 }}>{invite ? "You've been invited" : "Sign in"}</h1>
          <p className="sub">{state === "sent" ? `Check ${email.trim()} for your sign-in link. You can close this tab.` : "We'll email you a link. No password needed."}</p>
        </div>
        {state !== "sent" && (
          <form onSubmit={(e) => { e.preventDefault(); void send(); }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="small" htmlFor="email">Email</label>
            <input id="email" className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <button className={`btn ${side === "coach" ? "act" : "sec"} block`} disabled={state === "sending" || !email.includes("@")}>{state === "sending" ? "Sending…" : "Email me a sign-in link"}</button>
            {state === "error" && <p className="small" role="alert" style={{ color: "var(--crit)", margin: 0 }}>{error}</p>}
          </form>
        )}
      </div>
      <div className="row">
        <a className="link" href={`/${side}/?demo`}>Try the demo instead</a>
        <ThemeButton />
      </div>
    </div>
  );
}
