import { AGREEMENT_BODY_MAX, AGREEMENT_STARTERS, AGREEMENT_TITLE_MAX, CLIENTS, agreementProblem, signingStatus, type Agreement, type Signature } from "@apex/core";
import { AgreementPaper, BackLink, Icons, Label, Sheet } from "@apex/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEMO_CLIENT, useExtras, type AgreementInput } from "../../data/extras";
import type { CoachLiveProps } from "../CoachApp";

type Data = { agreements: Agreement[]; signatures: Signature[] };

/** Coach: contracts and waivers. Write them once (or start from a template), see who has signed and who hasn't. */
export function CoachAgreements({ live, onBack, say }: { live?: CoachLiveProps; onBack: () => void; say: (m: string) => void }) {
  const api = useExtras();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<AgreementInput | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clients = useMemo(
    () => (live ? (live.clients ?? []).map((c) => ({ id: c.id, name: c.name })) : [DEMO_CLIENT, ...CLIENTS.filter((c) => c.name !== DEMO_CLIENT.name).map((c) => ({ id: String(c.id), name: c.name }))]),
    [live],
  );
  const reload = useCallback(async () => {
    if (!api) return;
    try { setData(await api.agreements.list()); setError(null); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);
  if (!api) return null;

  const save = async () => {
    if (!edit) return;
    const p = agreementProblem(edit);
    if (p) return say(p);
    setBusy(true);
    try { await api.agreements.save(edit); setEdit(null); say(edit.id ? "Saved. Clients sign the new wording next time they open the app" : "Added. Clients sign it next time they open the app"); await reload(); }
    catch (e) { say(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const remove = async (a: Agreement) => {
    if (!confirm(`Delete "${a.title}"? Signed copies are kept.`)) return;
    try { await api.agreements.remove(a.id); setOpen(null); await reload(); say("Deleted"); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
  };
  const unused = AGREEMENT_STARTERS.filter((s) => !data?.agreements.some((a) => a.title === s.title));
  const opened = data?.agreements.find((a) => a.id === open);

  return (
    <>
      <BackLink onClick={onBack}>Business</BackLink>
      <div><div className="eyebrow">Business</div><h1 className="h1">Contracts and waivers</h1></div>
      <p className="small" style={{ margin: 0 }}>Clients read and sign these by typing their name the next time they open the app. Change the wording and everyone signs the new version. Each signature keeps a copy of exactly what was signed.</p>
      {error && <div className="card small">{error}</div>}
      {!data && !error && <div className="card small">Loading…</div>}
      {data && (
        <div className="card flat list">
          {data.agreements.length === 0 && <div className="li small">None yet. Start from a template below or write your own.</div>}
          {data.agreements.map((a) => {
            const st = signingStatus(a, data.signatures, clients);
            return (
              <button key={a.id} className="li" onClick={() => setOpen(a.id)}>
                <span className="mi c1"><Icons.note /></span>
                <div className="grow">
                  <div className="h3">{a.title}</div>
                  <div className="tiny">{!a.active ? "Switched off" : `${st.signed.length} signed · ${st.waiting.length} waiting`}{a.required ? " · must sign" : " · optional"} · v{a.version}</div>
                </div>
                <Icons.forward width={18} height={18} style={{ color: "var(--text3)" }} />
              </button>
            );
          })}
        </div>
      )}
      <button className="btn act block" onClick={() => setEdit({ title: "", body: "", required: true, active: true })}><Icons.plus width={16} height={16} /> Write your own</button>
      {data && unused.length > 0 && (
        <>
          <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Templates</h2><span className="tiny">Edit before you use them</span></div>
          <div className="card flat list">
            {unused.map((s) => (
              <button key={s.title} className="li" onClick={() => setEdit({ title: s.title, body: s.body, required: true, active: true })}>
                <span className="mi c4"><Icons.file /></span>
                <div className="grow"><div className="h3">{s.title}</div><div className="tiny">{s.body.slice(0, 90)}…</div></div>
                <Icons.plus width={16} height={16} style={{ color: "var(--text3)" }} />
              </button>
            ))}
          </div>
          <div className="tiny">Plain-English starting points, not legal advice. Check them with a solicitor or your insurer for your own business.</div>
        </>
      )}

      {opened && data && !edit && (() => {
        const st = signingStatus(opened, data.signatures, clients);
        return (
          <Sheet label={opened.title} onClose={() => setOpen(null)}>
            <div className="stack" style={{ gap: 12 }}>
              <div className="sect" style={{ margin: 0 }}><h2 className="h2">{opened.title}</h2><button className="iconbtn" onClick={() => setOpen(null)}>Close</button></div>
              <AgreementPaper title={opened.title} body={opened.body} version={opened.version} />
              <div className="sect" style={{ margin: 0 }}><h3 className="h3">Signed</h3><span className="tiny num">{st.signed.length}</span></div>
              <div className="stack" style={{ gap: 6 }}>
                {st.signed.length === 0 && <div className="small">Nobody yet.</div>}
                {st.signed.map((s) => <div key={s.id} className="xa-row small"><span className="xa-dot ok" />{s.name}<span className="grow" /><span className="tiny num">{new Date(s.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></div>)}
              </div>
              <div className="sect" style={{ margin: 0 }}><h3 className="h3">Waiting</h3><span className="tiny num">{st.waiting.length}</span></div>
              <div className="stack" style={{ gap: 6 }}>
                {st.waiting.length === 0 && <div className="small">Everyone has signed.</div>}
                {st.waiting.map((s) => <div key={s.id} className="xa-row small"><span className="xa-dot wait" />{s.name}{s.old && <span className="tiny"> · signed an older version</span>}</div>)}
              </div>
              <div className="row">
                <button className="btn ghost" style={{ flex: 1 }} onClick={() => void remove(opened)}><Icons.trash width={15} height={15} /> Delete</button>
                <button className="btn act" style={{ flex: 1 }} onClick={() => setEdit({ id: opened.id, title: opened.title, body: opened.body, required: opened.required, active: opened.active })}><Icons.edit width={15} height={15} /> Edit</button>
              </div>
            </div>
          </Sheet>
        );
      })()}

      {edit && (
        <Sheet label={edit.id ? "Edit agreement" : "New agreement"} onClose={() => setEdit(null)}>
          <div className="stack" style={{ gap: 10 }}>
            <div className="sect" style={{ margin: 0 }}><h2 className="h2">{edit.id ? "Edit" : "New agreement"}</h2><Label kind="dec">Coach decision</Label></div>
            <input className="field" aria-label="Title" placeholder="Title, e.g. Coaching agreement" maxLength={AGREEMENT_TITLE_MAX} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            <textarea className="field" aria-label="Wording" rows={10} maxLength={AGREEMENT_BODY_MAX} placeholder="What the client is agreeing to. Leave a blank line between paragraphs." value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            <label className="row small"><input type="checkbox" checked={edit.required} onChange={(e) => setEdit({ ...edit, required: e.target.checked })} /> Clients must sign before using the app</label>
            <label className="row small"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Switched on</label>
            {edit.id && <div className="tiny">Changing the title or wording asks every client to sign again. Their earlier signature stays on record.</div>}
            <div className="row">
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn act" style={{ flex: 1 }} disabled={busy} onClick={() => void save()}>Save</button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
