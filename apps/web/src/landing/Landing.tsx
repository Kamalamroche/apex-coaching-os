import { useState } from "react";
import { Icons, ThemeButton } from "@apex/ui";

/* Public marketing page at /. Sign-in and demos live at /start/, /coach/ and /client/.
   Poster layout: each section is one big word, one cut-out HELIX athlete standing on the page, and a few lines of copy.
   Copy is original. Only features that exist today are sold. */

type Poster = { word: string; style: "outline" | "vertical" | "solid"; img: string; alt: string; kicker: string; title: string; body: string };

const POSTERS: Poster[] = [
  {
    word: "Brief", style: "outline", img: "coach", alt: "A HELIX coach talking a client through her plan on a tablet",
    kicker: "Every morning", title: "Know who needs you.",
    body: "Missed sessions, stalled lifts and unread messages, ranked by urgency. Suggestions wait for your OK, and clients only see your decisions.",
  },
  {
    word: "Train", style: "vertical", img: "run", alt: "A HELIX athlete sprinting",
    kicker: "In their pocket", title: "Today's session, one tap away.",
    body: "Clients open straight onto today's workout with cues, a rest timer, a plate calculator and last time's numbers on every set.",
  },
  {
    word: "Grow", style: "solid", img: "upper", alt: "A HELIX athlete pressing dumbbells overhead",
    kicker: "From real data", title: "Progress they can see.",
    body: "Every logged set carries load, reps and RPE. APEX suggests the next step, tracks personal bests and sends you the summary.",
  },
];

/* Proposed pricing, not live yet: billing arrives with Stripe. */
const PLANS = [
  { name: "Starter", price: "£0", clients: "Up to 3 clients" },
  { name: "Coach", price: "£35", clients: "Up to 30 clients", featured: true },
  { name: "Studio", price: "£69", clients: "Up to 100 clients" },
  { name: "Team", price: "£119", clients: "Unlimited clients" },
];

const FAQ = [
  { q: "Do my clients need to download an app?", a: "No. The client app runs in the phone's browser and can be added to the home screen like any other app. They tap your invite link and they are in." },
  { q: "Are any features locked behind higher plans?", a: "No. Every plan includes every feature. Plans only differ in how many active clients you coach. Your own branding on the client app is available as an add-on." },
  { q: "Does the AI change my clients' programs?", a: "Never on its own. AI suggestions are clearly labelled and wait for you. Nothing reaches a client until you accept it." },
  { q: "How do I get started?", a: "Sign in with your email, name your coaching business, then send each client a private invite link. Most coaches run their first session the same afternoon." },
  { q: "Can I try it before I sign up?", a: "Yes. Open the demo to explore the coach and client apps with sample data, no account needed." },
  { q: "Who is behind APEX?", a: "APEX is built by a working personal trainer at HELIX, for coaches who would rather spend their time coaching than on admin." },
];

export function Landing() {
  const [offer, setOffer] = useState(true);
  return (
    <div className="lp">
      {offer && (
        <div className="lp-offer" role="region" aria-label="Offer">
          <p><b>Founding coaches</b> start free, every feature included. <a href="/coach/">Claim your spot</a></p>
          <button className="lp-offer-x" onClick={() => setOffer(false)} aria-label="Close offer">×</button>
        </div>
      )}
      <header className="lp-top">
        <div className="lp-wrap lp-bar">
          <a href="/" className="lp-logo" aria-label="APEX home">
            <Icons.logo width={24} height={24} />
            <b>APEX</b>
          </a>
          <nav className="lp-nav" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="lp-bar-acts">
            <a className="lp-pill ghost" href="/start/">Sign in</a>
            <a className="lp-pill act" href="/coach/">Start free</a>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-stage" aria-hidden="false">
              <span className="lp-giant" aria-hidden="true">APEX</span>
              <img className="lp-cut" src="/hero/hinge-cut.webp" width={1080} height={1350} alt="A HELIX athlete setting up a barbell deadlift" />
              <span className="lp-side" aria-hidden="true">Coaching OS · by HELIX</span>
            </div>
            <div className="lp-hero-copy">
              <h1 className="lp-h1">
                <span>Coach more people.</span>
                <span className="act">Keep it personal.</span>
              </h1>
              <p className="lp-lead">Software for personal trainers. Know who needs you each morning, and give every client an app that opens on today's workout.</p>
              <div className="lp-ctas">
                <a className="lp-pill act lg" href="/coach/">Start free</a>
                <a className="lp-link" href="/coach/?demo">Try the demo →</a>
              </div>
            </div>
          </div>
        </section>

        <div id="how">
          {POSTERS.map((p, i) => (
            <section key={p.word} className={`lp-poster ${p.style} ${i % 2 ? "flip" : ""}`}>
              <div className="lp-wrap lp-poster-grid">
                <div className="lp-stage">
                  <span className="lp-giant" aria-hidden="true">{p.word}</span>
                  <img className="lp-cut" src={`/hero/${p.img}-cut.webp`} width={1080} height={1350} loading="lazy" alt={p.alt} />
                </div>
                <div className="lp-copy">
                  <span className="lp-kick">{p.kicker}</span>
                  <h2 className="lp-h2">{p.title}</h2>
                  <p className="lp-lead">{p.body}</p>
                </div>
              </div>
            </section>
          ))}
        </div>

        <section className="lp-poster lp-tilt-sec">
          <div className="lp-wrap lp-poster-grid">
            <div className="lp-stage lp-tilt">
              <i className="lp-shape" aria-hidden="true" />
              <img className="lp-cut" src="/hero/wall-ball-cut.webp" width={1080} height={1350} loading="lazy" alt="A HELIX athlete throwing a medicine ball" />
            </div>
            <div className="lp-copy">
              <span className="lp-kick">Built at HELIX</span>
              <h2 className="lp-h2">Made by a coach, for coaches.</h2>
              <p className="lp-lead">Every screen answers a question you ask every day: who needs me, what changes next, and is my client actually progressing?</p>
            </div>
          </div>
        </section>

        <section className="lp-sec" id="pricing">
          <div className="lp-wrap lp-narrow">
            <span className="lp-kick">Pricing</span>
            <h2 className="lp-h2">Every feature on every plan.</h2>
            <p className="lp-lead">Pay for the number of clients you coach. Monthly, cancel any time.</p>
            <ul className="lp-plans">
              {PLANS.map((p) => (
                <li key={p.name} className={p.featured ? "on" : ""}>
                  <span className="lp-plan-name">{p.name}{p.featured && <em>Most popular</em>}</span>
                  <span className="lp-plan-clients">{p.clients}</span>
                  <b className="lp-plan-price num">{p.price}<small>/mo</small></b>
                </li>
              ))}
            </ul>
            <a className="lp-pill act lg" href="/coach/">Start free</a>
          </div>
        </section>

        <section className="lp-sec" id="faq">
          <div className="lp-wrap lp-narrow">
            <span className="lp-kick">Questions</span>
            <div className="lp-faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-wrap lp-final-grid">
            <div className="lp-stage lp-final-stage">
              <span className="lp-vert" aria-hidden="true">APEX</span>
              <img className="lp-cut" src="/hero/rings-cut.webp" width={1080} height={1350} loading="lazy" alt="A HELIX athlete holding an L-sit on gymnastic rings" />
            </div>
            <div className="lp-copy">
              <h2 className="lp-h2 big">Your next client deserves your best coaching.</h2>
              <div className="lp-ctas">
                <a className="lp-pill act lg" href="/coach/">Start free</a>
                <a className="lp-link" href="/client/?demo">See the client app →</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-row">
          <a href="/" className="lp-logo sm" aria-label="APEX home">
            <Icons.logo width={20} height={20} />
            <b>APEX</b>
          </a>
          <nav className="lp-foot-nav" aria-label="Footer">
            <a href="/start/">Sign in</a>
            <a href="/coach/?demo">Coach demo</a>
            <a href="/client/?demo">Client demo</a>
            <a href="/legal/#privacy">Privacy</a>
            <a href="/legal/#terms">Terms</a>
          </nav>
          <ThemeButton />
        </div>
      </footer>
    </div>
  );
}
