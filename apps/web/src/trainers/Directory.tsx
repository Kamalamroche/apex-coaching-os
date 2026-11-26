import {
  BUDGET_CHOICES, EMPTY_ANSWERS, EMPTY_FILTER, GOAL_CHOICES, MODE_LABEL, PRIORITY_LABEL, SORT_LABEL, directoryLink, filterCount, filterTrainers, matchLink, matchSteps, matchTrainers,
  type DirectoryFilter, type DirectorySort, type GoalChoice, type MatchAnswers, type MatchPriority, type TrainerCard, type TrainingModeName,
} from "@apex/core";
import { ApexLogo, EditorialTitle, Icons, MatchStepView, Sheet, ThemeButton, TrainerCardView } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { demoDirectory, liveDirectory, MARKETPLACE_NEEDS_UPDATE } from "../data/marketplace";
import { isDemo, supabase } from "../data/supabase";

const HOW: [TrainingModeName, string, string][] = [
  ["online", "Online", "A plan in the app, check-ins and chat"],
  ["in_person", "In person", "Sessions together at a gym or outdoors"],
  ["hybrid", "Both", "Some sessions together, the rest in the app"],
];
const PRIORITY_HINT: Record<MatchPriority, string> = {
  reviews: "Trainers their clients rate highly",
  verified: "Qualification and insurance checked by APEX",
  price: "The most within your budget",
  nearby: "Trainers based close to you",
};

/** /trainers/: every listed APEX trainer, with filters and a 5-question match. ?match=1 opens the quiz. */
export function Directory() {
  const api = useMemo(() => (isDemo() || !supabase ? demoDirectory() : liveDirectory(supabase)), []);
  const [list, setList] = useState<TrainerCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<DirectoryFilter>(EMPTY_FILTER);
  const [quiz, setQuiz] = useState(() => { try { return new URLSearchParams(location.search).get("match") === "1"; } catch { return false; } });

  useEffect(() => {
    api.trainers().then(setList, (e: unknown) => { setList([]); setError(e instanceof Error ? e.message : String(e)); });
  }, [api]);

  const shown = useMemo(() => (list ? filterTrainers(list, f) : []), [list, f]);
  const set = (patch: Partial<DirectoryFilter>) => setF((x) => ({ ...x, ...patch }));
  const active = filterCount(f);

  return (
    <main className="gr-shell">
      <div className="gr-top">
        <a className="wordmark" href="/" style={{ gap: 8, textDecoration: "none", color: "inherit" }}><ApexLogo height={26} /></a>
        <ThemeButton />
      </div>

      <section className="ft-hero" aria-label="Find a trainer">
        <EditorialTitle as="h1" text="Find a trainer" caption="Personal trainers on APEX" />
        <p>Every trainer here writes your plan themselves and coaches you in the APEX app. Compare them, or answer 5 questions and we'll show your best 3.</p>
        <div className="ft-cta-row">
          <button className="gr-cta" onClick={() => setQuiz(true)}><Icons.spark width={15} height={15} /> Match me</button>
        </div>
      </section>

      <section className="ft-filters" aria-label="Filter trainers">
        <label className="ft-search">
          <Icons.pin width={16} height={16} aria-hidden />
          <input placeholder="Town or area, for example Leeds" value={f.place} onChange={(e) => set({ place: e.target.value })} aria-label="Town or area" />
          {f.place && <button className="btn ghost sm" onClick={() => set({ place: "" })} aria-label="Clear the place">✕</button>}
        </label>
        <div className="ft-scroll" role="group" aria-label="GoalChoice">
          {GOAL_CHOICES.map((g) => <button key={g} type="button" className="gr-chip" aria-pressed={f.goal === g} onClick={() => set({ goal: f.goal === g ? null : g })}>{g}</button>)}
        </div>
        <div className="ft-scroll" role="group" aria-label="How and budget">
          {(Object.keys(MODE_LABEL) as TrainingModeName[]).map((m) => <button key={m} type="button" className="gr-chip" aria-pressed={f.mode === m} onClick={() => set({ mode: f.mode === m ? null : m })}>{MODE_LABEL[m]}</button>)}
          <button type="button" className="gr-chip" aria-pressed={f.verifiedOnly} onClick={() => set({ verifiedOnly: !f.verifiedOnly })}><Icons.verified width={13} height={13} style={{ verticalAlign: -2 }} /> Verified</button>
          {BUDGET_CHOICES.slice(1).map((b) => <button key={b.label} type="button" className="gr-chip" aria-pressed={f.maxPence === b.pence} onClick={() => set({ maxPence: f.maxPence === b.pence ? null : b.pence })}>{b.label}</button>)}
        </div>
        <div className="sect" style={{ margin: 0 }}>
          <span className="ft-count" role="status">{list === null ? "Loading trainers…" : `${shown.length} trainer${shown.length === 1 ? "" : "s"}`}{active ? ` · ${active} filter${active === 1 ? "" : "s"}` : ""}</span>
          <div className="row" style={{ gap: 6 }}>
            {active > 0 && <button className="btn ghost sm" onClick={() => setF({ ...EMPTY_FILTER, sort: f.sort })}>Clear</button>}
            <select className="field" style={{ width: "auto", padding: "8px 10px" }} value={f.sort} onChange={(e) => set({ sort: e.target.value as DirectorySort })} aria-label="Sort">
              {(Object.keys(SORT_LABEL) as DirectorySort[]).map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
      </section>

      {error && <div className="card small" role="alert">{error === MARKETPLACE_NEEDS_UPDATE ? "The directory is being set up. Check back soon." : error}</div>}
      {list !== null && !error && (
        shown.length ? (
          <div className="ft-list">
            {shown.map((t, i) => (
              <TrainerCardView key={t.slug} trainer={t} href={directoryLink(location.origin, t.slug)} i={i}>
                <a className="btn ghost" href={directoryLink(location.origin, t.slug)}>See profile</a>
                <a className="btn act" href={`${directoryLink(location.origin, t.slug)}&form=1`}>Ask to train</a>
              </TrainerCardView>
            ))}
          </div>
        ) : (
          <div className="card stack" style={{ gap: 10 }}>
            <b>{list.length ? "No trainers match all of that yet" : "Trainers are joining now"}</b>
            <span className="small">{list.length ? "Try fewer filters, or choose Online: online trainers can coach you from anywhere." : "Check back soon, or ask a trainer you know to join APEX."}</span>
            {list.length > 0 && <button className="btn ghost" onClick={() => setF({ ...EMPTY_FILTER, sort: f.sort })}>Show all trainers</button>}
          </div>
        )
      )}

      <p className="ft-note">Trainers choose to be listed. <b>Verified</b> means APEX has checked the trainer's qualification and their insurance, and both are in date. Star ratings come only from the trainer's own clients in APEX.</p>
      <div className="card flat li">
        <Icons.trophy width={18} height={18} style={{ color: "var(--act)" }} />
        <div className="grow"><div className="h3">Are you a personal trainer?</div><div className="tiny">Get listed here free when you coach with APEX.</div></div>
        <a className="btn ghost sm" href="/">Find out more</a>
      </div>

      {quiz && list && (
        <Sheet label="Match me with a trainer" onClose={() => setQuiz(false)}>
          <MatchQuiz trainers={list} onBrowse={(a) => { setQuiz(false); setF({ ...EMPTY_FILTER, goal: a.goal, mode: a.how === "hybrid" ? null : a.how, place: a.how === "online" ? "" : a.place }); }} />
        </Sheet>
      )}
    </main>
  );
}

/** Five short questions, then the best 3 with the reasons. The answers ride along to the trainer's enquiry form. */
function MatchQuiz({ trainers, onBrowse }: { trainers: TrainerCard[]; onBrowse: (a: MatchAnswers) => void }) {
  const [a, setA] = useState<MatchAnswers>(EMPTY_ANSWERS);
  const [at, setAt] = useState(0);
  const steps = matchSteps(a);
  const done = at >= steps.length;
  const step = steps[Math.min(at, steps.length - 1)]!;
  const pick = <K extends keyof MatchAnswers>(k: K, v: MatchAnswers[K]) => { setA((x) => ({ ...x, [k]: v })); setAt((n) => n + 1); };
  const results = useMemo(() => (done ? matchTrainers(trainers, a) : []), [done, trainers, a]);

  if (done) {
    return (
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <span className="ft-eyebrow">Your matches</span>
          <h2 className="ft-q" style={{ marginTop: 8 }}>{results.length ? `Your best ${results.length === 1 ? "match" : results.length}` : "No exact match yet"}</h2>
          <p className="small" style={{ margin: "8px 0 0" }}>{results.length ? "Your answers go with your message, so the trainer knows you before they reply." : "No listed trainer fits all of that yet. Online trainers can coach you from anywhere."}</p>
        </div>
        {results.map((m, i) => (
          <TrainerCardView key={m.trainer.slug} trainer={m.trainer} rank={i + 1} reasons={m.reasons} i={i}>
            <a className="btn ghost" href={directoryLink(location.origin, m.trainer.slug).replace("src=directory", "src=match")}>See profile</a>
            <a className="btn act" href={matchLink(location.origin, m.trainer.slug, a)}>Ask {m.trainer.name.split(" ")[0]}</a>
          </TrainerCardView>
        ))}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost grow" onClick={() => { setA(EMPTY_ANSWERS); setAt(0); }}>Start again</button>
          <button className="btn ghost grow" onClick={() => onBrowse(a)}>Browse all</button>
        </div>
      </div>
    );
  }

  return (
    <MatchStepView step={at + 1} of={steps.length} title={step.title} caption={step.caption}>
      {step.key === "goal" && (
        <div className="ft-options">
          {GOAL_CHOICES.map((g) => <button key={g} className="ft-option" aria-pressed={a.goal === g} onClick={() => pick("goal", g as GoalChoice)}>{g}</button>)}
        </div>
      )}
      {step.key === "how" && (
        <div className="ft-options">
          {HOW.map(([m, t, s]) => <button key={m} className="ft-option" aria-pressed={a.how === m} onClick={() => pick("how", m)}><span>{t}<small>{s}</small></span></button>)}
        </div>
      )}
      {step.key === "place" && (
        <form className="stack" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); setAt((n) => n + 1); }}>
          <label className="ft-search"><Icons.pin width={16} height={16} aria-hidden /><input autoFocus placeholder="For example Manchester" value={a.place} onChange={(e) => setA((x) => ({ ...x, place: e.target.value }))} aria-label="Your town or area" /></label>
          <button className="gr-cta" style={{ animation: "none" }}>{a.place.trim() ? "Next" : "Skip"}</button>
        </form>
      )}
      {step.key === "maxPence" && (
        <div className="ft-options">
          {BUDGET_CHOICES.map((b) => <button key={b.label} className="ft-option" aria-pressed={at > 0 && a.maxPence === b.pence} onClick={() => pick("maxPence", b.pence)}>{b.label}</button>)}
        </div>
      )}
      {step.key === "priority" && (
        <div className="ft-options">
          {(Object.keys(PRIORITY_LABEL) as MatchPriority[]).filter((p) => p !== "nearby" || a.how !== "online").map((p) => (
            <button key={p} className="ft-option" aria-pressed={a.priority === p} onClick={() => pick("priority", p)}><span>{PRIORITY_LABEL[p]}<small>{PRIORITY_HINT[p]}</small></span></button>
          ))}
        </div>
      )}
      {at > 0 && <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => setAt((n) => n - 1)}>Back</button>}
    </MatchStepView>
  );
}
