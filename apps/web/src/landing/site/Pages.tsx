import { useState } from "react";
import { Icons } from "@apex/ui";
import {
  AUDIENCES, CLIENT_APP, FEATURE_GROUPS, GLOSSARY, GUIDES, FAQ, LABELS, PLANS, PRICING_FAQ, PRICING_ROWS, SHOTS, TEMPLATES, WEEK,
  yearlyPerMonth,
} from "./content";
import { Faq, Frame, PageHero, SecHead, SiteShell } from "./Site";

/* The inner marketing pages: Features, Who it's for, In action, Resources, Pricing and About.
   Each one is a thin layout over content.ts. */

const money = (n: number) => (Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`);

export function FeaturesPage() {
  return (
    <SiteShell path="/features/">
      <PageHero kick="Product" title="Everything a coach needs. Nothing they don't." lead="Training, nutrition, habits, community and the business side, in one place, on every plan.">
        <nav className="st-jump" aria-label="Feature areas">
          {FEATURE_GROUPS.map((g) => <a key={g.id} href={`#${g.id}`}>{g.name}</a>)}
          <a href="#client-app">Client app</a>
        </nav>
      </PageHero>

      {FEATURE_GROUPS.map((g, i) => (
        <section key={g.id} id={g.id} className={`lp-sec st-fgroup ${i % 2 ? "alt" : ""}`}>
          <div className="lp-wrap">
            <div className="st-fgroup-top">
              <div className="st-fgroup-copy rv">
                <span className="lp-kick">{g.kicker}</span>
                <h2 className="lp-h2">{g.title}</h2>
                <p className="lp-lead">{g.lead}</p>
              </div>
              <div className={`st-fgroup-shots rv ${g.extra ? "pair" : ""} ${g.shot.kind}`}>
                <Frame shot={g.shot} />
                {g.extra && <Frame shot={g.extra} className="st-extra" />}
              </div>
            </div>
            <ul className="st-fgrid">
              {g.items.map((it) => {
                const I = Icons[it.icon];
                return (
                  <li key={it.name} className="rv">
                    <span className="st-mi"><I width={18} height={18} /></span>
                    <b>{it.name}{it.soon && <em className="st-soon">Soon</em>}</b>
                    <p>{it.text}</p>
                  </li>
                );
              })}
            </ul>
            {g.id === "insight" && (
              <ol className="st-label-row compact">
                {LABELS.map((l) => (
                  <li key={l.name} className={`rv tone-${l.tone}`}><span className="st-label-tag">{l.name}</span><p>{l.text}</p></li>
                ))}
              </ol>
            )}
          </div>
        </section>
      ))}

      <section id="client-app" className="lp-sec st-band">
        <div className="lp-wrap st-band-grid">
          <div className="rv">
            <span className="lp-kick">Client app</span>
            <h2 className="lp-h2">{CLIENT_APP.title}</h2>
            <p className="lp-lead">{CLIENT_APP.lead}</p>
            <ul className="st-ticks">
              {CLIENT_APP.points.map((p) => <li key={p}><Icons.check width={16} height={16} /><span>{p}</span></li>)}
            </ul>
            <a className="lp-pill act lg" href="/client/?demo">Open the client demo</a>
          </div>
          <div className="st-fan rv">
            <Frame shot={SHOTS.train} />
            <Frame shot={SHOTS.today} />
            <Frame shot={SHOTS.progress} />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

export function SolutionsPage() {
  return (
    <SiteShell path="/solutions/">
      <PageHero kick="Who it's for" title="However you coach, APEX fits." lead="Online, in person or both. One coach or a whole studio. The same tools, set up the way you work.">
        <nav className="st-jump" aria-label="Audiences">
          {AUDIENCES.map((a) => <a key={a.id} href={`#${a.id}`}>{a.name}</a>)}
        </nav>
      </PageHero>
      {AUDIENCES.map((a, i) => (
        <section key={a.id} id={a.id} className={`lp-sec st-sol ${i % 2 ? "flip" : ""}`}>
          <div className="lp-wrap st-sol-grid">
            <figure className="st-sol-photo rv">
              <img src={a.photo} alt="" width={1080} height={1350} loading="lazy" />
              <figcaption>{a.name}</figcaption>
            </figure>
            <div className="st-sol-copy rv">
              <span className="lp-kick">{a.name}</span>
              <h2 className="lp-h2">{a.title}</h2>
              <p className="st-problem">{a.problem}</p>
              <ul className="st-ticks">
                {a.points.map((p) => <li key={p}><Icons.check width={16} height={16} /><span>{p}</span></li>)}
              </ul>
              <div className="st-sol-links">
                {a.links.map((id) => {
                  const g = FEATURE_GROUPS.find((x) => x.id === id);
                  return g ? <a key={id} className="st-chip-link" href={`/features/#${id}`}>{g.name}</a> : null;
                })}
              </div>
            </div>
          </div>
        </section>
      ))}
    </SiteShell>
  );
}

export function InActionPage() {
  return (
    <SiteShell path="/in-action/">
      <PageHero kick="In action" title="A coaching week with APEX." lead="Follow one coach and one client from Monday's brief to Sunday's check-in. Every screen here is the real app.">
        <div className="lp-ctas">
          <a className="lp-pill act lg" href="/coach/?demo">Open the coach demo</a>
          <a className="lp-pill ghost lg" href="/client/?demo">Open the client demo</a>
        </div>
      </PageHero>
      <section className="lp-sec st-week">
        <div className="lp-wrap">
          <ol className="st-steps">
            {WEEK.map((w, i) => (
              <li key={w.title} className={`st-step ${i % 2 ? "flip" : ""}`}>
                <div className="st-step-copy rv">
                  <span className="st-step-n num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="lp-kick">{w.day}</span>
                  <h2 className="st-h3">{w.title}</h2>
                  <p className="lp-lead">{w.text}</p>
                </div>
                <div className={`st-step-shot rv ${w.shot.kind}`}><Frame shot={w.shot} /></div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="lp-sec st-band">
        <div className="lp-wrap st-demo-cta">
          <SecHead center kick="Try it yourself" title="No account. No card. Sample data." lead="Open both demos side by side: what you change as the coach shows up in the client app straight away." />
          <div className="st-demo-cards">
            <a href="/coach/?demo" className="st-demo-card rv"><Icons.brief width={22} height={22} /><b>Coach demo</b><small>Brief, builder, nutrition and business</small></a>
            <a href="/client/?demo" className="st-demo-card rv"><Icons.today width={22} height={22} /><b>Client demo</b><small>Today, training, progress and habits</small></a>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

export function ResourcesPage() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <SiteShell path="/resources/">
      <PageHero kick="Resources" title="Learn, plan and get answers." lead="Practical guides from the coaching floor, free program templates and a help centre for APEX.">
        <nav className="st-jump" aria-label="Resources">
          <a href="#guides">Coach guides</a><a href="#templates">Templates</a><a href="#help">Help centre</a><a href="#glossary">Glossary</a>
        </nav>
      </PageHero>

      <section id="guides" className="lp-sec">
        <div className="lp-wrap">
          <SecHead kick="Coach guides" title="Short reads, real coaching." />
          <div className="st-guides">
            {GUIDES.map((g) => {
              const on = open === g.id;
              return (
                <article key={g.id} id={`guide-${g.id}`} className={`st-guide rv ${on ? "on" : ""}`}>
                  <span className="st-guide-meta"><span>{g.tag}</span><span>{g.minutes} min read</span></span>
                  <h3>{g.title}</h3>
                  <p>{g.intro}</p>
                  {on && <ol>{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>}
                  <button type="button" className="st-arrow" aria-expanded={on} onClick={() => setOpen(on ? null : g.id)}>{on ? "Show less" : "Read the guide"}</button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="templates" className="lp-sec st-band">
        <div className="lp-wrap">
          <SecHead kick="Program templates" title="Four blocks to start from." lead="Included with every account. Copy one, change what your client needs, and send it." />
          <ul className="st-temps">
            {TEMPLATES.map((t) => (
              <li key={t.name} className="rv">
                <b className="num st-temp-w">{t.weeks}<small>weeks</small></b>
                <span><b>{t.name}</b><small>{t.text}</small></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="help" className="lp-sec">
        <div className="lp-wrap lp-narrow">
          <span className="lp-kick">Help centre</span>
          <h2 className="lp-h2">Common questions.</h2>
          <Faq items={[...FAQ, ...PRICING_FAQ]} />
        </div>
      </section>

      <section id="glossary" className="lp-sec">
        <div className="lp-wrap">
          <SecHead kick="Glossary" title="The words in the app." />
          <dl className="st-gloss">
            {GLOSSARY.map((g) => (
              <div key={g.term} className="rv"><dt>{g.term}</dt><dd>{g.text}</dd></div>
            ))}
          </dl>
        </div>
      </section>
    </SiteShell>
  );
}

export function PricingPage() {
  const [yearly, setYearly] = useState(false);
  return (
    <SiteShell path="/pricing/">
      <PageHero kick="Pricing" title="Every feature on every plan." lead="Pay only for the number of clients you coach. Start free, move up when you grow.">
        <div className="st-toggle" role="radiogroup" aria-label="Billing period">
          <button type="button" role="radio" aria-checked={!yearly} className={!yearly ? "on" : ""} onClick={() => setYearly(false)}>Monthly</button>
          <button type="button" role="radio" aria-checked={yearly} className={yearly ? "on" : ""} onClick={() => setYearly(true)}>Yearly <em>2 months free</em></button>
        </div>
      </PageHero>
      <section className="lp-sec st-price-sec">
        <div className="lp-wrap">
          <ul className="st-plans">
            {PLANS.map((p) => (
              <li key={p.name} className={`rv ${p.featured ? "on" : ""}`}>
                {p.featured && <span className="st-plan-flag">Most popular</span>}
                <h2>{p.name}</h2>
                <p className="st-plan-for">{p.for}</p>
                <b className="st-plan-price num">{money(yearly ? yearlyPerMonth(p.monthly) : p.monthly)}<small>/mo</small></b>
                <span className="st-plan-bill">{p.monthly === 0 ? "Free for ever" : yearly ? `${money(p.monthly * 10)} billed yearly` : "Billed monthly"}</span>
                <span className="st-plan-clients">{p.clients}</span>
                <a className={`lp-pill ${p.featured ? "act" : "ghost"} lg`} href="/coach/">{p.monthly === 0 ? "Start free" : `Choose ${p.name}`}</a>
              </li>
            ))}
          </ul>
          <p className="st-note">Proposed launch prices in GBP. Billing opens soon; until then every coach starts free.</p>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-wrap">
          <SecHead kick="Compare" title="What every plan includes." />
          <div className="st-table-wrap rv">
            <table className="st-table">
              <thead>
                <tr><th scope="col">Feature</th>{PLANS.map((p) => <th key={p.name} scope="col">{p.name}</th>)}</tr>
              </thead>
              <tbody>
                <tr><th scope="row">Active clients</th>{PLANS.map((p) => <td key={p.name}>{p.clients.replace("Up to ", "").replace(" clients", "")}</td>)}</tr>
                {PRICING_ROWS.map((r) => (
                  <tr key={r}><th scope="row">{r}</th>{PLANS.map((p) => <td key={p.name}><Icons.check width={16} height={16} aria-label="Included" /></td>)}</tr>
                ))}
                <tr><th scope="row">Your branding on the client app</th>{PLANS.map((p) => <td key={p.name} className="dim">Add-on</td>)}</tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="lp-sec st-band">
        <div className="lp-wrap st-founding rv">
          <span className="lp-kick">Founding coaches</span>
          <h2 className="lp-h2">Join early, keep the price.</h2>
          <p className="lp-lead">Coaches who join before launch start free with every feature, and keep a founding rate when billing opens.</p>
          <a className="lp-pill act lg" href="/coach/">Claim your spot</a>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-wrap lp-narrow">
          <span className="lp-kick">Pricing questions</span>
          <Faq items={PRICING_FAQ} />
        </div>
      </section>
    </SiteShell>
  );
}

const PRINCIPLES = [
  { title: "The coach decides", text: "APEX notices and suggests. Only you change what a client sees." },
  { title: "Clients first", text: "If a screen does not help someone train, eat or recover better, it does not ship." },
  { title: "Original, always", text: "Our own photos, our own movement demos, our own words." },
  { title: "Your data is yours", text: "Export everything whenever you like. Stored in the UK and Europe, never sold." },
];

export function AboutPage() {
  return (
    <SiteShell path="/about/">
      <PageHero kick="About APEX" title="Built on the gym floor." lead="APEX started as one personal trainer's answer to a simple problem: too much admin, not enough coaching." />
      <section className="lp-sec">
        <div className="lp-wrap st-story">
          <figure className="st-sol-photo rv">
            <img src="/hero/coach.webp" alt="A HELIX coach going through a plan with a client" width={1080} height={1350} loading="lazy" />
          </figure>
          <div className="st-story-copy rv">
            <span className="lp-kick">The story</span>
            <h2 className="lp-h2">From HELIX, for every coach.</h2>
            <p>APEX is built by a working personal trainer at HELIX. Between sessions, the job was spreadsheets, screenshots and chasing messages across four apps. Clients who needed help most were the easiest to miss.</p>
            <p>So we built the tool we wanted: a morning brief that says who needs you, programs that move forward from real numbers, and a client app people actually open.</p>
            <p>APEX is independent and UK-based, and we build what coaches ask for.</p>
          </div>
        </div>
      </section>
      <section id="principles" className="lp-sec st-band">
        <div className="lp-wrap">
          <SecHead kick="Principles" title="What we will not compromise on." />
          <ul className="st-fgrid four">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title} className="rv">
                <span className="st-step-n num">{String(i + 1).padStart(2, "0")}</span>
                <b>{p.title}</b>
                <p>{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </SiteShell>
  );
}
