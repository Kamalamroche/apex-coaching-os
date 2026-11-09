import { useState, type ReactElement } from "react";
import { CountUp, Icons } from "@apex/ui";
import { BriefPoster, DayPoster, GrowPoster, NextPoster, ShapePoster, TrainPoster } from "./Posters";
import { AUDIENCES, CLIENT_APP, FACTS, FAQ, FEATURE_GROUPS, INTEGRATIONS, LABELS, PLANS, SHOTS } from "./site/content";
import { Faq, Frame, SecHead, SiteShell } from "./site/Site";

/* Public home page at /. Sign-in and demos live at /start/, /coach/ and /client/.
   Structure: hero, real product numbers, tabbed product tour, coach + client apps, a coaching day in posters,
   AI labels, audiences, integrations, pricing teaser, founder story, FAQ, final call.
   Copy is original. Only features that exist today are sold. */

type Poster = { id: string; Art: () => ReactElement; kicker: string; title: string; body: string };

const POSTERS: Poster[] = [
  {
    id: "brief", Art: BriefPoster,
    kicker: "Every morning", title: "Know who needs you.",
    body: "Missed sessions, stalled lifts and unread messages, ranked by urgency. Suggestions wait for your OK, and clients only see your decisions.",
  },
  {
    id: "train", Art: TrainPoster,
    kicker: "In their pocket", title: "Today's session, one tap away.",
    body: "Clients open straight onto today's workout with cues, a rest timer, a plate calculator and last time's numbers on every set.",
  },
  {
    id: "grow", Art: GrowPoster,
    kicker: "From real data", title: "Progress they can see.",
    body: "Every logged set carries load, reps and RPE. APEX suggests the next step, tracks personal bests and sends you the summary.",
  },
];

function Tour() {
  const [tab, setTab] = useState("training");
  const g = FEATURE_GROUPS.find((x) => x.id === tab);
  if (!g) return null;
  return (
    <section className="lp-sec st-tour" id="tour">
      <div className="lp-wrap">
        <SecHead center kick="Everything in one place" title="One app instead of five." lead="Programs, nutrition, habits, messages and bookings share one record of each client, so you never copy anything twice." />
        <div className="st-tabs rv" role="tablist" aria-label="Product areas">
          {FEATURE_GROUPS.map((x) => (
            <button key={x.id} role="tab" type="button" aria-selected={x.id === tab} className={x.id === tab ? "on" : ""} onClick={() => setTab(x.id)}>{x.name}</button>
          ))}
        </div>
        <div className="st-tour-panel" role="tabpanel" key={g.id}>
          <div className="st-tour-copy">
            <span className="lp-kick">{g.kicker}</span>
            <h3 className="st-h3">{g.title}</h3>
            <p className="lp-lead">{g.lead}</p>
            <ul className="st-ticks">
              {g.items.slice(0, 4).map((i) => <li key={i.name}><Icons.check width={16} height={16} /><span><b>{i.name}.</b> {i.text}</span></li>)}
            </ul>
            <a className="st-arrow" href={`/features/#${g.id}`}>Explore {g.name.toLowerCase()}</a>
          </div>
          <div className={`st-tour-shot ${g.shot.kind}`}>
            <Frame shot={g.shot} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <SiteShell path="/" cta={false}>
      <section className="lp-hero st-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="st-hero-art">
            <DayPoster />
            <Frame shot={SHOTS.today} className="st-hero-phone" eager />
          </div>
          <div className="lp-hero-copy">
            <span className="lp-kick">Coaching software for personal trainers</span>
            <h1 className="lp-h1">
              <span>Coach more people.</span>
              <span className="act">Keep it personal.</span>
            </h1>
            <p className="lp-lead">Know who needs you each morning, build programs that progress from real data, and give every client an app that opens on today's workout.</p>
            <div className="lp-ctas">
              <a className="lp-pill act lg" href="/coach/">Start free</a>
              <a className="lp-link" href="/in-action/">See it in action →</a>
            </div>
            <ul className="st-hero-notes">
              <li><Icons.check width={15} height={15} />Free for your first 3 clients</li>
              <li><Icons.check width={15} height={15} />Every feature on every plan</li>
              <li><Icons.check width={15} height={15} />No card needed</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="st-facts" aria-label="APEX in numbers">
        <div className="lp-wrap st-facts-row">
          {FACTS.map((f) => (
            <div key={f.label} className="st-fact rv">
              <b className="num"><CountUp value={f.value} duration={1200} /></b>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </section>

      <Tour />

      <section className="lp-sec st-two">
        <div className="lp-wrap">
          <SecHead center kick="Two apps, one relationship" title="Powerful for you. Simple for them." lead="A coach app for planning and running the business, and a client app built around today." />
          <div className="st-two-grid">
            <div className="st-two-card rv">
              <span className="st-chip">For coaches</span>
              <h3 className="st-h3">Your morning in five minutes.</h3>
              <p>The Brief ranks who needs you, the builder carries last week forward, and the business screen shows what you earn.</p>
              <Frame shot={SHOTS.brief} />
            </div>
            <div className="st-two-card dark rv">
              <span className="st-chip">For clients</span>
              <h3 className="st-h3">{CLIENT_APP.title}</h3>
              <p>{CLIENT_APP.lead}</p>
              <div className="st-two-phones">
                <Frame shot={SHOTS.today} />
                <Frame shot={SHOTS.rings} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div id="how">
        {POSTERS.map((p, i) => (
          <section key={p.id} className={`lp-poster ${i % 2 ? "flip" : ""}`}>
            <div className="lp-wrap lp-poster-grid">
              <div className="rv"><p.Art /></div>
              <div className="lp-copy rv">
                <span className="lp-kick">{p.kicker}</span>
                <h2 className="lp-h2">{p.title}</h2>
                <p className="lp-lead">{p.body}</p>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="lp-sec st-labels">
        <div className="lp-wrap">
          <SecHead kick="Coach decides" title="AI that waits for your OK." lead="Every number and suggestion in APEX wears one of four labels. Nothing reaches a client until you accept it." />
          <ol className="st-label-row">
            {LABELS.map((l, i) => (
              <li key={l.name} className={`rv tone-${l.tone}`} style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="st-label-tag">{l.name}</span>
                <p>{l.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-sec st-aud">
        <div className="lp-wrap">
          <SecHead kick="Who it's for" title="Built for the way you coach." />
          <div className="st-aud-row">
            {AUDIENCES.map((a) => (
              <a key={a.id} href={`/solutions/#${a.id}`} className="st-aud-card rv">
                <img src={a.photo} alt="" width={1080} height={1350} loading="lazy" />
                <span className="st-aud-text"><b>{a.name}</b><small>{a.title}</small></span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec st-int">
        <div className="lp-wrap st-int-grid">
          <SecHead kick="Works with" title="Bring the data you already have." lead="Connect a watch or upload a file. Recovery, runs and steps land next to the training." />
          <ul className="st-int-list rv">
            {INTEGRATIONS.map((i) => (
              <li key={i.name}><b>{i.name}</b><small>{i.text}</small>{i.soon && <em>Soon</em>}</li>
            ))}
          </ul>
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
                <b className="lp-plan-price num">£{p.monthly}<small>/mo</small></b>
              </li>
            ))}
          </ul>
          <div className="lp-ctas">
            <a className="lp-pill act lg" href="/coach/">Start free</a>
            <a className="lp-link" href="/pricing/">Compare plans →</a>
          </div>
        </div>
      </section>

      <section className="lp-poster flip">
        <div className="lp-wrap lp-poster-grid">
          <div className="rv"><ShapePoster /></div>
          <div className="lp-copy rv">
            <span className="lp-kick">Built at HELIX</span>
            <h2 className="lp-h2">Made by a coach, for coaches.</h2>
            <p className="lp-lead">Every screen answers a question you ask every day: who needs me, what changes next, and is my client actually progressing?</p>
            <a className="st-arrow" href="/about/">Read the story</a>
          </div>
        </div>
      </section>

      <section className="lp-sec" id="faq">
        <div className="lp-wrap lp-narrow">
          <span className="lp-kick">Questions</span>
          <Faq items={FAQ} />
          <a className="st-arrow" href="/resources/#help">More answers in the help centre</a>
        </div>
      </section>

      <section className="lp-final">
        <div className="lp-wrap lp-final-grid">
          <div className="rv"><NextPoster /></div>
          <div className="lp-copy rv">
            <h2 className="lp-h2 big">Your next client deserves your best coaching.</h2>
            <div className="lp-ctas">
              <a className="lp-pill act lg" href="/coach/">Start free</a>
              <a className="lp-link" href="/client/?demo">See the client app →</a>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
