import { incomeGoalProblem, incomePlan, incomePlanSummary, parsePounds, pounds, weeklySteps, type BizSummary } from "@apex/core";
import { GoalMeter, Icons, Label } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { STORIES_NEED_UPDATE, demoStories, liveStories, type StoriesApi } from "../../data/stories";
import type { CoachLiveProps } from "../CoachApp";

/** Business: a monthly income goal, and what it takes to get there from the trainer's own numbers. */
export function IncomeGoal({ live, sum, say }: { live?: CoachLiveProps; sum: BizSummary; say: (m: string) => void }) {
  const api: StoriesApi = useMemo(() => (live ? liveStories(live.db, live.coachId) : demoStories({})), [live]);
  const [goal, setGoal] = useState<number | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [needsSql, setNeedsSql] = useState(false);
  useEffect(() => {
    api.incomeGoal().then(setGoal, (e: unknown) => { setGoal(null); if (e instanceof Error && e.message === STORIES_NEED_UPDATE) setNeedsSql(true); });
  }, [api]);
  if (goal === undefined) return null;

  const save = async () => {
    const pence = text.trim() ? parsePounds(text) : null;
    if (text.trim() && pence === null) { say("Type an amount like 4000"); return; }
    const problem = incomeGoalProblem(pence);
    if (problem) { say(problem); return; }
    try { await api.setIncomeGoal(pence); setGoal(pence); setEditing(false); say(pence ? `Goal set: ${pounds(pence)} a month` : "Goal cleared"); }
    catch (e) { say(e instanceof Error ? e.message : String(e)); }
  };
  const editor = (
    <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <label className="bz-fee grow" style={{ maxWidth: "none" }}>
        <span className="tiny">£</span>
        <input className="field num" inputMode="decimal" autoFocus placeholder="4000" aria-label="Monthly income goal in pounds" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <button className="btn act">Save</button>
      {goal !== null && <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>}
    </form>
  );

  if (needsSql) return <div className="card small full">Your income goal needs a database update first: run 20261201090000_growth_stories.sql in Supabase.</div>;
  if (goal === null || editing) {
    return (
      <section className="card full stack" style={{ gap: 10 }}>
        <div className="sect" style={{ margin: 0 }}><h3 className="h3">Your income goal</h3><Label kind="dec">Coach decision</Label></div>
        <p className="small" style={{ margin: 0 }}>What would you like to earn a month? APEX works out how many clients and enquiries that takes, from your own fees and win rate.</p>
        {editor}
      </section>
    );
  }
  const plan = incomePlan(goal, sum);
  const steps = weeklySteps(plan);
  return (
    <section className="card full stack" style={{ gap: 12 }}>
      <div className="sect" style={{ margin: 0 }}><h3 className="h3">Your income goal</h3><Label kind="insight">Insight</Label></div>
      <GoalMeter plan={plan} />
      <p className="small" style={{ margin: 0 }}>{incomePlanSummary(plan)}</p>
      {steps.length > 0 && (
        <>
          <div className="tiny">This week</div>
          <ol className="sg-steps">
            {steps.map((s, i) => <li key={s.text}><span>{i + 1}</span><div><b>{s.text}</b><small>{s.why}</small></div></li>)}
          </ol>
        </>
      )}
      {plan.winAssumed && !plan.reached && <p className="bz-note" style={{ margin: 0 }}>No decided enquiries yet, so this uses a starting guess of {plan.winPct}% win rate. It switches to your real rate as leads become clients or say no.</p>}
      <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => { setText(String(Math.round(goal / 100))); setEditing(true); }}><Icons.edit width={14} height={14} /> Change goal</button>
    </section>
  );
}
