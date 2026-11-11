import {
  GUEST_STATUS_LABEL, SERVICE_DESCRIPTION_MAX, SERVICE_MINUTES, SERVICE_NAME_MAX, bookingLink, confirmText, durationLabel, formatPrice, guestQueue, moveService, newService, parsePrice, serviceLine, serviceProblem, whenLabel,
  type CoachPage, type GuestBooking, type Service,
} from "@apex/core";
import { BookingLinkCard, Icons, Label, Sheet } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import type { BookingData } from "../../app/BookingParts";
import { SERVICES_NEED_UPDATE, useBookingApi } from "../../data/bookings";
import { useGrowthApi } from "../../data/growth";

/** Coach: the service menu (what clients and new people can book, with prices), the booking link to share,
    and bookings from people who aren't clients yet, to confirm or decline. */
export function ServicesDesk({ data, say, onHours }: { data: BookingData; say: (m: string) => void; onHours: () => void }) {
  const api = useBookingApi();
  const growth = useGrowthApi();
  const { coachName } = useAppInfo();
  const [list, setList] = useState<Service[] | null>(null);
  const [ready, setReady] = useState(true);
  const [guests, setGuests] = useState<GuestBooking[]>([]);
  const [page, setPage] = useState<CoachPage | null>(null);
  const [editing, setEditing] = useState<Service | null>(null);
  const [answered, setAnswered] = useState<GuestBooking | null>(null);

  const load = useCallback(async () => {
    if (!api) return;
    const [s, g] = await Promise.all([api.services(), api.guests()]);
    setList(s.list.sort((a, b) => a.position - b.position));
    setReady(s.ready);
    setGuests(g);
  }, [api]);
  useEffect(() => { void load().catch((e: Error) => say(e.message)); }, [load, say]);
  useEffect(() => { growth?.page().then(setPage, () => setPage(null)); }, [growth]);
  if (!api) return null;
  if (!ready) return <div className="card small full">{SERVICES_NEED_UPDATE} Then reload this page.</div>;

  const run = async (fn: () => Promise<void>, done: string) => {
    try { await fn(); say(done); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    await load();
    await data.reload();
  };
  const reorder = (id: string, by: -1 | 1) => list && void run(() => api.saveServices(moveService(list, id, by)), "Menu order saved");
  const answer = (g: GuestBooking, status: "confirmed" | "declined") => void run(async () => {
    await api.answerGuest(g.id, status);
    if (status === "confirmed") setAnswered(g);
  }, status === "confirmed" ? `${g.name.split(" ")[0]} · confirmed` : "Declined · the time is free again");

  const queue = guestQueue(guests, new Date());
  const waiting = queue.filter((g) => g.status === "requested").length;
  const open = (list ?? []).filter((s) => s.active && s.audience === "everyone").length;
  const link = page?.slug ? bookingLink(location.origin, page.slug) : null;

  return (
    <>
      {queue.length > 0 && (
        <section className="full card">
          <div className="sect"><h2 className="h3">Booked from your link</h2>{waiting > 0 ? <span className="sv-tag wait">{waiting} to confirm</span> : <span className="tiny">All confirmed</span>}</div>
          {queue.map((g) => (
            <div key={g.id} className="sv-row" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
              <span className="ss-when">{whenLabel(g.startsAt).replace(" at ", "\n")}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="h3">{g.name}</div>
                <div className="tiny">{g.serviceName} · {formatPrice(g.pricePence)} · <a href={`mailto:${g.email}`}>{g.email}</a>{g.phone ? ` · ${g.phone}` : ""}</div>
                {g.note && <div className="small" style={{ marginTop: 4 }}>“{g.note}”</div>}
              </div>
              {g.status === "requested" ? (
                <div className="ss-acts">
                  <button className="btn act sm" onClick={() => answer(g, "confirmed")}>Confirm</button>
                  <button className="btn ghost sm" onClick={() => answer(g, "declined")}>Decline</button>
                </div>
              ) : <span className="sv-tag open">{GUEST_STATUS_LABEL[g.status]}</span>}
            </div>
          ))}
          <p className="tiny" style={{ margin: "8px 0 0" }}>Each person is also in Leads, so you can follow up and invite them to the app.</p>
        </section>
      )}

      <section className="full card stack">
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Your services</h2><span className="tiny">{(list ?? []).filter((s) => s.active).length} on the menu</span></div>
        <p className="tiny" style={{ margin: 0 }}>Clients choose from these when they book. Ones open to everyone also show on your page, so new people can book a time without an account. Payment is in person or by bank transfer for now.</p>
        {!list && <div className="small">Loading…</div>}
        {list?.map((s, i) => (
          <div key={s.id} className={`sv-row ${s.active ? "" : "off"}`}>
            <div className="sv-move">
              <button aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => reorder(s.id, -1)}>▲</button>
              <button aria-label={`Move ${s.name} down`} disabled={i === list.length - 1} onClick={() => reorder(s.id, 1)}>▼</button>
            </div>
            <span className="hb-ico" aria-hidden>{s.kind === "call" ? <Icons.video /> : <Icons.train />}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="h3">{s.name}</div>
              <div className="tiny num">{serviceLine(s)} · {s.kind === "call" ? "Video call" : "In person"}</div>
            </div>
            <span className={`sv-tag ${s.active && s.audience === "everyone" ? "open" : ""}`}>{!s.active ? "Hidden" : s.audience === "everyone" ? "Everyone" : "Clients"}</span>
            <button className="iconbtn" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Icons.edit width={16} height={16} /></button>
          </div>
        ))}
        <button className="btn ghost" onClick={() => setEditing(newService(list?.length ?? 0))}><Icons.plus width={16} height={16} /> Add a service</button>
      </section>

      <section className="full">
        {link ? (
          <BookingLinkCard
            link={link}
            caption={open ? `Opens your page on the booking step: ${open} service${open === 1 ? "" : "s"}, your free times, and a short form. Put it in your Instagram bio or send it in a DM.` : "Mark a service as open to everyone to show it on this link."}
            onCopy={() => { void navigator.clipboard?.writeText(link).then(() => say("Booking link copied"), () => say(link)); }}
          />
        ) : (
          <div className="card small">Your booking link lives on your public page. Publish it in Grow first, then come back to copy the link.</div>
        )}
        {data.settings && data.settings.windows.length === 0 && (
          <div className="card small" style={{ marginTop: 10 }}>Nobody can book until you set your hours. <button className="btn ghost sm" onClick={onHours}>Set your hours</button></div>
        )}
      </section>

      {editing && (
        <ServiceEditor
          service={editing}
          isNew={!list?.some((s) => s.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(s) => run(async () => { await api.saveServices([s]); setEditing(null); }, `${s.name.trim()} saved`)}
          onRemove={(id) => run(async () => { await api.removeService(id); setEditing(null); }, "Service removed")}
        />
      )}

      {answered && (
        <Sheet label="Let them know" onClose={() => setAnswered(null)}>
          <div className="row"><Label kind="dec">Coach decision</Label><span className="tiny">Confirmed. Send them a note</span></div>
          <h2 className="h2">Let {answered.name.split(" ")[0]} know</h2>
          <textarea className="field" rows={4} readOnly value={confirmText(answered, coachName)} />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <a className="btn act" style={{ textDecoration: "none" }} href={`mailto:${answered.email}?subject=${encodeURIComponent(`You're booked in: ${answered.serviceName}`)}&body=${encodeURIComponent(confirmText(answered, coachName))}`}><Icons.mail width={16} height={16} /> Email it</a>
            <button className="btn ghost" onClick={() => { void navigator.clipboard?.writeText(confirmText(answered, coachName)).then(() => say("Copied"), () => undefined); }}><Icons.copy width={16} height={16} /> Copy</button>
            <button className="btn ghost" onClick={() => setAnswered(null)}>Done</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function ServiceEditor({ service, isNew, onClose, onSave, onRemove }: { service: Service; isNew: boolean; onClose: () => void; onSave: (s: Service) => Promise<void>; onRemove: (id: string) => Promise<void> }) {
  const [s, setS] = useState(service);
  const [price, setPrice] = useState(service.pricePence ? String(service.pricePence / 100) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Service>(k: K, v: Service[K]) => { setS((x) => ({ ...x, [k]: v })); setError(null); };
  const save = async () => {
    const pence = parsePrice(price);
    if (pence === null) return setError("Check the price, e.g. 45 or 45.50. Leave it empty for free.");
    const next = { ...s, name: s.name.trim(), pricePence: pence };
    const p = serviceProblem(next);
    if (p) return setError(p);
    setBusy(true);
    await onSave(next);
    setBusy(false);
  };
  return (
    <Sheet label={isNew ? "Add a service" : `Edit ${service.name}`} onClose={onClose}>
      <div><div className="eyebrow">Service menu</div><h2 className="h2">{isNew ? "Add a service" : "Edit service"}</h2></div>
      <label className="stack" style={{ gap: 6 }}><span className="tiny">Name</span><input className="field" maxLength={SERVICE_NAME_MAX} value={s.name} placeholder="e.g. Personal training session" onChange={(e) => set("name", e.target.value)} autoFocus /></label>
      <div className="stack" style={{ gap: 6 }}>
        <span className="tiny">How long</span>
        <div className="pb-pick">{SERVICE_MINUTES.map((m) => <button key={m} className={`chip ${s.minutes === m ? "on" : ""}`} aria-pressed={s.minutes === m} onClick={() => set("minutes", m)}>{durationLabel(m)}</button>)}</div>
      </div>
      <label className="stack" style={{ gap: 6 }}><span className="tiny">Price in £ (empty for free)</span><input className="field num" inputMode="decimal" value={price} placeholder="Free" onChange={(e) => { setPrice(e.target.value); setError(null); }} /></label>
      <div className="stack" style={{ gap: 6 }}>
        <span className="tiny">Where</span>
        <div className="pb-pick">
          <button className={`chip ${s.kind === "session" ? "on" : ""}`} aria-pressed={s.kind === "session"} onClick={() => set("kind", "session")}>In person</button>
          <button className={`chip ${s.kind === "call" ? "on" : ""}`} aria-pressed={s.kind === "call"} onClick={() => set("kind", "call")}>Video call</button>
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="tiny">Who can book it</span>
        <div className="pb-pick">
          <button className={`chip ${s.audience === "everyone" ? "on" : ""}`} aria-pressed={s.audience === "everyone"} onClick={() => set("audience", "everyone")}>Everyone, from my link</button>
          <button className={`chip ${s.audience === "clients" ? "on" : ""}`} aria-pressed={s.audience === "clients"} onClick={() => set("audience", "clients")}>Clients only</button>
        </div>
      </div>
      <label className="stack" style={{ gap: 6 }}><span className="tiny">What's included (optional)</span><textarea className="field" rows={3} maxLength={SERVICE_DESCRIPTION_MAX} value={s.description} onChange={(e) => set("description", e.target.value)} /></label>
      <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={s.active} onChange={(e) => set("active", e.target.checked)} style={{ accentColor: "var(--act)", width: 18, height: 18 }} /><span className="small" style={{ color: "var(--text)" }}>On the menu</span></label>
      {error && <p className="small" role="alert" style={{ margin: 0, color: "var(--crit)" }}>{error}</p>}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn act" disabled={busy} onClick={() => void save()}>{isNew ? "Add to menu" : "Save"}</button>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        {!isNew && <button className="btn ghost" style={{ marginLeft: "auto", color: "var(--crit)" }} onClick={() => void onRemove(service.id)}>Remove</button>}
      </div>
    </Sheet>
  );
}
