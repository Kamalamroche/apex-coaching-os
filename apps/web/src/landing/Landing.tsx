import { useEffect, useRef, useState } from "react";
import { ApexLogo, Icons, ThemeButton, startApexLight } from "@apex/ui";
import { CLIENT_POINTS, CLIENT_SCREENS, FAQ, LABELS, PLANS, STEPS, TOUR } from "./content";

/* Public website at /. Sign-in and demos live at /start/, /coach/ and /client/.
   Midnight look: a night-blue banner with the moving APEX light, then calm paper sections built around
   real screens from the app. Copy and data live in content.ts. Only features that exist today are sold. */

/** The moving light behind the banner (see packages/ui/src/apexLight.ts). */
function Light({ className }: { className: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => (ref.current ? startApexLight(ref.current) : undefined), []);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

/** Fade sections in once as they scroll into view. Off for reduced motion (handled in CSS). */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".lp [data-reveal]"));
    if (typeof IntersectionObserver !== "function") {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

/** The header sits on the night banner until the page scrolls past it. */
function useOnBanner() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(([e]) => setOn(!!e?.isIntersecting), { rootMargin: "-64px 0px 0px 0px", threshold: 0 });
    io.observe(hero);
    return () => io.disconnect();
  }, []);
  return on;
}

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#clients", label: "Client app" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
  { href: "/trainers/", label: "Find a trainer" },
];

export function Landing() {
  useReveal();
  const onBanner = useOnBanner();
  const [menu, setMenu] = useState(false);
  const [tour, setTour] = useState(TOUR[0]!.id);
  const active = TOUR.find((t) => t.id === tour) ?? TOUR[0]!;

  return (
    <div className="lp">
      <header className={`lp-top ${onBanner && !menu ? "night" : ""}`}>
        <div className="lp-wrap lp-bar">
          <a href="/" className="lp-logo" aria-label="APEX home"><ApexLogo height={28} /></a>
          <nav className="lp-nav" aria-label="Sections">
            {NAV.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
          </nav>
          <div className="lp-bar-acts">
            <a className="lp-btn ghost hide-sm" href="/start/">Sign in</a>
            <a className="lp-btn solid" href="/coach/">Start free</a>
            <button className="lp-menu" aria-expanded={menu} aria-controls="lp-drawer" aria-label={menu ? "Close menu" : "Open menu"} onClick={() => setMenu((m) => !m)}>
              <i /><i />
            </button>
          </div>
        </div>
        {menu && (
          <nav id="lp-drawer" className="lp-drawer" aria-label="Menu">
            {NAV.map((n) => <a key={n.href} href={n.href} onClick={() => setMenu(false)}>{n.label}</a>)}
            <a href="/start/" onClick={() => setMenu(false)}>Sign in</a>
          </nav>
        )}
      </header>

      <main>
        {/* ---------- banner ---------- */}
        <section className="lp-hero" id="top">
          <Light className="lp-light" />
          <div className="lp-wrap lp-hero-copy">
            <p className="lp-eyebrow">Coaching software for personal trainers</p>
            <h1 className="lp-h1">Coach more people.<br />Keep it personal.</h1>
            <p className="lp-lead">Write the programmes, see who needs you each morning, and give every client an app that opens on today's session. You stay in charge of the training.</p>
            <div className="lp-ctas">
              <a className="lp-btn light lg" href="/coach/">Start free</a>
              <a className="lp-btn line lg" href="/coach/?demo">Try the demo <Icons.forward width={16} height={16} aria-hidden="true" /></a>
            </div>
            <p className="lp-small">Free for your first 3 clients. No card needed.</p>
          </div>
          <div className="lp-wrap lp-stage" data-reveal>
            <figure className="lp-browser">
              <span className="lp-dots" aria-hidden="true"><i /><i /><i /></span>
              <img src="/site/coach-brief-dark.webp" width={1600} height={1000} alt="The APEX coach app: a morning brief with active clients, sessions done this week and who needs you today" />
            </figure>
            <figure className="lp-phone">
              <img src="/site/client-today-dark.webp" width={780} height={1688} alt="The APEX client app opening on today's session" />
            </figure>
          </div>
        </section>

        {/* ---------- facts strip: only true statements ---------- */}
        <section className="lp-facts" aria-label="At a glance">
          <ul className="lp-wrap">
            <li><b>654</b><span>exercises with cues and steps</span></li>
            <li><b>Every</b><span>feature on every plan</span></li>
            <li><b>3</b><span>clients free, for good</span></li>
            <li><b>UK</b><span>built by a working coach</span></li>
          </ul>
        </section>

        {/* ---------- product tour ---------- */}
        <section className="lp-sec" id="product">
          <div className="lp-wrap">
            <header className="lp-head" data-reveal>
              <p className="lp-kick">The coach app</p>
              <h2 className="lp-h2">Everything you need to coach, in one calm place.</h2>
            </header>
            <div className="lp-tabs" role="tablist" aria-label="Coach app tour">
              {TOUR.map((t) => (
                <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={t.id === tour} aria-controls="tour-panel" onClick={() => setTour(t.id)}>
                  {(() => { const I = Icons[t.icon]; return <I width={16} height={16} aria-hidden="true" />; })()}
                  {t.tab}
                </button>
              ))}
            </div>
            <div className="lp-tour" id="tour-panel" role="tabpanel" aria-labelledby={`tab-${active.id}`} key={active.id}>
              <div className="lp-tour-copy">
                <h3 className="lp-h3">{active.title}</h3>
                <p className="lp-body">{active.body}</p>
                <ul className="lp-ticks">
                  {active.points.map((p) => <li key={p}><Icons.check width={16} height={16} aria-hidden="true" />{p}</li>)}
                </ul>
              </div>
              <figure className="lp-shot">
                <img src={active.shot} width={1600} height={1000} alt={active.alt} loading="lazy" />
              </figure>
            </div>
          </div>
        </section>

        {/* ---------- client app ---------- */}
        <section className="lp-sec alt" id="clients">
          <div className="lp-wrap">
            <header className="lp-head" data-reveal>
              <p className="lp-kick">The client app</p>
              <h2 className="lp-h2">Simple for your clients. Built around your plan.</h2>
              <p className="lp-body">Your clients see the session you wrote, the habits you set and the progress they are making. Nothing they need to work out for themselves.</p>
            </header>
            <ul className="lp-phones" data-reveal>
              {CLIENT_SCREENS.map((s) => (
                <li key={s.label}>
                  <figure className="lp-phone sm"><img src={s.src} width={780} height={1688} alt={s.alt} /></figure>
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
            <ul className="lp-grid4" data-reveal>
              {CLIENT_POINTS.map((p) => {
                const I = Icons[p.icon];
                return (
                  <li key={p.title}>
                    <I width={20} height={20} aria-hidden="true" />
                    <h3>{p.title}</h3>
                    <p>{p.body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ---------- coach in control ---------- */}
        <section className="lp-sec">
          <div className="lp-wrap lp-split">
            <header className="lp-head left" data-reveal>
              <p className="lp-kick">You stay in charge</p>
              <h2 className="lp-h2">Smart help that never coaches around you.</h2>
              <p className="lp-body">APEX reads the numbers and points out what changed. Every output says exactly what it is, and nothing reaches a client until you accept it.</p>
            </header>
            <ol className="lp-flow" data-reveal>
              {LABELS.map((l, i) => (
                <li key={l.kind} className={i === LABELS.length - 1 ? "end" : ""}>
                  <span className="lp-tag">{l.kind}</span>
                  <p>{l.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- how it works ---------- */}
        <section className="lp-sec alt" id="how">
          <div className="lp-wrap">
            <header className="lp-head" data-reveal>
              <p className="lp-kick">How it works</p>
              <h2 className="lp-h2">Up and running in an afternoon.</h2>
            </header>
            <ol className="lp-steps" data-reveal>
              {STEPS.map((s) => (
                <li key={s.n}>
                  <span className="lp-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- pricing ---------- */}
        <section className="lp-sec" id="pricing">
          <div className="lp-wrap">
            <header className="lp-head" data-reveal>
              <p className="lp-kick">Pricing</p>
              <h2 className="lp-h2">Every feature on every plan.</h2>
              <p className="lp-body">Pay for the number of clients you coach. Monthly, cancel any time.</p>
            </header>
            <ul className="lp-plans" data-reveal>
              {PLANS.map((p) => (
                <li key={p.name} className={p.featured ? "on" : ""}>
                  <div className="lp-plan-top">
                    <h3>{p.name}</h3>
                    {p.featured && <em>Most popular</em>}
                  </div>
                  <p className="lp-price"><b>{p.price}</b><small>/month</small></p>
                  <p className="lp-plan-clients">{p.clients}</p>
                  <p className="lp-plan-note">{p.note}</p>
                  <a className={`lp-btn ${p.featured ? "solid" : "ghost"}`} href="/coach/">{p.price === "£0" ? "Start free" : `Choose ${p.name}`}</a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="lp-sec alt" id="faq">
          <div className="lp-wrap lp-split">
            <header className="lp-head left" data-reveal>
              <p className="lp-kick">Questions</p>
              <h2 className="lp-h2">Good to know.</h2>
            </header>
            <div className="lp-faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}<Icons.plus width={18} height={18} aria-hidden="true" /></summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- closing banner ---------- */}
        <section className="lp-end">
          <Light className="lp-light" />
          <div className="lp-wrap lp-end-copy" data-reveal>
            <h2 className="lp-h2">Your next client deserves your best coaching.</h2>
            <div className="lp-ctas">
              <a className="lp-btn light lg" href="/coach/">Start free</a>
              <a className="lp-btn line lg" href="/client/?demo">See the client app</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-grid">
          <div className="lp-foot-brand">
            <a href="/" className="lp-logo" aria-label="APEX home"><ApexLogo height={24} /></a>
            <p>Coaching software for personal trainers. Made at HELIX.</p>
          </div>
          <nav aria-label="Product">
            <h3>Product</h3>
            <a href="#product">Coach app</a>
            <a href="#clients">Client app</a>
            <a href="#pricing">Pricing</a>
            <a href="/coach/?demo">Coach demo</a>
            <a href="/client/?demo">Client demo</a>
          </nav>
          <nav aria-label="Get started">
            <h3>Get started</h3>
            <a href="/coach/">Start free</a>
            <a href="/start/">Sign in</a>
            <a href="/trainers/">Find a trainer</a>
          </nav>
          <nav aria-label="Legal">
            <h3>Legal</h3>
            <a href="/legal/#privacy">Privacy</a>
            <a href="/legal/#terms">Terms</a>
          </nav>
        </div>
        <div className="lp-wrap lp-foot-base">
          <span>© {new Date().getFullYear()} APEX</span>
          <ThemeButton />
        </div>
      </footer>
    </div>
  );
}
