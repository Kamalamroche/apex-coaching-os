import { CLASS_TITLE_MAX, classAvailability, classProblem, classRoster, type ClassSpot, type ClassView } from "@apex/core";
import { BackLink, ClassCard, Icons, Sheet } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { useExtras, type ClassInput } from "../../data/extras";

type Form = { id?: string; title: string; date: string; time: string; minutes: string; capacity: string; place: string; note: string };

const pad = (n: number) => String(n).padStart(2, "0");
const localParts = (iso: string) => { const d = new Date(iso); return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; };
const blank = (): Form => { const t = new Date(Date.now() + 2 * 864e5); t.setHours(9, 0, 0, 0); return { title: "", ...localParts(t.toISOString()), minutes: "45", capacity: "8", place: "", note: "" }; };
const toInput = (f: Form): ClassInput => ({ id: f.id, title: f.title, startsAt: new Date(`${f.date}T${f.time}`).toISOString(), minutes: Number(f.minutes) || 0, capacity: Number(f.capacity) || 0, place: f.place, note: f.note });

/** Coach: group classes with a place limit. Full classes take a waitlist that moves up by itself when someone drops out. */
export function CoachClasses({ onBack, say }: { onBack: () => void; say: (m: string) => void }) {
  const api = useExtras();
  const [list, setList] = useState<ClassView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [open, setOpen] = useState<ClassView | null>(null);
  const [spots, setSpots] = useState<ClassSpot[] | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    if (!api) return;
    try { setList(await api.classes.list()); setError(null); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!api || !open) { setSpots(null); return; }
    api.classes.spots(open.id).then(setSpots, (e: unknown) => say(e instanceof Error ? e.message : String(e)));
  }, [api, open, say]);
  if (!api) return null;

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await fn(); say(done); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
    await reload();
  };
  const save = async () => {
    if (!form) return;
    const input = toInput(form);
    const p = classProblem(input, new Date());
    if (p) return say(p);
    await act(() => api.classes.save(input), form.id ? "Class updated" : "Class added. Clients can book it now");
    setForm(null);
    setOpen(null);
  };
  const removeSpot = async (c: ClassView, s: ClassSpot) => {
    if (!confirm(`Take ${s.name} off ${c.title}?${s.status === "booked" && c.waiting ? " The next person on the waitlist gets the place." : ""}`)) return;
    await act(() => api.classes.leave(c.id, s.clientId), `${s.name.split(" ")[0]} taken off`);
    setSpots(await api.classes.spots(c.id).catch(() => null));
  };
  const roster = spots ? classRoster(spots) : null;

  return (
    <>
      <BackLink onClick={onBack}>Business</BackLink>
      <div><div className="eyebrow">Business</div><h1 className="h1">Group classes</h1></div>
      <p className="small" style={{ margin: 0 }}>Set a place limit and clients book from their app. When a class is full they join the waitlist, and the first in line moves up automatically when a place frees up.</p>
      {error && <div className="card small">{error}</div>}
      {!list && !error && <div className="card small">Loading…</div>}
      {list && list.length === 0 && <div className="card small">No classes coming up. Add your first one.</div>}
      {list && list.map((c, i) => (
        <ClassCard key={c.id} i={i} {...c} line={classAvailability(c)}>
          <button className="btn ghost sm" onClick={() => setOpen(c)}>{c.cancelled ? "View" : "Who's coming"}</button>
        </ClassCard>
      ))}
      <button className="btn act block" onClick={() => setForm(blank())}><Icons.plus width={16} height={16} /> New class</button>

      {open && !form && (
        <Sheet label={open.title} onClose={() => setOpen(null)}>
          <div className="stack" style={{ gap: 10 }}>
            <div className="sect" style={{ margin: 0 }}><h2 className="h2">{open.title}</h2><button className="iconbtn" onClick={() => setOpen(null)}>Close</button></div>
            <div className="small">{new Date(open.startsAt).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · {open.minutes} min{open.place ? ` · ${open.place}` : ""}</div>
            {open.note && <div className="small">{open.note}</div>}
            {!roster && <div className="small">Loading…</div>}
            {roster && (
              <>
                <div className="sect" style={{ margin: 0 }}><h3 className="h3">Booked</h3><span className="tiny num">{roster.booked.length} of {open.capacity}</span></div>
                {roster.booked.length === 0 && <div className="small">Nobody yet.</div>}
                {roster.booked.map((s) => (
                  <div key={s.clientId} className="xa-row small"><span className="xa-dot ok" />{s.name}<span className="grow" />{!open.cancelled && <button className="iconbtn" aria-label={`Take ${s.name} off`} disabled={busy} onClick={() => void removeSpot(open, s)}><Icons.trash width={14} height={14} /></button>}</div>
                ))}
                {roster.waiting.length > 0 && <div className="sect" style={{ margin: 0 }}><h3 className="h3">Waitlist</h3><span className="tiny">In order</span></div>}
                {roster.waiting.map((s, k) => (
                  <div key={s.clientId} className="xa-row small"><span className="num tiny" style={{ width: 16 }}>{k + 1}</span>{s.name}<span className="grow" />{!open.cancelled && <button className="iconbtn" aria-label={`Take ${s.name} off`} disabled={busy} onClick={() => void removeSpot(open, s)}><Icons.trash width={14} height={14} /></button>}</div>
                ))}
              </>
            )}
            {!open.cancelled && (
              <div className="row">
                <button className="btn ghost" style={{ flex: 1 }} disabled={busy} onClick={() => { if (confirm(`Cancel ${open.title}? Everyone booked sees it as cancelled.`)) void act(() => api.classes.cancel(open.id), "Class cancelled").then(() => setOpen(null)); }}>Cancel class</button>
                <button className="btn act" style={{ flex: 1 }} onClick={() => setForm({ id: open.id, title: open.title, ...localParts(open.startsAt), minutes: String(open.minutes), capacity: String(open.capacity), place: open.place, note: open.note })}><Icons.edit width={15} height={15} /> Edit</button>
              </div>
            )}
          </div>
        </Sheet>
      )}

      {form && (
        <Sheet label={form.id ? "Edit class" : "New class"} onClose={() => setForm(null)}>
          <div className="stack" style={{ gap: 10 }}>
            <div className="sect" style={{ margin: 0 }}><h2 className="h2">{form.id ? "Edit class" : "New class"}</h2><button className="iconbtn" onClick={() => setForm(null)}>Close</button></div>
            <input className="field" aria-label="Class name" placeholder="Name, e.g. Saturday circuits" maxLength={CLASS_TITLE_MAX} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="row">
              <input className="field" type="date" aria-label="Date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <input className="field" type="time" aria-label="Start time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
            <div className="row">
              <label className="grow tiny">Minutes<input className="field num" inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value.replace(/\D/g, "") })} /></label>
              <label className="grow tiny">Places<input className="field num" inputMode="numeric" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value.replace(/\D/g, "") })} /></label>
            </div>
            <input className="field" aria-label="Where" placeholder="Where, e.g. Studio 2 or Online" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} />
            <textarea className="field" aria-label="Note for clients" rows={2} placeholder="Note for clients (optional), e.g. bring water" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            {form.id && <div className="tiny">More places? The waitlist moves up straight away.</div>}
            <div className="row">
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setForm(null)}>Cancel</button>
              <button className="btn act" style={{ flex: 1 }} disabled={busy} onClick={() => void save()}>Save</button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
