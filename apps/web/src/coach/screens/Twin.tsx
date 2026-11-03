import {
  SITUATION_TITLE, addDays, draftWeek, firstOf, learnPhrase, twinStats, weekOf,
  type TwinDecision, type TwinDraft, type TwinStatus, type TwinVoice,
} from "@apex/core";
import { Avatar, BackLink, Icons, Label } from "@apex/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TWIN_NEEDS_UPDATE, useTwinApi, type TwinApi } from "../../data/twin";

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const TONE = { crit: "var(--crit)", warn: "var(--warn)", good: "var(--good)" } as const;

interface TwinData {
  status: "loading" | "ready" | "needs-update" | "error";
  error?: string;
  week: string;
  drafts: TwinDraft[];
  decisions: TwinDecision[];
  voice: TwinVoice;
  reload: () => Promise<void>;
}

function useTwin(api: TwinApi | null): TwinData {
  const week = weekOf(new Date());
  const [s, setS] = useState<Omit<TwinData, "reload" | "week">>({ status: "loading", drafts: [], decisions: [], voice: { signOff: "", phrases: {} } });
  const reload = useCallback(async () => {
    if (!api) return;
    try {
      const now = new Date();
      const [signals, voice, decisions] = await Promise.all([api.signals(now), api.voice(), api.decisions(addDays(weekOf(now), -21))]);
      setS({ status: "ready", drafts: draftWeek(signals, voice, now), decisions, voice });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setS((p) => ({ ...p, status: msg === TWIN_NEEDS_UPDATE ? "needs-update" : "error", error: msg }));
    }
  }, [api]);
  useEffect(() => void reload(), [reload]);
  return { ...s, week, reload };
}

/** Brief entry: how many drafts are waiting this week. */
export function TwinCard({ onOpen }: { onOpen: () => void }) {
  const api = useTwinApi();
  const t = useTwin(api);
  if (!api) return null;
  const open = t.drafts.filter((d) => !t.decisions.some((x) => x.clientId === d.clientId && x.weekOf === t.week));
  const attention = open.filter((d) => d.attention).length;
  const line = t.status === "needs-update" ? "Needs the APEX Twin SQL" : t.status === "loading" ? "Drafting this week…" : t.status === "error" ? "Couldn't draft this week" : open.length
    ? `${open.length - attention} ready${attention ? ` · ${attention} need${attention === 1 ? "s" : ""} you` : ""}`
    : t.drafts.length ? "Every client decided this week" : "Drafts appear once you have clients";
  return (
    <div className="card flat list full">
      <button className="li" onClick={onOpen}>
        <Icons.note width={18} height={18} style={{ color: "var(--act)" }} />
        <div className="grow"><div className="h3">APEX Twin · weekly drafts</div><div className="tiny">{line}</div></div>
        {attention > 0 && <span className="tw-count">{attention}</span>}
        <span className="tiny">›</span>
      </button>
    </div>
  );
}

/** The weekly queue: every client's drafted change and message, risky ones first. Nothing is sent without a tap. */
export function TwinQueue({ onBack, say }: { onBack: () => void; say: (m: string) => void }) {
  const api = useTwinApi();
  const t = useTwin(api);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [bulk, setBulk] = useState(false);
  const decided = useMemo(() => new Map(t.decisions.filter((d) => d.weekOf === t.week).map((d) => [d.clientId, d])), [t.decisions, t.week]);
  if (!api) return null;
  const open = t.drafts.filter((d) => !decided.has(d.clientId));
  const attention = open.filter((d) => d.attention);
  const ready = open.filter((d) => !d.attention);
  const stats = twinStats(t.decisions);

  const decide = async (d: TwinDraft, status: TwinStatus, sent: string | null) => {
    const decision: TwinDecision = { clientId: d.clientId, weekOf: t.week, situation: d.situation, adjust: status === "rejected" ? "none" : d.adjust, status, drafted: d.message, sent, decidedAt: new Date().toISOString() };
    if (status === "rejected") await api.reject(decision);
    else await api.approve(d, sent, decision);
    // An edit becomes the coach's wording for this situation next time.
    if (status === "edited" && sent && d.situation !== "injury") {
      await api.saveVoice({ ...t.voice, phrases: { ...t.voice.phrases, [d.situation]: learnPhrase(sent, d, t.voice.signOff) } });
    }
  };

  const approveReady = async () => {
    setBulk(true);
    let n = 0;
    for (const d of ready) {
      try {
        await decide(d, "approved", d.message);
        n++;
      } catch (e) {
        say(`${firstOf(d.name)}: ${e instanceof Error ? e.message : String(e)}`);
        break;
      }
    }
    setBulk(false);
    say(`${n} approved and sent`);
    await t.reload();
  };

  return (
    <>
      <div className="full"><BackLink onClick={onBack}>Brief</BackLink></div>
      <div className="full row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div><div className="eyebrow">APEX Twin · week of {new Date(`${t.week}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div><h1 className="h1">Weekly drafts</h1></div>
        <button className="btn ghost sm" onClick={() => setVoiceOpen((v) => !v)} aria-expanded={voiceOpen}>Your voice</button>
      </div>
      <p className="small full" style={{ margin: 0 }}>Drafted from each client's sessions, check-ins and messages. Nothing reaches a client until you approve it.</p>
      {voiceOpen && <VoiceEditor voice={t.voice} onSave={async (v) => { await api.saveVoice(v); await t.reload(); say("Voice saved"); setVoiceOpen(false); }} />}

      {t.status === "loading" && <div className="card small full">Drafting this week…</div>}
      {t.status === "needs-update" && <div className="card small full">APEX Twin needs a quick database update. Run the APEX Twin SQL in Supabase, then reload.</div>}
      {t.status === "error" && <div className="card small full" role="alert">Couldn't draft this week: {t.error}</div>}

      {t.status === "ready" && (
        <>
          <div className="kpis full">
            <div className="kpi"><b>{open.length}</b><small>Waiting this week</small></div>
            <div className="kpi"><b style={{ color: attention.length ? "var(--crit)" : undefined }}>{attention.length}</b><small>Need you</small></div>
            <div className="kpi"><b>{stats.asIsPct === null ? "–" : `${stats.asIsPct}%`}</b><small>Approved as drafted, 4 weeks</small><i style={{ color: "var(--text3)" }}>Target 60%</i></div>
          </div>
          {t.drafts.length === 0 && <div className="card small full">No clients to draft for yet. Invite a client and their weekly draft appears here.</div>}

          {attention.length > 0 && (
            <section className="full stack">
              <div className="sect"><h2 className="h2">Needs you first</h2><span className="tiny">Pain, gone quiet or likely to leave</span></div>
              {attention.map((d) => <DraftCard key={d.clientId} d={d} api={api} decide={decide} say={say} reload={t.reload} />)}
            </section>
          )}
          {ready.length > 0 && (
            <section className="full stack">
              <div className="sect">
                <h2 className="h2">Ready</h2>
                <button className="btn act sm" disabled={bulk} onClick={() => void approveReady()}>{bulk ? "Approving…" : `Approve all ${ready.length}`}</button>
              </div>
              {ready.map((d) => <DraftCard key={d.clientId} d={d} api={api} decide={decide} say={say} reload={t.reload} />)}
            </section>
          )}
          {decided.size > 0 && (
            <section className="full">
              <div className="sect"><h2 className="h3">Decided this week</h2><Label kind="dec">Coach decision</Label></div>
              <div className="card flat list">
                {t.drafts.filter((d) => decided.has(d.clientId)).map((d) => {
                  const x = decided.get(d.clientId)!;
                  return (
                    <div key={d.clientId} className="li">
                      <Avatar initials={initials(d.name)} size={28} />
                      <div className="grow"><div className="h3">{d.name}</div><div className="tiny">{SITUATION_TITLE[x.situation]} · {x.status === "approved" ? "approved as drafted" : x.status === "edited" ? "sent with your edits" : "rejected"}</div></div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function DraftCard({ d, api, decide, say, reload }: { d: TwinDraft; api: TwinApi; decide: (d: TwinDraft, s: TwinStatus, sent: string | null) => Promise<void>; say: (m: string) => void; reload: () => Promise<void> }) {
  const [text, setText] = useState(d.message ?? "");
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState<string[] | null>(null);
  const [showChanges, setShowChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tone = d.situation === "injury" || d.attention ? TONE.crit : d.situation === "progress" ? TONE.good : TONE.warn;
  const edited = d.message !== null && text.trim() !== d.message.trim();
  const first = firstOf(d.name);

  const toggleChanges = async () => {
    setShowChanges((v) => !v);
    if (changes === null) {
      try {
        setChanges(await api.preview(d.clientId, d.adjust));
      } catch (e) {
        setChanges([`Couldn't load the program: ${e instanceof Error ? e.message : String(e)}`]);
      }
    }
  };
  const act = async (status: TwinStatus) => {
    setBusy(true);
    setError(null);
    try {
      await decide(d, status, status === "rejected" ? null : text.trim() || null);
      say(status === "rejected" ? `${first}'s draft rejected` : `Sent to ${first}${d.adjust !== "none" && d.adjust !== "hold" ? " · program updated" : ""}`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <article className="card tw-card">
      <div className="stripe" style={{ background: tone }} />
      <div className="stack" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <Avatar initials={initials(d.name)} size={34} tone={tone} />
          <div className="grow"><div className="h3">{d.name}</div><div className="tiny">{SITUATION_TITLE[d.situation]}</div></div>
        </div>
        <ul className="tw-flags">
          {d.flags.map((f) => (
            <li key={f.text}><Label kind={f.label === "Data" ? "data" : "insight"}>{f.label}</Label><span className="small">{f.text}</span></li>
          ))}
        </ul>
        <div className="tw-adjust">
          <div className="row" style={{ gap: 8, alignItems: "center" }}><Label kind="ai">AI suggestion</Label><span className="small" style={{ color: "var(--text)" }}>{d.adjustText}</span></div>
          {d.adjust !== "none" && d.adjust !== "hold" && <button className="link small" onClick={() => void toggleChanges()} aria-expanded={showChanges}>{showChanges ? "Hide changes" : "See the exact changes"}</button>}
          {showChanges && (
            <ul className="tw-changes small">
              {changes === null ? <li>Loading…</li> : changes.length ? changes.map((c) => <li key={c}>{c}</li>) : <li>Nothing to change this week (no loads or sets to adjust).</li>}
            </ul>
          )}
        </div>
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 6, alignItems: "center" }}>
            {d.message !== null ? <Label kind="ai">AI suggestion</Label> : <Label kind="dec">Coach decision</Label>}
            <span className="tiny">{d.message !== null ? `Message to ${first}${edited ? " · edited" : ""}` : "It mentions pain, so APEX won't draft a reply"}</span>
          </div>
          <textarea className="field" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Write to ${first} about what they mentioned. Keep medical questions for a professional.`} aria-label={`Message to ${first}`} />
        </div>
        {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn act sm" disabled={busy || (d.situation === "injury" && !text.trim())} onClick={() => void act(edited || d.message === null ? "edited" : "approved")}>{busy ? "Sending…" : edited || d.message === null ? "Send my version" : "Approve"}</button>
          <button className="btn ghost sm" disabled={busy} onClick={() => void act("rejected")}>Reject</button>
          {edited && <button className="link small" onClick={() => setText(d.message ?? "")}>Undo my edits</button>}
        </div>
      </div>
    </article>
  );
}

function VoiceEditor({ voice, onSave }: { voice: TwinVoice; onSave: (v: TwinVoice) => Promise<void> }) {
  const [signOff, setSignOff] = useState(voice.signOff);
  const [busy, setBusy] = useState(false);
  const learnt = Object.keys(voice.phrases) as (keyof TwinVoice["phrases"])[];
  return (
    <section className="card stack full">
      <h3 className="h3">Your voice</h3>
      <div className="small">APEX Twin writes in your words. When you edit a draft and send it, your version becomes the starting point for that situation next week.</div>
      <label className="small" htmlFor="tw-sign">Sign off with</label>
      <input id="tw-sign" className="field" maxLength={60} value={signOff} onChange={(e) => setSignOff(e.target.value)} placeholder="e.g. Kamal" />
      {learnt.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="tiny">Learnt from your edits</div>
          {learnt.map((k) => <div key={k} className="small tw-phrase"><b>{SITUATION_TITLE[k]}:</b> {voice.phrases[k]}</div>)}
        </div>
      )}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn act sm" disabled={busy} onClick={async () => { setBusy(true); await onSave({ ...voice, signOff }); setBusy(false); }}>Save</button>
        {learnt.length > 0 && <button className="btn ghost sm" disabled={busy} onClick={async () => { setBusy(true); await onSave({ signOff, phrases: {} }); setBusy(false); }}>Forget learnt wording</button>}
      </div>
    </section>
  );
}
