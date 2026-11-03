import {
  AUTOMATIONS, MISSED_DAY_CHOICES, PLACEHOLDERS, automationProblem, bodyOf, fillMessage, firstName, hourLabel, isOn, shortDate,
  type AutomationKind, type AutomationSend, type AutomationSettings,
} from "@apex/core";
import { BackLink, Label } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { NEEDS_UPDATE, type AutomationsApi } from "../../data/automations";

const KEYS: Record<AutomationKind, { on: "welcomeOn" | "missedOn" | "checkinOn"; body: "welcomeBody" | "missedBody" | "checkinBody" }> = {
  welcome: { on: "welcomeOn", body: "welcomeBody" },
  missed: { on: "missedOn", body: "missedBody" },
  checkin: { on: "checkinOn", body: "checkinBody" },
};

function timeZones(current: string): string[] {
  let all: string[] = [];
  try {
    all = Intl.supportedValuesOf("timeZone");
  } catch {
    all = ["Europe/London", "Europe/Dublin", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Australia/Sydney"];
  }
  return all.includes(current) ? all : [current, ...all];
}

/** Coach: turn on automatic messages and write them in their own words. */
export function Automations({ api, clientNames, onBack, say }: { api: AutomationsApi; clientNames: Record<string, string>; onBack: () => void; say: (m: string) => void }) {
  const { coachName, clientName } = useAppInfo();
  const [saved, setSaved] = useState<AutomationSettings | null>(null);
  const [s, setS] = useState<AutomationSettings | null>(null);
  const [sends, setSends] = useState<AutomationSend[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    api.load().then((r) => { if (live) { setSaved(r.settings); setS(r.settings); setSends(r.sends); } }, (e: Error) => live && setErr(e.message));
    return () => { live = false; };
  }, [api]);
  const zones = useMemo(() => timeZones(s?.timezone ?? "Europe/London"), [s?.timezone]);

  const head = (
    <>
      <BackLink onClick={onBack}>Messages</BackLink>
      <div><div className="eyebrow">Messages</div><h1 className="h1">Automatic messages</h1><p className="sub">Sent from you, in your words, so no client slips through. Each one goes once and lands in your normal chat.</p></div>
    </>
  );
  if (err) return <>{head}<div className="card small">{err === NEEDS_UPDATE ? "This needs a quick database update first. Run the automatic messages SQL in Supabase, then reload." : `Couldn't load: ${err}`}</div></>;
  if (!s || !saved) return <>{head}<div className="card small">Loading…</div></>;

  const set = (patch: Partial<AutomationSettings>) => setS({ ...s, ...patch });
  const problem = automationProblem(s);
  const changed = JSON.stringify(s) !== JSON.stringify(saved);
  const sample = firstName(clientName) || "Priya";
  const save = async () => {
    setSaving(true);
    try {
      await api.save(s);
      setSaved(s);
      say(api.live ? "Saved · automatic messages updated" : "Saved · in the demo nothing is really sent");
    } catch (e) {
      say(e instanceof Error && e.message === NEEDS_UPDATE ? "Run the automatic messages SQL first" : `Couldn't save: ${e instanceof Error ? e.message : e}`);
    }
    setSaving(false);
  };

  return (
    <>
      {head}
      {AUTOMATIONS.map((a) => {
        const on = isOn(s, a.kind);
        const k = KEYS[a.kind];
        return (
          <section key={a.kind} className="card stack" style={on ? { borderColor: "color-mix(in srgb,var(--act) 40%,var(--line))" } : undefined}>
            <label className="row" style={{ cursor: "pointer", alignItems: "flex-start", gap: 12 }}>
              <div className="grow"><h2 className="h2">{a.title}</h2><div className="small" style={{ marginTop: 2 }}>{a.when(s)}</div></div>
              <input type="checkbox" role="switch" aria-label={`${a.title} on`} checked={on} onChange={(e) => set({ [k.on]: e.target.checked })} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none", marginTop: 4 }} />
            </label>
            {a.kind === "missed" && (
              <div>
                <div className="tiny" style={{ marginBottom: 6 }}>Days without a workout</div>
                <div className="chips" style={{ flexWrap: "wrap" }}>{MISSED_DAY_CHOICES.map((d) => <button key={d} type="button" className={`chip ${s.missedDays === d ? "on" : ""}`} aria-pressed={s.missedDays === d} onClick={() => set({ missedDays: d })}>{d} days</button>)}</div>
              </div>
            )}
            <textarea id={`auto-${a.kind}`} className="field" rows={4} maxLength={1000} aria-label={`${a.title} message`} value={bodyOf(s, a.kind)} onChange={(e) => set({ [k.body]: e.target.value })} />
            <div>
              <div className="tiny" style={{ marginBottom: 6 }}>{sample} sees</div>
              <div style={{ background: "var(--blue)", color: "#fff", borderRadius: 12, padding: "10px 12px", maxWidth: "88%", marginLeft: "auto", whiteSpace: "pre-line", fontSize: 14 }}>
                {fillMessage(bodyOf(s, a.kind), { firstName: sample, coach: coachName, days: s.missedDays })}
              </div>
            </div>
          </section>
        );
      })}

      <section className="card stack">
        <h2 className="h2">Send time</h2>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <select id="auto-hour" className="field" style={{ flex: "1 1 120px" }} value={s.sendHour} onChange={(e) => set({ sendHour: Number(e.target.value) })} aria-label="Send hour">
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
          <select id="auto-tz" className="field" style={{ flex: "2 1 200px" }} value={s.timezone} onChange={(e) => set({ timezone: e.target.value })} aria-label="Time zone">
            {zones.map((z) => <option key={z} value={z}>{z.replaceAll("_", " ")}</option>)}
          </select>
        </div>
        <div className="tiny">You can use {PLACEHOLDERS.map((p, i) => <span key={p.key}>{i ? ", " : ""}<span className="num" style={{ color: "var(--text)" }}>{p.key}</span> ({p.meaning})</span>)}.</div>
      </section>

      {problem && <div className="tiny" style={{ color: "var(--warn)" }}>{problem}</div>}
      <button className="btn act block" style={{ minHeight: 52 }} disabled={!!problem || !changed || saving} onClick={() => void save()}>{saving ? "Saving…" : changed ? "Save" : "Saved"}</button>

      {api.live && (
        <section>
          <div className="sect"><h2 className="h2">Recently sent</h2><Label kind="data">Data</Label></div>
          <div className="card flat list">
            {sends.length === 0 ? <div className="li small">Nothing sent yet. Messages go out within the hour once they're due.</div> : sends.map((x) => (
              <div key={`${x.clientId}${x.kind}${x.sentAt}`} className="li"><div className="grow"><div className="h3">{clientNames[x.clientId] ?? "A client"}</div><div className="tiny">{AUTOMATIONS.find((a) => a.kind === x.kind)?.title}</div></div><span className="tiny">{shortDate(x.sentAt)}</span></div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
