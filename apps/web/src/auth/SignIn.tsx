import { Icons, ThemeButton } from "@apex/ui";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";

/** Passwordless sign-in: one tap with Google or Apple, or an email link that brings the user straight back here. */
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

  // Comes back to this same page (invite token included), like the email link.
  const oauth = async (provider: "google" | "apple") => {
    setState("sending");
    const { error: e } = await db.auth.signInWithOAuth({ provider, options: { redirectTo: location.href } });
    if (e) { setError(e.message); setState("error"); }
  };

  return (
    <div className="sel">
      <div className="wordmark"><Icons.logo /><b>APEX</b></div>
      <div className="card" style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14, padding: 22 }}>
        <div>
          <div className="eyebrow" style={{ color: side === "coach" ? "var(--act)" : "var(--data)" }}>{side === "coach" ? "Coach OS" : "Client app"}</div>
          <h1 className="h1" style={{ fontSize: 24 }}>{invite ? "You've been invited" : "Sign in"}</h1>
          <p className="sub">{state === "sent" ? `Check ${email.trim()} for your sign-in link. You can close this tab.` : "One tap with Google or Apple, or we'll email you a link. No password needed."}</p>
        </div>
        {state !== "sent" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" className="btn ghost block" onClick={() => void oauth("google")} disabled={state === "sending"}>
              <GoogleMark /> Continue with Google
            </button>
            <button type="button" className="btn ghost block" onClick={() => void oauth("apple")} disabled={state === "sending"}>
              <AppleMark /> Continue with Apple
            </button>
            <p className="small" style={{ margin: 0, textAlign: "center", color: "var(--text3)" }}>or</p>
          </div>
        )}
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

/** Google's "G", which Google's sign-in branding rules require on the button. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.9-6.2C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** Apple's logo in the text colour, as Apple's sign-in guidelines ask. */
function AppleMark() {
  return (
    <svg width="16" height="18" viewBox="0 0 17 20" aria-hidden="true" fill="currentColor">
      <path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM11.6 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" />
    </svg>
  );
}
