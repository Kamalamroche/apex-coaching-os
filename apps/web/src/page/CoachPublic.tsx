import { formatPrice, guestProblem, readBookLink, serviceCard, serviceLine, whenLabel, GUEST_NOTE_MAX, type GuestDraft, type Service, GOAL_CHOICES, MODE_LABEL, REQUEST_MESSAGE_MAX, readFormLink, readPageLink, requestProblem, type CoachPage, type JoinRequestDraft, type TrainingModeName } from "@apex/core";
import { Celebrate, CoachPageView, EditorialTitle, Icons, ServiceMenu, Sheet, ThemeButton } from "@apex/ui";
import { SlotPicker } from "../app/BookingParts";
import { useEffect, useMemo, useState } from "react";
import { demoPublicPage, livePublicPage, type PublicBookingMenu } from "../data/growth";
import { isDemo, supabase } from "../data/supabase";
import { ProgrammeShelf } from "./ProgrammeShelf";

/** A coach's public page (/c/?k=kamal or /c/kamal/). Anyone can read it and ask to train. A friend's code rides along in ?ref=.
    ?form=1 opens the enquiry form straight away, ?embed=1 shows only the form (for the coach's own website), ?src= tags where the link was shared. */
export function CoachPublic() {
  const api = useMemo(() => (isDemo() || !supabase ? demoPublicPage() : livePublicPage(supabase)), []);
  const { slug, ref } = useMemo(() => {
    const r = readPageLink(location.pathname, location.search);
    return { slug: r.slug ?? (api.live ? null : "kamal"), ref: r.ref };
  }, [api.live]);
  const link = useMemo(() => readFormLink(location.search), []);
  const [page, setPage] = useState<CoachPage | null | undefined>(undefined);
  const [asking, setAsking] = useState(link.form && !link.embed);
  const [sent, setSent] = useState(false);
  const [interest, setInterest] = useState("");
  const bookLink = useMemo(() => readBookLink(location.search), []);
  const [menu, setMenu] = useState<PublicBookingMenu | null>(null);
  const [booking, setBooking] = useState<string | null | false>(false);

  useEffect(() => {
    if (!slug) { setPage(null); return; }
    api.load(slug).then(setPage, () => setPage(null));
    api.bookingMenu(slug).then((m) => {
      setMenu(m);
      // ?book=1 opens the booking straight away; ?book=<service> opens on that service.
      if (m && m.services.length && m.settings?.windows.length && bookLink.open) setBooking(m.services.some((x) => x.id === bookLink.serviceId) ? bookLink.serviceId : m.services.length === 1 ? m.services[0]!.id : null);
    }, () => setMenu(null));
  }, [api, slug, bookLink]);
  useEffect(() => {
    if (page) document.title = `${page.name} · Train with me · APEX`;
  }, [page]);

  if (page === undefined) return <main className="gr-shell"><div className="gr-wait" aria-label="Loading" /></main>;
  if (!page) {
    return (
      <main className="gr-shell">
        <Top />
        <div className="gr-sent" style={{ marginTop: 40 }}>
          <EditorialTitle as="h1" text="Page not found" caption="Check the link" />
          <p>This coach page isn't open right now. Ask your coach for their latest link.</p>
          <a className="btn ghost" href="/">About APEX</a>
        </div>
      </main>
    );
  }
  const first = page.name.split(" ")[0] || page.name;
  const canBook = !!menu && menu.services.length > 0 && !!menu.settings?.windows.length;
  const send = async (d: JoinRequestDraft) => { await api.request(page.slug, d, ref, link.source); setSent(true); };
  if (link.embed) {
    return (
      <main className="gr-shell" style={{ minHeight: 0 }}>
        {sent ? <Sent first={first} /> : <RequestForm first={first} modes={page.modes} referred={!!ref} onSend={send} />}
      </main>
    );
  }
  return (
    <main className="gr-shell">
      <Top />
      <CoachPageView
        page={page}
        action={sent
          ? <span className="gr-cta glass" role="status"><Icons.check width={16} height={16} /> Sent · {first} will be in touch</span>
          : <button className="gr-cta" onClick={() => setAsking(true)}>Train with {first} <Icons.arrow width={15} height={15} /></button>}
      />
      {canBook && menu && (
        <section className="gr-book" aria-label={`Book with ${first}`}>
          <EditorialTitle as="h2" text="Book a time" caption="Pick a service" className="gr-form-title" />
          <ServiceMenu services={menu.services.map(serviceCard)} value={null} onChange={(id) => setBooking(id)} label={`Services from ${first}`} />
        </section>
      )}
      <ProgrammeShelf slug={page.slug} first={first} onPick={(p) => { setInterest(`I'm interested in ${p.title} (${formatPrice(p.pricePence)}).`); setAsking(true); }} />
      {!sent && <button className="gr-cta" style={{ animationDelay: "0s" }} onClick={() => { setInterest(""); setAsking(true); }}>Ask to train with {first}</button>}
      {booking !== false && canBook && menu && (
        <Sheet label={`Book with ${first}`} onClose={() => setBooking(false)}>
          <GuestBooking first={first} menu={menu} initial={booking} onBook={(serviceId, at, d) => api.bookAsGuest(page.slug, serviceId, at, d, link.source)} onDone={() => { setBooking(false); void api.bookingMenu(page.slug).then(setMenu, () => undefined); }} />
        </Sheet>
      )}
      {asking && (
        <Sheet label={`Train with ${first}`} onClose={() => setAsking(false)}>
          {sent
            ? <Sent first={first} onDone={() => setAsking(false)} />
            : <RequestForm key={interest} first={first} modes={page.modes} referred={!!ref} message={interest} onSend={send} />}
        </Sheet>
      )}
    </main>
  );
}

function Top() {
  return (
    <div className="gr-top">
      <a className="wordmark" href="/" style={{ gap: 8, textDecoration: "none", color: "inherit" }}><Icons.logo width={20} height={20} /><b style={{ fontSize: 16 }}>APEX</b></a>
      <ThemeButton />
    </div>
  );
}

function RequestForm({ first, modes, referred, message = "", onSend }: { first: string; modes: TrainingModeName[]; referred: boolean; message?: string; onSend: (d: JoinRequestDraft) => Promise<void> }) {
  const [d, setD] = useState<JoinRequestDraft>({ name: "", email: "", goal: "", message, phone: "", how: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof JoinRequestDraft, v: string) => { setD((x) => ({ ...x, [k]: v })); setError(null); };
  const send = async () => {
    const problem = requestProblem(d);
    if (problem) { setError(problem); return; }
    setBusy(true);
    try { await onSend(d); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <div>
        <EditorialTitle as="h2" text={`Train with ${first}`} caption={referred ? "A friend sent you" : "Ask, no strings"} className="gr-form-title" />
        <p className="small" style={{ margin: "8px 0 0" }}>{first} reads every request and replies personally.</p>
      </div>
      <label className="stack" style={{ gap: 6 }}><span className="tiny">Your name</span><input className="field" autoComplete="name" value={d.name} onChange={(e) => set("name", e.target.value)} /></label>
      <label className="stack" style={{ gap: 6 }}><span className="tiny">Email</span><input className="field" type="email" autoComplete="email" inputMode="email" value={d.email} onChange={(e) => set("email", e.target.value)} /></label>
      <label className="stack" style={{ gap: 6 }}><span className="tiny">Phone (optional, if you'd rather talk)</span><input className="field" type="tel" autoComplete="tel" inputMode="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} /></label>
      <div className="stack" style={{ gap: 6 }}>
        <span className="tiny">Your main goal</span>
        <div className="gr-chips" role="group" aria-label="Your main goal">
          {GOAL_CHOICES.map((g) => <button key={g} type="button" className="gr-chip" aria-pressed={d.goal === g} onClick={() => set("goal", d.goal === g ? "" : g)}>{g}</button>)}
        </div>
      </div>
      {modes.length > 1 && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="tiny">How you'd like to train</span>
          <div className="gr-chips" role="group" aria-label="How you'd like to train">
            {modes.map((m) => <button key={m} type="button" className="gr-chip" aria-pressed={d.how === m} onClick={() => set("how", d.how === m ? "" : m)}>{MODE_LABEL[m]}</button>)}
          </div>
        </div>
      )}
      <label className="stack" style={{ gap: 6 }}><span className="tiny">Anything {first} should know (optional)</span><textarea className="field" rows={3} maxLength={REQUEST_MESSAGE_MAX} value={d.message} onChange={(e) => set("message", e.target.value)} /></label>
      {error && <p className="small" role="alert" style={{ margin: 0, color: "var(--crit)" }}>{error}</p>}
      <button className="gr-cta" style={{ animation: "none" }} disabled={busy}>{busy ? "Sending…" : "Send my request"}</button>
      <p className="tiny" style={{ margin: 0 }}>We share your name, email and answers with {first} only. See <a href="/legal/#privacy">privacy</a>.</p>
    </form>
  );
}

function Sent({ first, onDone }: { first: string; onDone?: () => void }) {
  return (
    <div className="gr-sent">
      <Celebrate />
      <span className="gr-tick"><Icons.check width={24} height={24} /></span>
      <EditorialTitle as="h2" text="Request sent" caption={`${first} will be in touch`} />
      <p>Look out for an email from {first}. When you're invited, the link opens the APEX app and connects you to {first} straight away.</p>
      {onDone && <button className="btn ghost block" onClick={onDone}>Done</button>}
    </div>
  );
}

/** Someone new books a service: pick it, pick a free time, leave a name and email. The coach confirms. */
function GuestBooking({ first, menu, initial, onBook, onDone }: { first: string; menu: PublicBookingMenu; initial: string | null; onBook: (serviceId: string, at: string, d: GuestDraft) => Promise<void>; onDone: () => void }) {
  const [svc, setSvc] = useState<Service | null>(menu.services.find((x) => x.id === initial) ?? null);
  const [slot, setSlot] = useState<string | null>(null);
  const [d, setD] = useState<GuestDraft>({ name: "", email: "", phone: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const set = (k: keyof GuestDraft, v: string) => { setD((x) => ({ ...x, [k]: v })); setError(null); };
  const send = async () => {
    if (!svc || !slot) return;
    const p = guestProblem(d);
    if (p) { setError(p); return; }
    setBusy(true);
    try { await onBook(svc.id, slot, d); setSent(slot); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setSlot(null); }
    setBusy(false);
  };
  if (sent && svc) {
    return (
      <div className="gr-sent">
        <Celebrate />
        <span className="gr-tick"><Icons.check width={24} height={24} /></span>
        <EditorialTitle as="h2" text="Time held" caption={`${first} will confirm`} />
        <p><b>{svc.name}</b>, {whenLabel(sent)}. The time is held for you. {first} will confirm by email{svc.pricePence ? ` and tell you how to pay (${formatPrice(svc.pricePence)})` : ""}.</p>
        <button className="btn ghost block" onClick={onDone}>Done</button>
      </div>
    );
  }
  if (!svc) {
    return (
      <div className="stack" style={{ gap: 14 }}>
        <EditorialTitle as="h2" text={`Book with ${first}`} caption="Pick a service" className="gr-form-title" />
        <ServiceMenu services={menu.services.map(serviceCard)} value={null} onChange={(id) => setSvc(menu.services.find((x) => x.id === id) ?? null)} />
      </div>
    );
  }
  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <div>
        <EditorialTitle as="h2" text={svc.name} caption={serviceLine(svc)} className="gr-form-title" />
        {menu.services.length > 1 && <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => { setSvc(null); setSlot(null); }}><Icons.back width={14} height={14} /> Other services</button>}
      </div>
      {menu.settings && <SlotPicker settings={menu.settings} busy={menu.busy} value={slot} onChange={setSlot} lengthMin={svc.minutes} />}
      {slot && (
        <>
          <label className="stack" style={{ gap: 6 }}><span className="tiny">Your name</span><input className="field" autoComplete="name" value={d.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="stack" style={{ gap: 6 }}><span className="tiny">Email</span><input className="field" type="email" autoComplete="email" inputMode="email" value={d.email} onChange={(e) => set("email", e.target.value)} /></label>
          <label className="stack" style={{ gap: 6 }}><span className="tiny">Phone (optional)</span><input className="field" type="tel" autoComplete="tel" inputMode="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} /></label>
          <label className="stack" style={{ gap: 6 }}><span className="tiny">Anything {first} should know (optional)</span><textarea className="field" rows={2} maxLength={GUEST_NOTE_MAX} value={d.note} onChange={(e) => set("note", e.target.value)} /></label>
        </>
      )}
      {error && <p className="small" role="alert" style={{ margin: 0, color: "var(--crit)" }}>{error}</p>}
      <button className="gr-cta" style={{ animation: "none" }} disabled={busy || !slot}>{busy ? "Booking…" : slot ? `Book ${whenLabel(slot)}` : "Pick a time"}</button>
      <p className="tiny" style={{ margin: 0 }}>{svc.pricePence ? `${formatPrice(svc.pricePence)}, paid to ${first} directly. ` : ""}We share your name, email and note with {first} only. See <a href="/legal/#privacy">privacy</a>.</p>
    </form>
  );
}
