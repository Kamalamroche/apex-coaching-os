import { formatPrice, GOAL_CHOICES, REQUEST_MESSAGE_MAX, readPageLink, requestProblem, type CoachPage, type JoinRequestDraft } from "@apex/core";
import { Celebrate, CoachPageView, EditorialTitle, Icons, Sheet, ThemeButton } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { demoPublicPage, livePublicPage } from "../data/growth";
import { isDemo, supabase } from "../data/supabase";
import { ProgrammeShelf } from "./ProgrammeShelf";

/** A coach's public page (/c/?k=kamal or /c/kamal/). Anyone can read it and ask to train. A friend's code rides along in ?ref=. */
export function CoachPublic() {
  const api = useMemo(() => (isDemo() || !supabase ? demoPublicPage() : livePublicPage(supabase)), []);
  const { slug, ref } = useMemo(() => {
    const r = readPageLink(location.pathname, location.search);
    return { slug: r.slug ?? (api.live ? null : "kamal"), ref: r.ref };
  }, [api.live]);
  const [page, setPage] = useState<CoachPage | null | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState(false);
  const [interest, setInterest] = useState("");

  useEffect(() => {
    if (!slug) { setPage(null); return; }
    api.load(slug).then(setPage, () => setPage(null));
  }, [api, slug]);
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
  return (
    <main className="gr-shell">
      <Top />
      <CoachPageView
        page={page}
        action={sent
          ? <span className="gr-cta glass" role="status"><Icons.check width={16} height={16} /> Sent · {first} will be in touch</span>
          : <button className="gr-cta" onClick={() => setAsking(true)}>Train with {first} <Icons.arrow width={15} height={15} /></button>}
      />
      <ProgrammeShelf slug={page.slug} first={first} onPick={(p) => { setInterest(`I'm interested in ${p.title} (${formatPrice(p.pricePence)}).`); setAsking(true); }} />
      {!sent && <button className="gr-cta" style={{ animationDelay: "0s" }} onClick={() => { setInterest(""); setAsking(true); }}>Ask to train with {first}</button>}
      {asking && (
        <Sheet label={`Train with ${first}`} onClose={() => setAsking(false)}>
          {sent
            ? <Sent first={first} onDone={() => setAsking(false)} />
            : <RequestForm key={interest} first={first} referred={!!ref} message={interest} onSend={async (d) => { await api.request(page.slug, d, ref); setSent(true); }} />}
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

function RequestForm({ first, referred, message = "", onSend }: { first: string; referred: boolean; message?: string; onSend: (d: JoinRequestDraft) => Promise<void> }) {
  const [d, setD] = useState<JoinRequestDraft>({ name: "", email: "", goal: "", message });
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
        <p className="small" style={{ margin: "8px 0 0" }}>{first} reads every request and replies by email with your invite.</p>
      </div>
      <label className="stack" style={{ gap: 6 }}><span className="tiny">Your name</span><input className="field" autoComplete="name" value={d.name} onChange={(e) => set("name", e.target.value)} /></label>
      <label className="stack" style={{ gap: 6 }}><span className="tiny">Email</span><input className="field" type="email" autoComplete="email" inputMode="email" value={d.email} onChange={(e) => set("email", e.target.value)} /></label>
      <div className="stack" style={{ gap: 6 }}>
        <span className="tiny">Your main goal</span>
        <div className="gr-chips" role="group" aria-label="Your main goal">
          {GOAL_CHOICES.map((g) => <button key={g} type="button" className="gr-chip" aria-pressed={d.goal === g} onClick={() => set("goal", d.goal === g ? "" : g)}>{g}</button>)}
        </div>
      </div>
      <label className="stack" style={{ gap: 6 }}><span className="tiny">Anything {first} should know (optional)</span><textarea className="field" rows={3} maxLength={REQUEST_MESSAGE_MAX} value={d.message} onChange={(e) => set("message", e.target.value)} /></label>
      {error && <p className="small" role="alert" style={{ margin: 0, color: "var(--crit)" }}>{error}</p>}
      <button className="gr-cta" style={{ animation: "none" }} disabled={busy}>{busy ? "Sending…" : "Send my request"}</button>
      <p className="tiny" style={{ margin: 0 }}>We share your name, email and answers with {first} only. See <a href="/legal/#privacy">privacy</a>.</p>
    </form>
  );
}

function Sent({ first, onDone }: { first: string; onDone: () => void }) {
  return (
    <div className="gr-sent">
      <Celebrate />
      <span className="gr-tick"><Icons.check width={24} height={24} /></span>
      <EditorialTitle as="h2" text="Request sent" caption={`${first} will be in touch`} />
      <p>Look out for an email with your invite. It opens the APEX app and links you to {first} straight away.</p>
      <button className="btn ghost block" onClick={onDone}>Done</button>
    </div>
  );
}
