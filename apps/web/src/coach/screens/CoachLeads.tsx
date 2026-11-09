import { LEAD_PRIVACY_NOTE, LEAD_STAGE_HINT, LEAD_STAGE_LABEL, GOAL_CHOICES, MODE_LABEL, NOTES_MAX, SOURCE_CHOICES, WELCOME_MAX, addDays, defaultLeadSettings, embedCode, followUpLabel, formLink, localDate, sourceCounts, sourceLabel, welcomeBody, type CoachPage, type Lead, type LeadSettings, type ManualLead } from "@apex/core";
import { Icons, Sheet, StageChips, WelcomePreview } from "@apex/ui";
import { useEffect, useState } from "react";
import { LEADS_NEEDS_UPDATE, LEADS_SQL, useGrowthApi, type GrowthApi } from "../../data/growth";

export const localToday = () => localDate(new Date());

/** Copies text, falling back to a prompt where the clipboard is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { window.prompt("Copy this", text); return false; }
}

/** Makes (or reuses) the invite, copies a short note with it and opens an email to the lead. */
export async function inviteLead(api: GrowthApi, l: Lead, say: (m: string) => void) {
  const invite = await api.invite(l.id);
  const first = l.name.split(" ")[0];
  const body = `Hi ${first}, great to hear from you. Here's your invite to train with me on APEX: ${invite}`;
  if (await copyText(body)) say(`Invite copied · send it to ${first}`);
  if (l.email) window.open(`mailto:${encodeURIComponent(l.email)}?subject=${encodeURIComponent("Your invite to train with me")}&body=${encodeURIComponent(body)}`, "_blank");
}

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
/** WhatsApp wants international digits only: a UK 07… number becomes 447…. */
const waHref = (phone: string) => {
  const d = phone.replace(/[^\d+]/g, "");
  const intl = d.startsWith("+") ? d.slice(1) : d.startsWith("00") ? d.slice(2) : d.startsWith("0") ? `44${d.slice(1)}` : d;
  return `https://wa.me/${intl}`;
};

/** One lead, opened: contact, stage, follow-up, private notes. */
export function LeadSheet({ lead, api, today, say, fail, onChanged, onClose }: {
  lead: Lead; api: GrowthApi; today: string; say: (m: string) => void; fail: (e: unknown) => void; onChanged: () => Promise<void>; onClose: () => void;
}) {
  const [notes, setNotes] = useState(lead.notes);
  const [phone, setPhone] = useState(lead.phone);
  useEffect(() => { setNotes(lead.notes); setPhone(lead.phone); }, [lead.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = lead.name.split(" ")[0];
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try { await fn(); if (done) say(done); } catch (e) { fail(e); }
    await onChanged();
  };
  const dirty = notes.trim() !== lead.notes || phone.trim() !== lead.phone;
  const picks: [string, number][] = [["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7], ["In 2 weeks", 14]];
  return (
    <Sheet label={lead.name} onClose={onClose}>
      <div className="stack" style={{ gap: 16 }}>
        <div className="sect" style={{ marginBottom: 0 }}>
          <div>
            <h2 className="h2" style={{ margin: 0 }}>{lead.name}</h2>
            <div className="tiny">{[lead.goal, lead.how ? MODE_LABEL[lead.how] : "", lead.referredBy ? `Sent by ${lead.referredBy}` : sourceLabel(lead.source)].filter(Boolean).join(" · ")}</div>
          </div>
          <button className="btn ghost sm" onClick={onClose}>Close</button>
        </div>
        {lead.message && <p className="gr-msg" style={{ margin: 0 }}>{lead.message}</p>}

        <div className="ld-row">
          {lead.email && <a className="btn ghost sm" href={`mailto:${encodeURIComponent(lead.email)}`}><Icons.mail width={14} height={14} /> Email</a>}
          {lead.phone && <a className="btn ghost sm" href={telHref(lead.phone)}><Icons.phone width={14} height={14} /> Call</a>}
          {lead.phone && <a className="btn ghost sm" href={waHref(lead.phone)} target="_blank" rel="noreferrer"><Icons.chat width={14} height={14} /> WhatsApp</a>}
          {lead.email && lead.stage !== "client" && (
            <button className="btn act sm" onClick={() => void run(() => inviteLead(api, lead, say))}><Icons.send width={14} height={14} /> {lead.status === "invited" ? "Send invite again" : "Send app invite"}</button>
          )}
        </div>
        {lead.email && <div className="tiny num" style={{ marginTop: -8 }}>{lead.email}</div>}

        <div className="stack" style={{ gap: 6 }}>
          <span className="tiny">Stage</span>
          <StageChips stage={lead.stage} onPick={(s) => void run(() => api.setStage(lead.id, s), `${first} moved to ${LEAD_STAGE_LABEL[s].toLowerCase()}`)} />
          <span className="tiny">{LEAD_STAGE_HINT[lead.stage]}</span>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <span className="tiny">Follow up {lead.followUp ? <b style={{ color: "var(--text)" }}>· {followUpLabel(lead.followUp, today)}</b> : null}</span>
          <div className="gr-chips">
            {picks.map(([label, n]) => {
              const date = addDays(today, n);
              return <button key={n} type="button" className="gr-chip" aria-pressed={lead.followUp === date} onClick={() => void run(() => api.updateLead(lead.id, { followUp: date }), `Follow up ${label.toLowerCase()}`)}>{label}</button>;
            })}
            {lead.followUp && <button type="button" className="gr-chip" onClick={() => void run(() => api.updateLead(lead.id, { followUp: null }), "Follow-up cleared")}>Clear</button>}
          </div>
          <input className="field" type="date" aria-label="Follow-up date" value={lead.followUp ?? ""} min={today} onChange={(e) => void run(() => api.updateLead(lead.id, { followUp: e.target.value || null }))} />
        </div>

        <label className="stack" style={{ gap: 6 }}>
          <span className="tiny">Phone (optional)</span>
          <input className="field" type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="tiny">Private notes <span className="num">{NOTES_MAX - notes.length}</span></span>
          <textarea className="field" rows={3} maxLength={NOTES_MAX} placeholder="Called Tue. Wants to start after half-term." value={notes} onChange={(e) => setNotes(e.target.value)} />
          <span className="tiny">Only you see these.</span>
        </label>
        <button className="btn act block" disabled={!dirty} onClick={() => void run(() => api.updateLead(lead.id, { notes, phone }), "Saved")}>Save</button>
        <button className="btn ghost block" onClick={() => { if (window.confirm(`Remove ${lead.name} from your leads? This can't be undone.`)) void run(() => api.removeLead(lead.id), "Lead removed").then(onClose); }}><Icons.trash width={14} height={14} /> Remove lead</button>
      </div>
    </Sheet>
  );
}

/** A lead the coach met elsewhere: a DM, the gym, a friend of a friend. */
export function AddLeadSheet({ api, say, fail, onDone, onClose }: { api: GrowthApi; say: (m: string) => void; fail: (e: unknown) => void; onDone: () => void; onClose: () => void }) {
  const [d, setD] = useState<ManualLead>({ name: "", email: "", phone: "", goal: "", source: "instagram", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<ManualLead>) => setD((x) => ({ ...x, ...patch }));
  const save = async () => {
    setBusy(true);
    try { await api.addLead(d); say(`${d.name.trim().split(" ")[0]} added to your leads`); onDone(); } catch (e) { fail(e); }
    setBusy(false);
  };
  return (
    <Sheet label="Add a lead" onClose={onClose}>
      <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2" style={{ margin: 0 }}>Add a lead</h2><button type="button" className="btn ghost sm" onClick={onClose}>Close</button></div>
        <p className="tiny" style={{ margin: 0 }}>Someone you met in a DM, at the gym or through a friend. APEX never emails people you add by hand.</p>
        <label className="stack" style={{ gap: 6 }}><span className="tiny">Name</span><input className="field" autoComplete="off" value={d.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="stack" style={{ gap: 6 }}><span className="tiny">Email (optional)</span><input className="field" type="email" inputMode="email" autoComplete="off" value={d.email} onChange={(e) => set({ email: e.target.value })} /></label>
        <label className="stack" style={{ gap: 6 }}><span className="tiny">Phone (optional)</span><input className="field" type="tel" inputMode="tel" autoComplete="off" value={d.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
        <div className="stack" style={{ gap: 6 }}>
          <span className="tiny">Where they came from</span>
          <div className="gr-chips">{SOURCE_CHOICES.map(([k, label]) => <button key={k} type="button" className="gr-chip" aria-pressed={d.source === k} onClick={() => set({ source: k })}>{label}</button>)}</div>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <span className="tiny">Goal</span>
          <div className="gr-chips">{GOAL_CHOICES.map((g) => <button key={g} type="button" className="gr-chip" aria-pressed={d.goal === g} onClick={() => set({ goal: d.goal === g ? "" : g })}>{g}</button>)}</div>
        </div>
        <label className="stack" style={{ gap: 6 }}><span className="tiny">Notes</span><textarea className="field" rows={2} maxLength={NOTES_MAX} value={d.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
        <button className="btn act block" disabled={busy || d.name.trim().length < 2}>{busy ? "Adding…" : "Add to my leads"}</button>
      </form>
    </Sheet>
  );
}

/** The enquiry form: links tagged by where they're shared, code for the coach's own website, and the automatic welcome email. */
export function EnquiryForm({ page, say, fail, onSetUp }: { page: CoachPage; say: (m: string) => void; fail: (e: unknown) => void; onSetUp: () => void }) {
  const api = useGrowthApi();
  const [source, setSource] = useState("instagram");
  const [settings, setSettings] = useState<LeadSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<LeadSettings | null>(null);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [counts, setCounts] = useState<{ source: string; count: number }[]>([]);
  useEffect(() => {
    if (!api) return;
    api.leadSettings().then((s) => { setSettings(s); setSavedSettings(s); }, (e) => { if (e instanceof Error && e.message === LEADS_NEEDS_UPDATE) setNeedsUpdate(true); setSettings(defaultLeadSettings()); });
    api.requests().then((l) => setCounts(sourceCounts(l)), () => undefined);
  }, [api]);
  if (!api) return null;
  if (!page.published) {
    return (
      <div className="card stack" style={{ gap: 10 }}>
        <h2 className="h3" style={{ margin: 0 }}>Enquiry form</h2>
        <p className="small" style={{ margin: 0 }}>Your form lives on your public page. Publish the page first, then share the form anywhere.</p>
        <button className="btn act" onClick={onSetUp}>Set up my page</button>
      </div>
    );
  }
  const link = formLink(location.origin, page.slug, source);
  const code = embedCode(location.origin, page.slug);
  const dirty = settings && savedSettings && JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const save = async () => {
    if (!settings) return;
    try { await api.saveLeadSettings(settings); setSavedSettings(settings); say("Welcome email saved"); } catch (e) { fail(e); }
  };
  return (
    <>
      <section className="card stack" style={{ gap: 12 }}>
        <div><h2 className="h3" style={{ margin: 0 }}>Share your form</h2><p className="tiny" style={{ margin: "4px 0 0" }}>Opens your page straight on the form. Pick where you'll post it and each lead shows where it came from.</p></div>
        <div className="gr-chips">{SOURCE_CHOICES.map(([k, label]) => <button key={k} type="button" className="gr-chip" aria-pressed={source === k} onClick={() => setSource(k)}>{label}</button>)}</div>
        <div className="gr-link">
          <Icons.link width={16} height={16} style={{ color: "var(--act)", flex: "none" }} />
          <code>{link.replace(/^https?:\/\//, "")}</code>
          <button className="btn ghost sm" onClick={() => void copyText(link).then((ok) => ok && say("Form link copied"))}><Icons.copy width={14} height={14} /> Copy</button>
        </div>
        <a className="btn ghost sm" style={{ alignSelf: "flex-start", textDecoration: "none" }} href={link} target="_blank" rel="noreferrer"><Icons.eye width={14} height={14} /> See the form</a>
        {counts.length > 0 && <p className="tiny" style={{ margin: 0 }}>Leads so far: {counts.map((c) => `${sourceLabel(c.source)} ${c.count}`).join(" · ")}</p>}
      </section>

      <section className="card stack" style={{ gap: 10 }}>
        <div><h2 className="h3" style={{ margin: 0 }}>On your own website</h2><p className="tiny" style={{ margin: "4px 0 0" }}>Paste this where you want the form (Wix, Squarespace and WordPress all take an "embed code" block).</p></div>
        <textarea className="ld-code" readOnly value={code} onFocus={(e) => e.currentTarget.select()} aria-label="Embed code" />
        <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => void copyText(code).then((ok) => ok && say("Embed code copied"))}><Icons.copy width={14} height={14} /> Copy code</button>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <div><h2 className="h3" style={{ margin: 0 }}>Welcome email</h2><p className="tiny" style={{ margin: "4px 0 0" }}>Everyone who sends the form gets this straight away, so nobody waits in silence.</p></div>
        {needsUpdate && <p className="small" role="alert" style={{ margin: 0, color: "var(--warn)" }}>Needs a database update first: run {LEADS_SQL} in Supabase.</p>}
        {settings && (
          <>
            <label className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <input type="checkbox" role="switch" checked={settings.welcomeOn} onChange={(e) => setSettings({ ...settings, welcomeOn: e.target.checked })} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
              <span className="grow"><b className="small" style={{ color: "var(--text)" }}>Send a welcome email</b><br /><span className="tiny">From APEX, signed by you. Replies come to your email.</span></span>
            </label>
            {settings.welcomeOn && (
              <>
                <label className="stack" style={{ gap: 6 }}>
                  <span className="tiny">Your words <span className="num">{WELCOME_MAX - settings.welcomeText.trim().length}</span> · {"{first}"} becomes their first name</span>
                  <textarea className="field" rows={5} maxLength={WELCOME_MAX} placeholder={welcomeBody("", "{first}")} value={settings.welcomeText} onChange={(e) => setSettings({ ...settings, welcomeText: e.target.value })} />
                </label>
                <span className="tiny">Preview</span>
                <WelcomePreview coachName={page.name} body={`Hi Hana,\n\n${welcomeBody(settings.welcomeText, "Hana")}`} />
              </>
            )}
            <label className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <input type="checkbox" role="switch" checked={settings.notifyOn} onChange={(e) => setSettings({ ...settings, notifyOn: e.target.checked })} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
              <span className="grow"><b className="small" style={{ color: "var(--text)" }}>Email me about each new lead</b><br /><span className="tiny">With their goal and message, and a link back here.</span></span>
            </label>
            <p className="tiny" style={{ margin: 0 }}>{LEAD_PRIVACY_NOTE}</p>
            <button className="btn act block" disabled={!dirty || needsUpdate} onClick={() => void save()}>Save</button>
          </>
        )}
      </section>
    </>
  );
}
