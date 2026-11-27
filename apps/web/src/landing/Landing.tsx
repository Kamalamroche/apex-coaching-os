import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ApexLogo, Icons } from "@apex/ui";
import { CLIENT_POINTS, CLIENT_SCREENS, FAQ, END_POSTER, END_VIDEO, HERO_POSTER, HERO_STILL, HERO_STILL_SMALL, HERO_VIDEO, HERO_VIDEO_SMALL, LABELS, PLANS, STEPS, TOUR, CHAPTERS, REEL, WHY } from "./content";
import { BriefPoster, GrowPoster, NextPoster, ShapePoster, TrainPoster } from "./Posters";

/** Reel banner: a colour card with the pitch, and a brown panel with one huge white word, (WORD)( )ING, whose window
    shows bright athlete pictures. Every 3.2 s the next picture slides in and the word (COACHING, LIFTING, STRETCHING,
    BOXING, SPRINTING), the card colour and the labels change with it. Cycles only while on screen.
    Reduced motion: the pictures still change, without sliding or rippling. */
/** Seconds into the morph film when each athlete has half turned into the next (measured from the backdrop colour).
    Entry k is the moment REEL[k + 1] takes over; the film then loops back to REEL[0]. */
const REEL_MORPHS = [1.75, 10.26, 14.94, 21.7, 27.62];
const reelAt = (t: number) => { let k = 0; for (const at of REEL_MORPHS) if (t >= at) k++; return k % REEL.length; };

function Reel() {
  const [on, setOn] = useState(0);
  const [still] = useState(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== "function") { setSeen(true); return; }
    const io = new IntersectionObserver((es) => setSeen(es.some((e) => e.isIntersecting)), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const vid = useRef<HTMLVideoElement>(null);
  const [film, setFilm] = useState(false);
  /* reduced motion: the stills change slowly on a timer. Otherwise one looping film of the athletes morphing into each other
     plays in the window, and the word, colour and labels follow the film's clock so they change mid-morph. */
  useEffect(() => {
    if (!seen || !still) return;
    const t = window.setInterval(() => { setMoved(true); setOn((x) => (x + 1) % REEL.length); }, 6000);
    return () => window.clearInterval(t);
  }, [still, seen]);
  useEffect(() => {
    const v = vid.current;
    if (!v || still) return;
    if (!seen) { v.pause(); return; }
    void v.play().catch(() => {});
    let raf = 0;
    const tick = () => {
      const k = reelAt(v.currentTime);
      setOn((x) => { if (x !== k) setMoved(true); return k; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [still, seen]);
  const n = REEL.length;
  const m = REEL[on] ?? REEL[0]!;
  const prev = (on + n - 1) % n;
  const letters = (text: string, from: number) => [...text].map((ch, j) => <i key={j} style={{ "--j": from + j } as CSSProperties}>{ch}</i>);
  const lines = ["You write", "the plan.", "They train", "with you."];
  return (
    <section className={`lp-reel ${seen && !still ? "live" : ""}`} ref={ref} style={{ "--tone": m.tone } as CSSProperties} aria-labelledby="lp-reel-h">
      <div className="lp-wrap lp-reel-grid">
        <div className="lp-reel-card" data-reveal>
          <h2 className="lp-reel-h" id="lp-reel-h">
            {lines.map((l, k) => <span key={l} style={{ "--k": k } as CSSProperties}><span>{l}</span></span>)}
          </h2>
          <p className="lp-reel-p">Programmes, check-ins, progress and payments in one place. Your clients get an app that opens on today's session. You stay in charge of the training.</p>
          <a className="lp-reel-go" href="/coach/">
            <span className="lp-reel-go-dot" aria-hidden="true"><Icons.forward width={18} height={18} /></span>
            <span>Start free</span>
          </a>
        </div>
        <div className="lp-reel-panel" data-reveal>
          <span className="lp-reel-tag tl" aria-hidden="true"><b>{String(on + 1).padStart(2, "0")}</b> / {String(n).padStart(2, "0")}<br />{m.label}</span>
          <span className="lp-reel-tag tr" aria-hidden="true">Every way<br />you coach</span>
          <div className="lp-reel-ghost" aria-hidden="true">
            {REEL.map((w, k) => <span key={w.id} className={k === on ? "on" : k === prev ? "out" : ""} style={{ "--g": w.word.length + 3 } as CSSProperties}>{w.word}ING</span>)}
          </div>
          <p className="lp-reel-word" aria-live="polite" aria-label={`${m.word.toLowerCase()}ing`}>
            <span className="lp-reel-left" aria-hidden="true">
              {moved && <span className="lp-reel-seg gone" key={`out${prev}-${on}`}>{letters((REEL[prev] ?? m).word, 0)}</span>}
              <span className="lp-reel-seg in" key={`in${on}`}>{letters(m.word, 0)}</span>
            </span>
            <span className="lp-reel-stack" aria-hidden="true">
              <span className="lp-reel-arch" key={`a${on}`} />
              <span className="lp-reel-arch line" key={`l${on}`} />
              <span className="lp-reel-win">
                {!still && <video ref={vid} className={film ? "film on" : "film"} src="/site/reel-morph.mp4" poster={REEL[0]?.photo} muted loop playsInline preload="metadata" onPlaying={() => setFilm(true)} />}
                {REEL.map((w, k) => (
                  <img key={w.id} className={k === on ? "on" : k === prev && moved ? "out" : ""} src={w.photo} width={900} height={1200} alt="" loading={k < 2 ? "eager" : "lazy"} />
                ))}
              </span>
            </span>
            <span className="lp-reel-ing" aria-hidden="true">{letters("ING", 0)}</span>
          </p>
          <span className="lp-reel-tag bl" aria-hidden="true">Built by a working coach</span>
          <span className="lp-reel-tag br" aria-hidden="true">Free for 3 clients</span>
        </div>
      </div>
    </section>
  );
}

/** "Why APEX": three colour panels side by side (stacked on phones). One is open; the others fold to slim strips.
    They take turns every 4.5 s, like a slow breath while in view, and a click or tap opens one. The open panel's film plays; the rest rest on stills. */
function WhyDeck() {
  const [on, setOn] = useState(0);
  const [seen, setSeen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [still] = useState(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const ref = useRef<HTMLDivElement>(null);
  const films = useRef<(HTMLVideoElement | null)[]>([]);
  /* the panel that just closed plays its words out to the left; set before paint so its words never blink */
  const last = useRef(0);
  const [off, setOff] = useState(-1);
  useLayoutEffect(() => { if (last.current !== on) { setOff(last.current); last.current = on; } }, [on]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== "function") { setSeen(true); return; }
    const io = new IntersectionObserver((es) => setSeen(es.some((e) => e.isIntersecting)), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!seen || paused || still) return;
    const t = window.setInterval(() => setOn((x) => (x + 1) % WHY.length), 4500);
    return () => window.clearInterval(t);
  }, [seen, paused, still, on]);
  useEffect(() => {
    films.current.forEach((v, k) => { if (!v) return; if (k === on && seen) void v.play().catch(() => {}); else v.pause(); });
  }, [on, seen]);
  return (
    <div className={`lp-why ${seen ? "live" : ""}`} ref={ref} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {WHY.map((w, k) => (
        <article key={w.id} className={`lp-why-p ${w.id} ${k === on ? "on" : k === off ? "off" : ""}`} aria-label={`${w.title.join(" ")}`}>
          <div className="lp-why-media" aria-hidden="true">
            <img src={w.still} width={1200} height={1200} alt="" loading="lazy" />
            {!still && <video ref={(v) => { films.current[k] = v; }} src={w.film} muted loop playsInline preload={seen ? "auto" : "none"} />}
          </div>
          <button type="button" className="lp-why-open" onClick={() => setOn(k)} aria-expanded={k === on} aria-label={`Open ${w.side}`}>
            <span className="lp-why-dot"><Icons.play width={13} height={13} /></span>
          </button>
          <div className="lp-why-top"><b>{String(k + 1).padStart(2, "0")}</b><small>Why APEX</small></div>
          <span className="lp-why-side" aria-hidden="true">{w.side}</span>
          <div className="lp-why-body">
            <h3 className="lp-why-h">{w.title.map((l, j) => <span key={l} style={{ "--k": j } as CSSProperties}><span>{l}</span></span>)}</h3>
            <p>{w.body}</p>
            <dl className="lp-why-facts">{w.facts.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
          </div>
        </article>
      ))}
    </div>
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
            {/* The three Why APEX panels sit where the DAY 01 poster was, beside the statement. */}
            <WhyDeck />
          </div>
        </section>

        {/* ---------- reel banner ---------- */}
        <Reel />

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
