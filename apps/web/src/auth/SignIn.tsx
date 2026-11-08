import { DEFAULT_AUTH_OPTIONS, friendlyAuthError, inAppBrowser, parseAuthSettings, type AuthOptions, type OAuthProvider } from "@apex/core";
import { Icons, ThemeButton } from "@apex/ui";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { fetchAuthSettings } from "../data/supabase";

export type SignInMode = "signup" | "signin";

type Method = OAuthProvider | "email";
const LAST_KEY = "apex.lastSignIn";
/** How this person signed in last time on this device, to mark that button. Storage may be blocked. */
function lastMethod(): Method | null {
  try { const v = localStorage.getItem(LAST_KEY); return v === "google" || v === "apple" || v === "email" ? v : null; } catch { return null; }
}
function rememberMethod(m: Method) {
  try { localStorage.setItem(LAST_KEY, m); } catch { /* nothing to remember */ }
}

/**
 * Sign-in without waiting for an email: one tap with Google or Apple, or email + password that opens
 * the app straight away. The email link stays as a fallback (forgotten password, no password yet).
 * Every route comes back to this same page, so an invite in the URL survives.
 */
export function SignIn({ db, side, mode: startMode }: { db: SupabaseClient; side: "coach" | "client"; mode?: SignInMode }) {
  const invite = new URLSearchParams(location.search).get("invite");
  const [mode, setMode] = useState<SignInMode>(startMode ?? (invite ? "signup" : "signin"));
  const [opts, setOpts] = useState<AuthOptions>(DEFAULT_AUTH_OPTIONS);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "link-sent" | "confirm-sent" | "error">("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const appBrowser = inAppBrowser(navigator.userAgent);
  const [last] = useState(lastMethod);
  // One-tap buttons lead; the email form opens on request (or straight away when one tap can't work here).
  const [emailOpen, setEmailOpen] = useState(() => !!appBrowser || last === "email");

  useEffect(() => {
    let alive = true;
    void fetchAuthSettings().then((raw) => { if (alive && raw) setOpts(parseAuthSettings(raw)); });
    return () => { alive = false; };
  }, []);

  const fail = (message: string) => { setError(friendlyAuthError(message)); setState("error"); };

  const oauth = async (provider: OAuthProvider) => {
    setState("busy");
    rememberMethod(provider);
    const { error: e } = await db.auth.signInWithOAuth({ provider, options: { redirectTo: location.href } });
    if (e) fail(e.message);
  };

  // A session arriving fires Supabase's SIGNED_IN event, and the gate moves on to the app by itself.
  const withPassword = async () => {
    setState("busy");
    rememberMethod("email");
    const creds = { email: email.trim(), password };
    if (mode === "signin") {
      const { error: e } = await db.auth.signInWithPassword(creds);
      if (e) fail(e.message);
      return;
    }
    const { data, error: e } = await db.auth.signUp({ ...creds, options: { emailRedirectTo: location.href } });
    if (e) return fail(e.message);
    // Email confirmation is still on in Supabase: no session yet, the person has to click the email.
    if (!data.session) setState("confirm-sent");
  };

  const emailLink = async () => {
    if (!email.includes("@")) { setError("Type your email above first, then tap the link option."); setState("error"); return; }
    setState("busy");
    const { error: e } = await db.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: location.href } });
    if (e) fail(e.message); else setState("link-sent");
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); } catch { /* clipboard blocked: the note still tells them what to do */ }
  };

  const busy = state === "busy";
  const sent = state === "link-sent" || state === "confirm-sent";
  const accent = side === "coach" ? "act" : "sec";
  const title = invite ? "You've been invited" : mode === "signup" ? "Create your account" : "Welcome back";
  const providers = opts.providers;
  const showForm = emailOpen || providers.length === 0;
  const tag = (m: Method) => (last === m ? <span className="signin-last">Last used</span> : null);
  const passwordOk = password.length >= 8;
  const canSubmit = email.includes("@") && (mode === "signin" ? password.length > 0 : passwordOk);

  return (
    <div className="sel">
      <div className="wordmark"><Icons.logo /><b>APEX</b></div>
      <div className="card signin" style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14, padding: 22 }}>
        <div>
          <div className="eyebrow" style={{ color: side === "coach" ? "var(--act)" : "var(--data)" }}>{side === "coach" ? "Coach OS" : "Client app"}</div>
          <h1 className="h1" style={{ fontSize: 24 }}>{sent ? "Check your email" : title}</h1>
          <p className="sub">
            {state === "link-sent" ? `We've sent a sign-in link to ${email.trim()}. Open it on this device and you'll come straight back.`
              : state === "confirm-sent" ? `Almost there: open the link we sent to ${email.trim()} to confirm your account.`
              : providers.length ? `One tap with ${providers.map(providerName).join(" or ")}, or use your email and a password.` : "Use your email and a password. No waiting for emails."}
          </p>
        </div>

        {sent ? (
          <button type="button" className="btn ghost block" onClick={() => setState("idle")}>Back</button>
        ) : (
          <>
            {appBrowser && providers.length > 0 && (
              <div className="signin-note" role="note">
                <Icons.info width={16} height={16} aria-hidden="true" />
                <div>
                  <b>Opened inside {appBrowser}?</b> {providerName(providers[0] ?? "google")} sign-in only works in Safari or Chrome. Open this page there, or use email and password below.
                  <button type="button" className="link" onClick={() => void copyLink()} style={{ display: "block", marginTop: 6 }}>{copied ? "Link copied" : "Copy this page's link"}</button>
                </div>
              </div>
            )}

            {providers.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {providers.includes("google") && (
                  <button type="button" className="btn ghost block signin-provider" onClick={() => void oauth("google")} disabled={busy}>
                    <GoogleMark /> Continue with Google{tag("google")}
                  </button>
                )}
                {providers.includes("apple") && (
                  <button type="button" className="btn ghost block signin-provider" onClick={() => void oauth("apple")} disabled={busy}>
                    <AppleMark /> Continue with Apple{tag("apple")}
                  </button>
                )}
                {opts.password && !showForm && (
                  <button type="button" className="btn ghost block signin-provider" onClick={() => setEmailOpen(true)} disabled={busy}>
                    <Icons.mail width={18} height={18} aria-hidden="true" /> Continue with email{tag("email")}
                  </button>
                )}
                {showForm && opts.password && <div className="signin-or" aria-hidden="true"><span>or</span></div>}
              </div>
            )}

            {opts.password && showForm && (
              <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) void withPassword(); }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {opts.signUpOpen && (
                  <div className="seg" role="tablist" aria-label="Account">
                    <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "on" : ""} onClick={() => { setMode("signup"); setState("idle"); }}>Create account</button>
                    <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "on" : ""} onClick={() => { setMode("signin"); setState("idle"); }}>Sign in</button>
                  </div>
                )}
                <label className="small" htmlFor="email">Email</label>
                <input id="email" className="field" type="email" autoFocus={emailOpen && !appBrowser} autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                <label className="small" htmlFor="password">Password</label>
                <div className="signin-pass">
                  <input id="password" className="field" type={show ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} />
                  <button type="button" className="signin-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
                    {show ? <Icons.eyeOff width={18} height={18} /> : <Icons.eye width={18} height={18} />}
                  </button>
                </div>
                {mode === "signup" && password.length > 0 && (
                  <p className={`tiny signin-hint${passwordOk ? " ok" : ""}`} style={{ margin: 0 }}>
                    {passwordOk ? <><Icons.check width={14} height={14} aria-hidden="true" /> Good length</> : `${8 - password.length} more character${8 - password.length === 1 ? "" : "s"}`}
                  </p>
                )}
                <button className={`btn ${accent} block`} disabled={busy || !canSubmit}>
                  {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
                </button>
              </form>
            )}

            {state === "error" && <p className="small" role="alert" style={{ color: "var(--crit)", margin: 0 }}>{error}</p>}

            {showForm && <button type="button" className="link small" onClick={() => void emailLink()} disabled={busy} style={{ alignSelf: "flex-start" }}>
              {mode === "signin" ? "Forgot your password? Email me a sign-in link" : "Rather not use a password? Email me a sign-in link"}
            </button>}
            <p className="tiny" style={{ margin: 0 }}>By continuing you agree to the <a className="link" href="/legal/#terms" target="_blank" rel="noopener">terms</a> and confirm you've read the <a className="link" href="/legal/#privacy" target="_blank" rel="noopener">privacy policy</a>.</p>
          </>
        )}
      </div>
      <div className="row">
        <a className="link" href={`/${side}/?demo`}>Try the demo instead</a>
        <ThemeButton />
      </div>
    </div>
  );
}

const providerName = (p: OAuthProvider) => (p === "google" ? "Google" : "Apple");

/** Google's "G" in its own colours, which Google's sign-in branding rules require on the button. */
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
