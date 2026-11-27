import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ApexLogo, Icons } from "@apex/ui";
import { CLIENT_POINTS, CLIENT_SCREENS, FAQ, END_POSTER, END_VIDEO, HERO_POSTER, HERO_STILL, HERO_STILL_SMALL, HERO_VIDEO, HERO_VIDEO_SMALL, LABELS, PLANS, STEPS, TOUR, CHAPTERS, MOVES } from "./content";
import { BriefPoster, GrowPoster, NextPoster, ShapePoster, TrainPoster } from "./Posters";

/** Moving banner: PUSH. PULL. LIFT. RUN. The active word moves the way the exercise moves (letters press forward,
    draw back, rise, or stride) and the photo beside it changes to match. Words are buttons, so anyone can pick one.
    Cycles every 4 s while on screen; reduced motion keeps the letters still and stops the cycle. */
function MoveBanner() {
  const [on, setOn] = useState(0);
  const [still] = useState(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [held, setHeld] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== "function") { setSeen(true); return; }
    const io = new IntersectionObserver((es) => setSeen(es.some((e) => e.isIntersecting)), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (still || held || !seen) return;
    const t = window.setInterval(() => setOn((x) => (x + 1) % MOVES.length), 4000);
    return () => window.clearInterval(t);
  }, [still, held, seen]);
  const m = MOVES[on] ?? MOVES[0]!;
  // only the clip on show plays, from the start, while the banner is on screen
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  useEffect(() => {
    vids.current.forEach((v, k) => {
      if (!v) return;
      if (k === on && seen) { v.currentTime = 0; void v.play().catch(() => {}); } else v.pause();
    });
  }, [on, seen]);
  return (
    <section className={`lp-move ${seen ? "seen" : ""}`} ref={ref} aria-labelledby="lp-move-h">
      <div className="lp-wrap">
        <div className="lp-move-card">
          <div className="lp-move-copy">
            <span className="lp-kick">Coaching that moves</span>
            <h2 className="lp-sr" id="lp-move-h">Push, pull, lift, run: coaching for every way your clients move</h2>
            <div className="lp-move-words" role="group" aria-label="Pick a movement">
              {MOVES.map((w, k) => (
                <button key={w.id} type="button" className={`lp-mv lp-mv-${w.id} ${k === on ? "on" : ""}`} aria-pressed={k === on}
                  onClick={() => { setOn(k); setHeld(true); }}>
                  {[...w.word.toUpperCase()].map((ch, j) => <i key={j} style={{ "--j": j } as CSSProperties}>{ch}</i>)}
                  <b style={{ "--j": w.word.length } as CSSProperties}>.</b>
                </button>
              ))}
            </div>
            <p>Every client moves differently. You write the plan for each one, and APEX carries it into their day: the session, the cues, the weights and the check-in after.</p>
            <Cta href="/coach/">Start free</Cta>
          </div>
          <figure className="lp-move-pic">
            {MOVES.map((w, k) => still
              ? <img key={w.id} className={k === on ? "on" : ""} src={w.photo} width={1080} height={1350} alt={k === on ? w.alt : ""} aria-hidden={k !== on} loading="lazy" />
              : <video key={w.id} ref={(el) => { vids.current[k] = el; }} className={k === on ? "on" : ""} src={w.video} poster={w.photo}
                  muted loop playsInline preload={k === on ? "auto" : "metadata"} aria-label={k === on ? w.alt : undefined} aria-hidden={k !== on} />)}
            {!still && !held && <i className="lp-move-bar" key={on} aria-hidden="true" />}
            <figcaption><span>{String(on + 1).padStart(2, "0")} / {String(MOVES.length).padStart(2, "0")}</span><span>{m.label}</span></figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

const CHAPTER_ART = { brief: BriefPoster, train: TrainPoster, grow: GrowPoster };

/* Public website at /. Sign-in and demos live at /start/, /coach/ and /client/.
   Ember look: black pages, deep maroon cards, one red-orange accent, and a full-screen banner video of the
   APEX light pyramid in red particles, where the logo erupts from inside it like molten fire. Copy and data live in content.ts. Only features that exist today are sold. */

/** Full-bleed looping video with its poster frame. Reduced motion shows the still instead. */
function PyramidVideo({ className, src, small, poster, still: stillSrc, stillSmall }: { className: string; src: string; small?: string; poster: string; still?: string; stillSmall?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [still] = useState(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver !== "function") return;
    /* pause when off screen, so the banner and the closing section never play at the same time */
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) void v.play().catch(() => {}); else v.pause(); });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  if (still || !src) return (
    <picture>
      {stillSmall && <source srcSet={stillSmall} media="(max-width: 760px)" />}
      <img className={className} src={stillSrc ?? poster} alt="" aria-hidden="true" />
    </picture>
  );
  return (
    <video ref={ref} className={className} poster={poster} autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
      {small && <source src={small} type="video/mp4" media="(max-width: 760px)" />}
      <source src={src} type="video/mp4" />
    </video>
  );
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

/** The header turns solid once the page scrolls. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return scrolled;
}

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#clients", label: "Client app" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
  { href: "/trainers/", label: "Find a trainer" },
];

/** Red call to action with the arrow tile, used across the page. */
function Cta({ href, children }: { href: string; children: string }) {
  return (
    <a className="lp-cta" href={href}>
      <span className="lp-cta-tile" aria-hidden="true"><Icons.forward width={14} height={14} /></span>
      <span className="lp-cta-label">{children}</span>
    </a>
  );
}

export function Landing() {
  useReveal();
  const scrolled = useScrolled();
  const [menu, setMenu] = useState(false);

  return (
    <div className="lp">
      <header className={`lp-top ${scrolled || menu ? "solid" : ""}`}>
        <div className="lp-wrap lp-bar">
          <a href="/" className="lp-logo" aria-label="APEX home"><ApexLogo height={26} /></a>
          <nav className="lp-nav" aria-label="Sections">
            {NAV.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
            <a href="/start/">Sign in</a>
          </nav>
          <div className="lp-bar-acts">
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
          <PyramidVideo className="lp-media" src={HERO_VIDEO} small={HERO_VIDEO_SMALL} poster={HERO_POSTER} still={HERO_STILL} stillSmall={HERO_STILL_SMALL} />
          <div className="lp-wrap lp-hero-grid">
            <h1 className="lp-h1"><b>Coaching software</b> for trainers who design the training.</h1>
            <div className="lp-hero-side">
              <p>Write the programmes, see who needs you each morning, and give every client an app that opens on today's session. Free for your first 3 clients.</p>
              <div className="lp-ctas">
                <Cta href="/coach/">Start free</Cta>
                <a className="lp-link" href="/coach/?demo">Try the demo</a>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- statement ---------- */}
        <section className="lp-sec" id="about">
          <div className="lp-wrap lp-statement">
            <div className="lp-statement-copy" data-reveal>
              <span className="lp-chip">Why APEX</span>
              <p className="lp-big"><b>Built by a working coach,</b> APEX puts programmes, clients, nutrition and the business side in one calm place, so you spend your time coaching instead of on admin.</p>
              <p className="lp-small">Every feature on every plan. 654 exercises with cues and steps. Nothing reaches a client until you say so.</p>
            </div>
            {/* The DAY 01 poster from the earlier site, unchanged in layout: the giant orange 01 sits between the
                studio backdrop and the cut-out athlete. Here it has no frame: the edges fade into the page and a
                warm red grade ties the photo to the pyramid video. */}
            <figure className="lp-day" data-reveal>
              <img className="lp-day-photo" src="/hero/hinge.webp" width={1080} height={1350} alt="" loading="lazy" />
              <span className="lp-day-spaced" aria-hidden="true">D A Y</span>
              <span className="lp-day-num" aria-hidden="true">01</span>
              <img className="lp-day-cut" src="/hero/hinge-cut.webp" width={1080} height={1350} alt="A HELIX athlete setting up a barbell deadlift" loading="lazy" />
              <i className="lp-day-glow" aria-hidden="true" />
              <span className="lp-day-meta tl" aria-hidden="true">Coaching OS<br />Season one</span>
              <span className="lp-day-meta br" aria-hidden="true">2026 // HELIX no. 01</span>
            </figure>
          </div>
        </section>

        {/* ---------- moving banner ---------- */}
        <MoveBanner />

        {/* ---------- product cards ---------- */}
        <section className="lp-sec" id="product">
          <div className="lp-wrap">
            <header className="lp-head" data-reveal>
              <h2 className="lp-h2">One place for the whole job</h2>
              <p>Everything you do in a coaching week, from the first programme to the monthly invoice.</p>
            </header>
          </div>
          {CHAPTERS.map((c, i) => {
            const Art = CHAPTER_ART[c.id];
            return (
              <div key={c.id} className={`lp-wrap lp-chapter ${i % 2 ? "flip" : ""}`}>
                <div data-reveal><Art /></div>
                <div className="lp-chapter-copy" data-reveal>
                  <span className="lp-kick"><i>{String(i + 1).padStart(2, "0")}</i>{c.kicker}</span>
                  <h3 className="lp-h2">{c.title}</h3>
                  <p>{c.body}</p>
                  <ul>{c.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
                </div>
              </div>
            );
          })}
          <div className="lp-wrap">
            <ul className="lp-index" data-reveal>
              {TOUR.filter((t) => t.id !== "brief" && t.id !== "client").map((t) => {
                const I = Icons[t.icon];
                return (
                  <li key={t.id}>
                    <I width={20} height={20} aria-hidden="true" />
                    <h3>{t.tab}</h3>
                    <p>{t.body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ---------- client app ---------- */}
        <section className="lp-sec" id="clients">
          <div className="lp-wrap">
            <header className="lp-head" data-reveal>
              <h2 className="lp-h2">Simple for your clients</h2>
              <p>They see the session you wrote, the habits you set and the progress they are making.</p>
            </header>
            <ul className="lp-phones" data-reveal>
              {CLIENT_SCREENS.map((s) => (
                <li key={s.label}>
                  <figure className="lp-phone"><img src={s.src} width={780} height={1688} alt={s.alt} /></figure>
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
              <span className="lp-chip">You stay in charge</span>
              <h2 className="lp-h2">Smart help that never coaches around you</h2>
              <p>APEX reads the numbers and points out what changed. Every output says exactly what it is, and nothing reaches a client until you accept it.</p>
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
        <section className="lp-sec" id="how">
          <div className="lp-wrap">
            <div className="lp-chapter flip">
              <div data-reveal><ShapePoster /></div>
              <div className="lp-chapter-copy" data-reveal>
                <span className="lp-kick">Built at HELIX</span>
                <h2 className="lp-h2">Up and running in an afternoon</h2>
                <ol className="lp-steps">
                  {STEPS.map((st) => (
                    <li key={st.n}>
                      <span className="lp-n">{st.n}</span>
                      <div><h3>{st.title}</h3><p>{st.body}</p></div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- pricing ---------- */}
        <section className="lp-sec" id="pricing">
          <div className="lp-wrap">
            <header className="lp-head" data-reveal>
              <h2 className="lp-h2">Every feature on every plan</h2>
              <p>Pay for the number of clients you coach. Monthly, cancel any time.</p>
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
        <section className="lp-sec" id="faq">
          <div className="lp-wrap lp-split">
            <header className="lp-head left" data-reveal>
              <span className="lp-chip">Questions</span>
              <h2 className="lp-h2">Good to know</h2>
              <div className="lp-faq-pic"><NextPoster /></div>
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
          <PyramidVideo className="lp-media" src={END_VIDEO} poster={END_POSTER} />
          <div className="lp-wrap lp-end-copy" data-reveal>
            <h2 className="lp-h2">Your next client deserves your best coaching</h2>
            <div className="lp-ctas">
              <Cta href="/coach/">Start free</Cta>
              <a className="lp-link" href="/client/?demo">See the client app</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-grid">
          <div className="lp-foot-brand">
            <a href="/" className="lp-logo" aria-label="APEX home"><ApexLogo height={22} /></a>
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
        </div>
      </footer>
    </div>
  );
}
