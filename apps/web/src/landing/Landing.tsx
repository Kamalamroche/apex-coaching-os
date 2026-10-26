import { Icons, Label, ThemeButton, type IconName, type LabelKind } from "@apex/ui";

/* Public marketing page at /. Sign-in and demos live at /start/, /coach/ and /client/.
   Copy is original. Only features that exist today are sold as features; the rest sit under "Coming next". */

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: "brief", title: "Morning Brief", body: "Open the app and see who needs you today, and why: missed sessions, stalled lifts, unread messages. Deal with it in one tap." },
  { icon: "progress", title: "Progressions from real data", body: "Every logged set carries load, reps and RPE. APEX suggests the next step for each lift, and you approve it before the client sees it." },
  { icon: "build", title: "Fast program builder", body: "Search a movement library by name or nickname, swap an exercise in one tap, and edits reach the client's phone live." },
  { icon: "play", title: "Guided workout player", body: "Clients open straight onto today's session with cues, a rest timer and last time's numbers on every set." },
  { icon: "chat", title: "Messages in context", body: "Chat sits next to the training log, so every reply is grounded in what the client actually did this week." },
  { icon: "money", title: "Nutrition and business", body: "Macro targets, check-in status and revenue live in the same place as training, not in five other apps." },
];

const STEPS = [
  { n: "01", title: "Set up in minutes", body: "Sign in with your email, name your coaching business and you are ready. No card needed." },
  { n: "02", title: "Invite with a link", body: "Create a private invite link for each client. They tap it, sign in and land in their own app." },
  { n: "03", title: "Coach from the Brief", body: "Build the program once. APEX tracks every session and tells you each morning where your time matters most." },
];

const LABELS: { kind: LabelKind; name: string; body: string }[] = [
  { kind: "data", name: "Data", body: "What was logged. Sets, reps, load, RPE." },
  { kind: "insight", name: "Insight", body: "A pattern worth knowing, like a lift that has stalled for three weeks." },
  { kind: "ai", name: "AI suggestion", body: "A proposed change, shown as a before and after." },
  { kind: "dec", name: "Coach decision", body: "Only what you accept reaches your client." },
];

const NEXT = [
  { title: "Check-ins", body: "Weekly measurements, progress photos and questions, reviewed side by side." },
  { title: "Post-workout summary", body: "Muscles worked, new personal bests and how today compares with last time, sent to you the moment a client finishes." },
  { title: "Plate calculator", body: "Tap a target weight and see exactly which plates go on each side of the bar." },
  { title: "Apple Watch", body: "Log sets and see rest timers from the wrist." },
];

/* Proposed pricing, not live yet: billing arrives with Stripe. */
const PLANS = [
  { name: "Starter", price: "£0", clients: "Up to 3 clients", note: "Try everything with your first clients." },
  { name: "Coach", price: "£35", clients: "Up to 30 clients", note: "For a full one-to-one diary.", featured: true },
  { name: "Studio", price: "£69", clients: "Up to 100 clients", note: "For busy online and hybrid coaches." },
  { name: "Team", price: "£119", clients: "Unlimited clients", note: "For gyms and coaching teams." },
];

const FAQ = [
  { q: "Do my clients need to download an app?", a: "No. The client app runs in the phone's browser and can be added to the home screen like any other app. They tap your invite link and they are in." },
  { q: "Are any features locked behind higher plans?", a: "No. Every plan includes every feature. Plans only differ in how many active clients you coach." },
  { q: "Does the AI change my clients' programs?", a: "Never on its own. AI suggestions are clearly labelled and wait for you. Nothing reaches a client until you accept it." },
  { q: "Can I try it before I sign up?", a: "Yes. Open the demo to explore the coach and client apps with sample data, no account needed." },
  { q: "Who is behind APEX?", a: "APEX is built by a working personal trainer at HELIX, for coaches who would rather spend their time coaching than on admin." },
];

const Check = () => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export function Landing() {
  return (
    <div className="lp">
      <header className="lp-top">
        <div className="lp-wrap lp-bar">
          <a href="/" className="wordmark" style={{ gap: 8, color: "inherit", textDecoration: "none" }} aria-label="APEX home">
            <Icons.logo width={26} height={26} />
            <b style={{ fontSize: 22 }}>APEX</b>
          </a>
          <nav className="lp-nav" aria-label="Sections">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="lp-bar-acts">
            <a className="lp-signin" href="/start/">Sign in</a>
            <a className="btn act sm" href="/coach/">Start free</a>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <span className="eyebrow" style={{ color: "var(--act)" }}>Coaching software for personal trainers</span>
              <h1 className="lp-h1">Coach more people. Keep it personal.</h1>
              <p className="lp-lead">APEX tells you who needs you each morning, progresses programs from what your clients actually lift, and gives every client an app that opens on today's workout.</p>
              <div className="lp-ctas">
                <a className="btn act" href="/coach/">Start free with 3 clients</a>
                <a className="btn ghost" href="/coach/?demo">Try the live demo</a>
              </div>
              <ul className="lp-ticks">
                <li><Check />Every feature on every plan</li>
                <li><Check />No app store needed</li>
                <li><Check />Units in kg by default</li>
              </ul>
            </div>
            <HeroVisual />
          </div>
        </section>

        <section className="lp-strip" aria-label="Who it's for">
          <div className="lp-wrap lp-strip-row">
            <span>One-to-one PTs</span><i />
            <span>Online coaches</span><i />
            <span>Hybrid coaching</span><i />
            <span>Small gyms and studios</span>
          </div>
        </section>

        <section className="lp-sec">
          <div className="lp-wrap">
            <div className="lp-head">
              <span className="eyebrow">Two apps, one system</span>
              <h2 className="lp-h2">Simple for the client. Powerful for the coach.</h2>
            </div>
            <div className="pick lp-pick">
              <a href="/coach/?demo">
                <span className="eyebrow" style={{ color: "var(--act)" }}>For coaches</span>
                <span className="h2" style={{ fontSize: 24 }}>Coach OS</span>
                <ul>
                  <li>Morning Brief: who needs you today, and why</li>
                  <li>Progressions suggested from logged RPE</li>
                  <li>Fast builder with synonym search and one-tap swaps</li>
                  <li>Nutrition, check-ins and revenue in one place</li>
                </ul>
                <span className="link" style={{ fontSize: 14, color: "var(--act)" }}>Open the coach demo →</span>
              </a>
              <a href="/client/?demo" className="cl">
                <span className="eyebrow" style={{ color: "var(--data)" }}>For clients</span>
                <span className="h2" style={{ fontSize: 24 }}>Client app</span>
                <ul className="cl">
                  <li>Opens on today's workout</li>
                  <li>Guided player with cues and rest timer</li>
                  <li>Last time's numbers on every set</li>
                  <li>Progress, messages and nutrition one tap away</li>
                </ul>
                <span className="link" style={{ fontSize: 14, color: "var(--data)" }}>Open the client demo →</span>
              </a>
            </div>
          </div>
        </section>

        <section className="lp-sec" id="features">
          <div className="lp-wrap">
            <div className="lp-head">
              <span className="eyebrow">Features</span>
              <h2 className="lp-h2">Less admin. More coaching.</h2>
              <p className="lp-lead">The jobs that eat your evenings, handled in one place.</p>
            </div>
            <div className="lp-grid">
              {FEATURES.map((f) => {
                const Icon = Icons[f.icon];
                return (
                  <article key={f.title} className="lp-card">
                    <span className="lp-ico"><Icon width={22} height={22} /></span>
                    <h3 className="h2">{f.title}</h3>
                    <p className="small">{f.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lp-sec lp-band">
          <div className="lp-wrap lp-split">
            <div>
              <span className="eyebrow" style={{ color: "var(--ai)" }}>AI you stay in charge of</span>
              <h2 className="lp-h2">You make the call. Every time.</h2>
              <p className="lp-lead">Everything APEX shows you says what it is. Suggestions wait for your approval, and your clients only ever see your decisions.</p>
            </div>
            <ul className="lp-labels">
              {LABELS.map((l) => (
                <li key={l.name}>
                  <Label kind={l.kind}>{l.name}</Label>
                  <span className="small">{l.body}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-sec" id="how">
          <div className="lp-wrap">
            <div className="lp-head">
              <span className="eyebrow">How it works</span>
              <h2 className="lp-h2">From sign-up to first session in an afternoon.</h2>
            </div>
            <ol className="lp-steps">
              {STEPS.map((s) => (
                <li key={s.n} className="lp-card">
                  <span className="lp-step-n num">{s.n}</span>
                  <h3 className="h2">{s.title}</h3>
                  <p className="small">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-sec">
          <div className="lp-wrap">
            <div className="lp-head">
              <span className="eyebrow" style={{ color: "var(--data)" }}>Coming next</span>
              <h2 className="lp-h2">On the roadmap now.</h2>
            </div>
            <div className="lp-grid lp-grid-4">
              {NEXT.map((n) => (
                <article key={n.title} className="lp-card lp-soon">
                  <span className="label l-data">Coming soon</span>
                  <h3 className="h3">{n.title}</h3>
                  <p className="small">{n.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec" id="pricing">
          <div className="lp-wrap">
            <div className="lp-head">
              <span className="eyebrow">Pricing</span>
              <h2 className="lp-h2">Every feature on every plan.</h2>
              <p className="lp-lead">Pay for the number of clients you coach, nothing else. Monthly, cancel any time.</p>
            </div>
            <div className="lp-grid lp-grid-4">
              {PLANS.map((p) => (
                <article key={p.name} className={`lp-card lp-plan ${p.featured ? "on" : ""}`}>
                  {p.featured && <span className="lp-pop">Most popular</span>}
                  <h3 className="h3">{p.name}</h3>
                  <div className="lp-price"><b className="num">{p.price}</b><span className="tiny">/month</span></div>
                  <span className="lp-clients">{p.clients}</span>
                  <p className="small">{p.note}</p>
                  <a className={`btn block ${p.featured ? "act" : "ghost"}`} href="/coach/">{p.price === "£0" ? "Start free" : `Choose ${p.name}`}</a>
                </article>
              ))}
            </div>
            <p className="tiny lp-note">Your own branding on the client app is available as an add-on.</p>
          </div>
        </section>

        <section className="lp-sec" id="faq">
          <div className="lp-wrap lp-faq-wrap">
            <div className="lp-head">
              <span className="eyebrow">FAQ</span>
              <h2 className="lp-h2">Good questions.</h2>
            </div>
            <div className="lp-faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p className="small">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-wrap lp-final-in">
            <h2 className="lp-h2">Your next client deserves your best coaching.</h2>
            <p className="lp-lead">Start free with your first three clients. Upgrade when your diary fills up.</p>
            <div className="lp-ctas" style={{ justifyContent: "center" }}>
              <a className="btn act" href="/coach/">Start free</a>
              <a className="btn ghost" href="/client/?demo">See the client app</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-row">
          <div className="wordmark" style={{ gap: 8 }}>
            <Icons.logo width={22} height={22} />
            <b style={{ fontSize: 18 }}>APEX</b>
            <span className="tiny" style={{ marginLeft: 6 }}>Coaching OS by HELIX</span>
          </div>
          <nav className="lp-foot-nav" aria-label="Footer">
            <a href="/start/">Sign in</a>
            <a href="/coach/?demo">Coach demo</a>
            <a href="/client/?demo">Client demo</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <ThemeButton />
        </div>
      </footer>
    </div>
  );
}

/** Product preview built from the real design system: a coach Brief panel and a client phone. Sample data only. */
function HeroVisual() {
  return (
    <div className="lp-visual" aria-hidden="true">
      <div className="lp-glow" />
      <div className="lp-desk card">
        <div className="sect"><span className="eyebrow">Morning Brief</span><span className="tiny num">Mon 07:30</span></div>
        <div className="lp-tri"><i style={{ background: "var(--crit)" }} /><div><b className="h3">Priya missed 2 sessions</b><span className="tiny">Last seen Thursday</span></div><span className="btn sec sm">Message</span></div>
        <div className="lp-tri"><i style={{ background: "var(--warn)" }} /><div><b className="h3">Tom's squat has stalled</b><span className="tiny">100 kg × 5 for 3 weeks</span></div><Label kind="insight">Insight</Label></div>
        <div className="lp-tri"><i style={{ background: "var(--ai)" }} /><div><b className="h3">Raise Ella's bench to 52.5 kg</b><span className="tiny">Last 3 sessions at RPE 7</span></div><Label kind="ai">AI suggestion</Label></div>
      </div>
      <div className="lp-phone">
        <div className="lp-notch" />
        <span className="eyebrow" style={{ color: "var(--act)" }}>Today</span>
        <b className="lp-phone-h">Lower A</b>
        <span className="tiny">5 exercises · about 55 min</span>
        <div className="lp-set"><span className="tiny">Back squat</span><b className="num">4 × 6 · 80 kg</b><span className="tiny" style={{ color: "var(--data)" }}>Last: 77.5 kg</span></div>
        <div className="lp-set"><span className="tiny">Romanian deadlift</span><b className="num">3 × 8 · 70 kg</b><span className="tiny" style={{ color: "var(--data)" }}>Last: 70 kg</span></div>
        <div className="lp-rest"><span className="tiny">Rest</span><b className="num">1:30</b></div>
        <span className="btn act block sm">Start workout</span>
      </div>
    </div>
  );
}
