import { nameProblem, signatureFor, toSign, type Agreement, type Signature } from "@apex/core";
import { AgreementPaper, Icons } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { useExtras } from "../../data/extras";

type Data = { agreements: Agreement[]; signatures: Signature[] };

/** The coach's agreements for the signed-in client. A load failure (e.g. the database update not run yet) never blocks the app. */
export function useClientAgreements() {
  const api = useExtras();
  const [data, setData] = useState<Data | null>(null);
  const reload = useCallback(async () => {
    if (!api || api.side !== "client") return;
    try { setData(await api.agreements.list()); } catch (e) { console.warn("Couldn't load agreements", e); setData({ agreements: [], signatures: [] }); }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);
  const me = api?.me ?? "";
  const pending = data ? toSign(data.agreements, data.signatures, me) : [];
  return { data, me, reload, required: pending.filter((a) => a.required), optional: pending.filter((a) => !a.required) };
}

/** One agreement to read and sign by typing a full name. */
function SignOne({ a, onSigned, say, step }: { a: Agreement; onSigned: () => Promise<void>; say: (m: string) => void; step?: string }) {
  const api = useExtras();
  const { clientName, coachName } = useAppInfo();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const problem = nameProblem(name, clientName);
  const sign = async () => {
    if (!api) return;
    if (problem) return say(problem);
    setBusy(true);
    try { await api.agreements.sign(a.id, name); setName(""); say(`Signed · ${coachName} can see it`); await onSigned(); }
    catch (e) { say(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  return (
    <AgreementPaper title={a.title} body={a.body} version={a.version} signature={name.trim() || " "}>
      {step && <div className="tiny">{step}</div>}
      <input className="field" aria-label="Type your full name to sign" placeholder="Type your full name to sign" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void sign(); }} />
      <div className="tiny">By typing your name you agree to the above. A copy is saved for you and {coachName}.</div>
      <button className="btn act block" disabled={busy || !name.trim()} onClick={() => void sign()}><Icons.check width={16} height={16} /> Sign</button>
    </AgreementPaper>
  );
}

/** Shown instead of the app while a must-sign agreement is waiting. */
export function SignRequired({ list, onSigned, say }: { list: Agreement[]; onSigned: () => Promise<void>; say: (m: string) => void }) {
  const { coachName } = useAppInfo();
  const a = list[0];
  if (!a) return null;
  return (
    <>
      <div><div className="eyebrow">Before you start</div><h1 className="h1">{coachName} needs your signature</h1></div>
      <p className="small" style={{ margin: 0 }}>Read it through, then type your name to sign. It takes a minute and you only do it once{list.length > 1 ? `. ${list.length} to go` : ""}.</p>
      <SignOne key={`${a.id}-${a.version}`} a={a} onSigned={onSigned} say={say} step={list.length > 1 ? `1 of ${list.length}` : undefined} />
    </>
  );
}

/** More → Agreements: anything optional still to sign, and copies of everything signed. */
export function MyAgreements({ say, onChange }: { say: (m: string) => void; onChange?: () => void }) {
  const { data, me, reload, optional } = useClientAgreements();
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return <div className="card small">Loading…</div>;
  const mine = data.signatures.filter((s) => s.clientId === me);
  const current = (s: Signature) => data.agreements.some((a) => a.id === s.agreementId && signatureFor(a, data.signatures, me)?.id === s.id);
  return (
    <>
      <div><div className="eyebrow">More</div><h1 className="h1">Agreements</h1></div>
      {optional.map((a) => <SignOne key={`${a.id}-${a.version}`} a={a} say={say} onSigned={async () => { await reload(); onChange?.(); }} />)}
      {mine.length === 0 && optional.length === 0 && <div className="card small">Nothing to sign. Anything your coach asks you to sign shows up here.</div>}
      {mine.length > 0 && (
        <>
          <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Signed</h2><span className="tiny num">{mine.length}</span></div>
          <div className="card flat list">
            {mine.map((s) => (
              <button key={s.id} className="li" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
                <span className="xa-dot ok" />
                <div className="grow"><div className="h3">{s.title}</div><div className="tiny">Signed {new Date(s.signedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} as {s.typedName}{current(s) ? "" : " · older version"}</div></div>
                <Icons.forward width={16} height={16} style={{ color: "var(--text3)", transform: open === s.id ? "rotate(90deg)" : undefined }} />
              </button>
            ))}
          </div>
          {mine.filter((s) => s.id === open).map((s) => <AgreementPaper key={s.id} title={s.title} body={s.body} version={s.version} signature={s.typedName} />)}
        </>
      )}
    </>
  );
}
