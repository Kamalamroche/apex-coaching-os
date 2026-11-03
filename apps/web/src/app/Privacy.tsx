import {
  CONSENT_TEXT, DELETE_WORD, LEGAL_VERSION, deleteConfirmed, deletionEffects, exportFileName, healthWithdrawn, legalDateLabel, localDate, missingConsents, requiredConsents,
  type ConsentKind, type ConsentRecord,
} from "@apex/core";
import { Icons } from "@apex/ui";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PRIVACY_NEEDS_UPDATE, usePrivacyApi, type PrivacyApi } from "../data/privacy";
import { useAppInfo } from "./AppContext";
import { Splash } from "./Gate";

type Loaded = { status: "loading" } | { status: "ready"; given: ConsentRecord[] } | { status: "needs-update" } | { status: "error"; error: string };

function useConsents(api: PrivacyApi | null): [Loaded, () => Promise<void>] {
  const [s, setS] = useState<Loaded>({ status: "loading" });
  const reload = useCallback(async () => {
    if (!api) return;
    try {
      setS({ status: "ready", given: await api.consents() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setS(msg === PRIVACY_NEEDS_UPDATE ? { status: "needs-update" } : { status: "error", error: msg });
    }
  }, [api]);
  useEffect(() => void reload(), [reload]);
  return [s, reload];
}

const LEGAL = { privacy: "/legal/#privacy", terms: "/legal/#terms" };

/** Shows the agreement screen until the person has agreed to everything their role needs for this version. */
export function PrivacyGate({ children }: { children: ReactNode }) {
  const api = usePrivacyApi();
  const [s, reload] = useConsents(api);
  if (!api) return <>{children}</>;
  if (s.status === "loading") return <Splash />;
  // Before the privacy SQL is run, the app carries on as before rather than locking everyone out.
  if (s.status === "needs-update") return <>{children}</>;
  if (s.status === "error") {
    return (
      <Splash>
        <div className="card stack" style={{ width: "100%", maxWidth: 440, padding: 22 }}>
          <h1 className="h1" style={{ fontSize: 22 }}>Couldn't check your account</h1>
          <p className="small" role="alert">{s.error}</p>
          <button className="btn act block" onClick={() => void reload()}>Try again</button>
        </div>
      </Splash>
    );
  }
  const missing = missingConsents(api.role, s.given);
  if (missing.length) return <ConsentScreen api={api} missing={missing} withdrawn={healthWithdrawn(s.given)} onDone={reload} />;
  return <>{children}</>;
}

function ConsentScreen({ api, missing, withdrawn, onDone }: { api: PrivacyApi; missing: ConsentKind[]; withdrawn: boolean; onDone: () => Promise<void> }) {
  const [ticked, setTicked] = useState<Partial<Record<ConsentKind, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const firstTime = missing.length === requiredConsents(api.role).length && !withdrawn;
  const all = missing.every((k) => ticked[k]);
  const agree = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.give(missing);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <div className="sel">
      <div className="wordmark"><Icons.logo /><b>APEX</b></div>
      <div className="card stack" style={{ width: "100%", maxWidth: 480, padding: 22 }}>
        <div>
          <div className="eyebrow">Your privacy</div>
          <h1 className="h1" style={{ fontSize: 24 }}>{withdrawn ? "Health information is switched off" : firstTime ? "Before you start" : "We've updated our terms"}</h1>
          <p className="sub">
            {withdrawn
              ? "You withdrew your agreement for your health information, so APEX can't coach you with it. Agree again to carry on, or delete your account."
              : firstTime
                ? "Please read and tick each one. Your health information is only ever used to coach you."
                : `Please read and agree to the version from ${legalDateLabel()} to carry on.`}
          </p>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {missing.map((k) => (
            <label key={k} className={`consent ${ticked[k] ? "on" : ""}`}>
              <input type="checkbox" checked={!!ticked[k]} onChange={(e) => setTicked((t) => ({ ...t, [k]: e.target.checked }))} />
              <span><b className="h3">{CONSENT_TEXT[k].title}</b><span className="small">{CONSENT_TEXT[k].body}</span></span>
            </label>
          ))}
        </div>
        <div className="row small" style={{ gap: 14 }}>
          <a className="link" href={LEGAL.privacy} target="_blank" rel="noopener">Privacy policy</a>
          <a className="link" href={LEGAL.terms} target="_blank" rel="noopener">Terms of use</a>
        </div>
        {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
        <button className={`btn ${api.role === "coach" ? "act" : "sec"} block`} disabled={!all || busy} onClick={() => void agree()}>{busy ? "Saving…" : "Agree and continue"}</button>
        {withdrawn && !deleting && <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => setDeleting(true)}>Delete my account instead</button>}
        {deleting && <DeleteAccount api={api} coachName="" onCancel={() => setDeleting(false)} />}
      </div>
      {api.live && <SignOutLink />}
    </div>
  );
}

function SignOutLink() {
  const { signOut } = useAppInfo();
  return signOut ? <button className="link" onClick={signOut}>Sign out</button> : null;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Privacy and account: what you agreed to, a copy of your data, and deleting your account. */
export function AccountScreen({ say }: { say: (m: string) => void }) {
  const api = usePrivacyApi();
  const { coachName } = useAppInfo();
  const [s, reload] = useConsents(api);
  const [busy, setBusy] = useState<"export" | "withdraw" | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!api) return null;
  const given = s.status === "ready" ? s.given.filter((g) => g.version === LEGAL_VERSION || g.kind === "health") : [];
  const active = (k: ConsentKind) => given.find((g) => g.kind === k && !g.withdrawnAt);

  const exportData = async () => {
    setBusy("export");
    setError(null);
    try {
      const data = await api.exportData();
      download(exportFileName(api.name, localDate(new Date())), JSON.stringify(data, null, 2));
      say("Your data is downloading");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg === PRIVACY_NEEDS_UPDATE ? "This needs the privacy SQL in Supabase first." : msg);
    }
    setBusy(null);
  };
  const withdraw = async () => {
    setBusy("withdraw");
    setError(null);
    try {
      await api.withdraw("health");
      // The gate takes over on the next load: agree again or delete.
      location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  return (
    <>
      <div className="full"><div className="eyebrow">Privacy and account</div><h1 className="h1">Your account</h1></div>
      <section className="card flat list full">
        <div className="li"><div className="grow"><div className="h3">{api.name}</div><div className="small">{api.email} · {api.role === "coach" ? "Coach" : "Client"} account{api.live ? "" : " · demo"}</div></div></div>
      </section>

      <section className="card stack full">
        <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">What you agreed to</h3><span className="tiny">Version {legalDateLabel()}</span></div>
        {s.status === "needs-update" && <div className="small">Agreements switch on once the privacy SQL is run in Supabase.</div>}
        {s.status === "error" && <div className="small" role="alert">{s.error} <button className="link" onClick={() => void reload()}>Try again</button></div>}
        {s.status === "ready" && (
          <div className="card flat list">
            {requiredConsents(api.role).map((k) => {
              const g = active(k);
              return (
                <div key={k} className="li">
                  <Icons.check width={16} height={16} style={{ color: g ? "var(--good)" : "var(--text3)", flex: "none" }} />
                  <div className="grow"><div className="h3">{CONSENT_TEXT[k].title}</div><div className="tiny">{g ? `Agreed ${new Date(g.givenAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "Not agreed"}</div></div>
                  {k === "health" && g && !confirmWithdraw && <button className="iconbtn" onClick={() => setConfirmWithdraw(true)}>Withdraw</button>}
                </div>
              );
            })}
          </div>
        )}
        {confirmWithdraw && (
          <div className="pv-warn stack" style={{ gap: 10 }}>
            <div className="small">Withdrawing means APEX stops using your health information, so {coachName || "your coach"} can't coach you here until you agree again. Nothing is deleted. To remove everything, delete your account below.</div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn ghost sm" onClick={() => setConfirmWithdraw(false)}>Keep it</button>
              <button className="btn sm pv-crit" disabled={busy === "withdraw"} onClick={() => void withdraw()}>{busy === "withdraw" ? "Withdrawing…" : "Withdraw"}</button>
            </div>
          </div>
        )}
        <div className="row small" style={{ gap: 14 }}>
          <a className="link" href={LEGAL.privacy} target="_blank" rel="noopener">Privacy policy</a>
          <a className="link" href={LEGAL.terms} target="_blank" rel="noopener">Terms of use</a>
        </div>
      </section>

      <section className="card stack full">
        <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Your data</h3></div>
        <div className="small">Download a copy of everything stored about you{api.role === "client" ? ": workouts, check-ins, measurements, messages and more" : ": your programs, client list, messages and more"}, as a file you can keep or take elsewhere.{api.role === "client" ? " Photos and videos stay in the app; ask us if you want copies." : ""}</div>
        <button className="btn ghost block" disabled={busy === "export"} onClick={() => void exportData()}><Icons.file width={15} height={15} /> {busy === "export" ? "Preparing…" : "Download my data"}</button>
      </section>

      {error && <div className="small full" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}

      <section className="card stack full">
        <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Delete your account</h3></div>
        {!deleting ? (
          <>
            <div className="small">Removes your account and everything in it, for good.</div>
            <button className="btn block pv-crit-ghost" onClick={() => setDeleting(true)}>Delete my account…</button>
          </>
        ) : (
          <DeleteAccount api={api} coachName={coachName} onCancel={() => setDeleting(false)} />
        )}
      </section>
    </>
  );
}

function DeleteAccount({ api, coachName, onCancel }: { api: PrivacyApi; coachName: string; onCancel: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount();
      setDone(true);
      setTimeout(() => location.assign(api.live ? "/" : `/${api.role}/?demo`), 2500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg === PRIVACY_NEEDS_UPDATE ? "This needs the privacy SQL in Supabase first." : msg);
      setBusy(false);
    }
  };
  if (done) return <div className="small" role="status">{api.live ? "Your account has been deleted. Thanks for training with APEX." : "Demo data cleared. Starting fresh…"}</div>;
  return (
    <div className="pv-warn stack" style={{ gap: 10 }}>
      <div className="h3">This deletes, for good:</div>
      <ul className="small pv-list">
        {deletionEffects(api.role, coachName).map((x) => <li key={x}>{x}</li>)}
      </ul>
      <div className="small">Want a copy first? Use Download my data above.{api.live ? "" : " In the demo, this clears the sample data in this browser."}</div>
      <label className="small" htmlFor="pv-confirm">Type {DELETE_WORD} to confirm</label>
      <input id="pv-confirm" className="field" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
      {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost sm" onClick={onCancel}>Cancel</button>
        <button className="btn sm pv-crit" disabled={!deleteConfirmed(typed) || busy} onClick={() => void go()}>{busy ? "Deleting…" : "Delete my account"}</button>
      </div>
    </div>
  );
}
