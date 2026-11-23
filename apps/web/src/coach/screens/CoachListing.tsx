import {
  CREDENTIAL_HINT, CREDENTIAL_ISSUER_MAX, CREDENTIAL_LABEL, CREDENTIAL_STATUS_LABEL, CREDENTIAL_TITLE_MAX, REJECT_NOTE_MAX, credentialProblem, expiringSoon, isVerified, directoryProblem, verifySteps,
  type CoachPage, type Credential, type CredentialDraft, type CredentialKind, type CredentialReview,
} from "@apex/core";
import { Icons, Sheet, VerifiedBadge } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { demoListing, liveListing, type ListingApi } from "../../data/marketplace";
import { isDemo, supabase } from "../../data/supabase";
import { localToday } from "./CoachLeads";

/** Coach: join Find a trainer, and send certificates for the verified badge. The APEX team also check certificates here. */
export function CoachListing({ page, say, onSetUp }: { page: CoachPage; say: (m: string) => void; onSetUp: () => void }) {
  const [api, setApi] = useState<ListingApi | null>(null);
  const [listed, setListed] = useState<boolean | null>(null);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [checker, setChecker] = useState(false);
  const [adding, setAdding] = useState<CredentialKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = localToday();

  useEffect(() => {
    if (isDemo() || !supabase) { setApi(demoListing()); return; }
    const db = supabase;
    void db.auth.getUser().then(({ data }) => { if (data.user) setApi(liveListing(db, data.user.id)); });
  }, []);
  const reload = useCallback(async () => {
    if (!api) return;
    try {
      const [l, c, k] = await Promise.all([api.listed(), api.credentials(), api.isChecker()]);
      setListed(l); setCreds(c); setChecker(k); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);

  if (!api || (listed === null && !error)) return <div className="card small">Loading…</div>;
  if (error) return <div className="card small" role="alert">{error}</div>;

  const problem = directoryProblem(page);
  const verified = isVerified(creds, today);
  const steps = verifySteps(creds, today);
  const soon = expiringSoon(creds, today);
  const toggle = async () => {
    setBusy(true);
    try { await api.setListed(!listed); say(listed ? "You're out of Find a trainer" : "You're in Find a trainer"); await reload(); }
    catch (e) { say(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const remove = async (c: Credential) => {
    try { await api.removeCredential(c); say("Certificate removed"); await reload(); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
  };
  const open = async (c: Credential) => {
    const url = await api.fileUrl(c.id);
    if (url) window.open(url, "_blank", "noopener"); else say("The file opens in the live app");
  };

  return (
    <>
      <section className="card stack" style={{ gap: 12 }}>
        <div className="sect" style={{ marginBottom: 0 }}>
          <h2 className="h3">Find a trainer</h2>
          <a className="btn ghost sm" style={{ textDecoration: "none" }} href="/trainers/" target="_blank" rel="noreferrer"><Icons.globe width={14} height={14} /> Open</a>
        </div>
        <p className="small" style={{ margin: 0 }}>The APEX directory where people look for a trainer by goal, place and price. Enquiries land in your Leads, tagged Find a trainer or Match quiz.</p>
        {problem && !listed ? (
          <div className="row" style={{ gap: 10 }}>
            <Icons.info width={16} height={16} style={{ color: "var(--warn)", flex: "none" }} />
            <span className="small grow">{problem}</span>
            <button className="btn ghost sm" onClick={onSetUp}>Edit page</button>
          </div>
        ) : (
          <label className="row" style={{ gap: 12, alignItems: "flex-start" }}>
            <input type="checkbox" role="switch" checked={!!listed} disabled={busy} onChange={() => void toggle()} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
            <span className="grow"><b className="small" style={{ color: "var(--text)" }}>List me in Find a trainer</b><br /><span className="tiny">Your name, headline, city, specialties, starting price and approved reviews show. Free while APEX grows.</span></span>
          </label>
        )}
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <div className="sect" style={{ marginBottom: 0 }}>
          <h2 className="h3">Verified badge</h2>
          {verified && <VerifiedBadge />}
        </div>
        <p className="small" style={{ margin: 0 }}>People trust a trainer whose qualification and insurance are checked. Send both and the APEX team checks them, usually within 2 working days.</p>
        <ul className="ft-steps">
          {steps.map((s) => (
            <li key={s.kind} className={s.done ? "done" : ""}>
              <span className="dot"><Icons.check width={14} height={14} /></span>
              <span className="grow">{s.text}</span>
              {!s.done && !creds.some((c) => c.kind === s.kind && c.status === "pending") && <button className="btn act sm" onClick={() => setAdding(s.kind)}><Icons.upload width={14} height={14} /> Add</button>}
            </li>
          ))}
        </ul>
        {soon.map((c) => <p key={c.id} className="small" role="status" style={{ margin: 0, color: "var(--warn)" }}>{c.title} runs out on {new Date(`${c.expires}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}. Upload the renewal to keep your badge.</p>)}
        {creds.length > 0 && (
          <div>
            {creds.map((c) => (
              <div key={c.id} className="ft-cred">
                <Icons.file width={18} height={18} style={{ color: "var(--text2)", flex: "none", marginTop: 2 }} />
                <div className="grow">
                  <b>{c.title}</b>
                  <span className="tiny">{CREDENTIAL_LABEL[c.kind]} · {c.issuer}{c.expires ? ` · until ${new Date(`${c.expires}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}</span>
                  {c.status === "rejected" && c.note && <span className="tiny" style={{ color: "var(--crit)" }}>{c.note}</span>}
                  <div className="row" style={{ gap: 6, marginTop: 4 }}>
                    {api.live && <button className="btn ghost sm" onClick={() => void open(c)}>Open</button>}
                    <button className="btn ghost sm" onClick={() => void remove(c)}>Remove</button>
                  </div>
                </div>
                <span className={`ft-status ${c.status}`}>{CREDENTIAL_STATUS_LABEL[c.status]}</span>
              </div>
            ))}
          </div>
        )}
        <button className="btn ghost" onClick={() => setAdding("first_aid")}><Icons.plus width={14} height={14} /> Add another certificate</button>
        <p className="tiny" style={{ margin: 0 }}>Files stay private: only you and the APEX team who check them can open them. Your page shows the qualification name, never the file or your insurance details.</p>
      </section>

      {checker && <CheckQueue api={api} say={say} onChanged={reload} />}

      {adding && <AddCredential kind={adding} api={api} today={today} say={say} onClose={() => setAdding(null)} onDone={() => { setAdding(null); void reload(); }} />}
    </>
  );
}

function AddCredential({ kind: start, api, today, say, onClose, onDone }: { kind: CredentialKind; api: ListingApi; today: string; say: (m: string) => void; onClose: () => void; onDone: () => void }) {
  const [d, setD] = useState<CredentialDraft>({ kind: start, title: start === "qualification" ? "Level 3 Personal Trainer" : "", issuer: "", expires: null });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<CredentialDraft>) => { setD((x) => ({ ...x, ...patch })); setError(null); };
  const send = async () => {
    const problem = credentialProblem(d, file, today);
    if (problem) { setError(problem); return; }
    setBusy(true);
    try { await api.addCredential(d, file!, today); say("Sent for checking"); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  return (
    <Sheet label="Add a certificate" onClose={onClose}>
      <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <div className="sect"><h2 className="h3">Add a certificate</h2><button type="button" className="btn ghost sm" onClick={onClose}>Close</button></div>
        <div className="gr-chips" role="group" aria-label="Type">
          {(Object.keys(CREDENTIAL_LABEL) as CredentialKind[]).map((k) => <button key={k} type="button" className="gr-chip" aria-pressed={d.kind === k} onClick={() => set({ kind: k })}>{CREDENTIAL_LABEL[k]}</button>)}
        </div>
        <span className="tiny">{CREDENTIAL_HINT[d.kind]}</span>
        <label className="stack" style={{ gap: 6 }}><span className="tiny">Name on the certificate</span><input className="field" maxLength={CREDENTIAL_TITLE_MAX} placeholder={d.kind === "insurance" ? "Public liability £5m" : "Level 3 Personal Trainer"} value={d.title} onChange={(e) => set({ title: e.target.value })} /></label>
        <label className="stack" style={{ gap: 6 }}><span className="tiny">{d.kind === "insurance" ? "Insurer" : "Issued by"}</span><input className="field" maxLength={CREDENTIAL_ISSUER_MAX} value={d.issuer} onChange={(e) => set({ issuer: e.target.value })} /></label>
        <label className="stack" style={{ gap: 6 }}><span className="tiny">{d.kind === "insurance" ? "Renewal date" : "Expiry date (leave empty if it doesn't expire)"}</span><input className="field" type="date" min={today} value={d.expires ?? ""} onChange={(e) => set({ expires: e.target.value || null })} /></label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="tiny">Photo or PDF, up to 8 MB</span>
          <input className="field" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }} />
        </label>
        {error && <p className="small" role="alert" style={{ margin: 0, color: "var(--crit)" }}>{error}</p>}
        <button className="btn act block" disabled={busy}>{busy ? "Sending…" : "Send for checking"}</button>
      </form>
    </Sheet>
  );
}

/** The APEX team only: certificates waiting to be checked. */
function CheckQueue({ api, say, onChanged }: { api: ListingApi; say: (m: string) => void; onChanged: () => Promise<void> }) {
  const [list, setList] = useState<CredentialReview[] | null>(null);
  const [declining, setDeclining] = useState<CredentialReview | null>(null);
  const [note, setNote] = useState("");
  const load = useCallback(() => { void api.queue("pending").then(setList, (e: unknown) => say(e instanceof Error ? e.message : String(e))); }, [api, say]);
  useEffect(() => { load(); }, [load]);
  const decide = async (c: CredentialReview, approve: boolean, why = "") => {
    try { await api.review(c.id, approve, why); say(approve ? `${c.coachName.split(" ")[0]}'s ${CREDENTIAL_LABEL[c.kind].toLowerCase()} approved` : "Sent back with your reason"); setDeclining(null); setNote(""); load(); await onChanged(); }
    catch (e) { say(e instanceof Error ? e.message : String(e)); }
  };
  const open = async (c: CredentialReview) => {
    const url = c.filePath ? await api.fileUrl(c.filePath) : null;
    if (url) window.open(url, "_blank", "noopener"); else say("The file opens in the live app");
  };
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Check certificates</h2><span className="tiny">APEX team only</span></div>
      {list === null ? <span className="small">Loading…</span> : list.length === 0 ? <span className="small">Nothing waiting. All caught up.</span> : list.map((c) => (
        <div key={c.id} className="ft-cred">
          <Icons.shield width={18} height={18} style={{ color: "var(--blue)", flex: "none", marginTop: 2 }} />
          <div className="grow">
            <b>{c.coachName} · {CREDENTIAL_LABEL[c.kind]}</b>
            <span className="tiny">{c.title}, {c.issuer}{c.expires ? `, until ${new Date(`${c.expires}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}</span>
            <span className="tiny">Check the name matches the trainer, the dates are current and the issuer is real.</span>
            <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <button className="btn ghost sm" onClick={() => void open(c)}><Icons.eye width={14} height={14} /> Open file</button>
              <button className="btn act sm" onClick={() => void decide(c, true)}><Icons.check width={14} height={14} /> Approve</button>
              <button className="btn ghost sm" onClick={() => { setDeclining(c); setNote(""); }}>Decline</button>
            </div>
          </div>
        </div>
      ))}
      {declining && (
        <Sheet label="Decline certificate" onClose={() => setDeclining(null)}>
          <form className="stack" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); void decide(declining, false, note); }}>
            <h2 className="h3">Why isn't it accepted?</h2>
            <span className="tiny">{declining.coachName} sees this, so they can fix it.</span>
            <textarea className="field" rows={3} maxLength={REJECT_NOTE_MAX} placeholder="The name on the certificate doesn't match your account." value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn act block" disabled={note.trim().length < 3}>Send back</button>
          </form>
        </Sheet>
      )}
    </section>
  );
}
