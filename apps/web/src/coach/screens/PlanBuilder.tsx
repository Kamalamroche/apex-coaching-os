import { DAY_NAMES, PLAN_EXAMPLES, buildPlan, exerciseById, firstName, formatRest, fromTemplate, newKey, templateSummary, type BuiltPlan } from "@apex/core";
import { Label, PlanDayCard, Sheet, UnderstoodChips, type PlanDayView } from "@apex/ui";
import { useMemo, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { useStore } from "../../data/StoreContext";
import { demoTemplates, liveTemplates } from "../../data/templates";
import type { CoachLiveProps } from "../CoachApp";

/** Rows the plan card shows: "A · Barbell Back Squat · 4×5 · RPE 8 · 3 min". */
function dayView(plan: BuiltPlan): PlanDayView[] {
  return plan.template.days.map((d) => ({
    day: DAY_NAMES[d.dayIndex] ?? "",
    name: d.name,
    minutes: d.minutes,
    rows: d.items.map((it) => ({
      group: it.group,
      name: exerciseById(it.exerciseId).name,
      dose: it.group.startsWith("W") ? `${it.reps} reps` : `${it.sets}×${it.reps} · RPE ${it.rpe}${it.restSeconds ? ` · ${formatRest(it.restSeconds)}` : ""}`,
      ...(it.note && !it.group.startsWith("W") ? { note: it.note } : {}),
      ...(it.blockStyle === "circuit" ? { circuit: true } : {}),
    })),
  }));
}

/** The coach describes the client in their own words and gets a full programme to review.
    Rule-based for now. Nothing reaches the client until the coach chooses "Use for …". */
export function PlanBuilder({ live, onClose, say }: { live?: CoachLiveProps; onClose: () => void; say: (m: string) => void }) {
  const store = useStore();
  const { clientName } = useAppInfo();
  const first = firstName(clientName) || "this client";
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<BuiltPlan | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const days = useMemo(() => (plan ? dayView(plan) : []), [plan]);

  const build = (t = text) => {
    if (t.trim().length < 6) return;
    setPlan(buildPlan(t, newKey()));
    setConfirm(false);
    setSaved(false);
    setErr(null);
  };

  const use = () => {
    if (!plan) return;
    store.startProgram(fromTemplate(plan.template));
    say(`${first} is now on ${plan.template.name} · logged as your decision`);
    onClose();
  };

  const saveTemplate = async () => {
    if (!plan) return;
    try {
      await (live ? liveTemplates(live.db) : demoTemplates()).save(plan.template);
      setSaved(true);
      say(`Saved “${plan.template.name}” to your templates`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Sheet onClose={onClose} label="Plan builder">
      <div className="row"><Label kind="ai">AI suggestion</Label><span className="tiny">You review every day before {first} sees anything</span></div>
      <div><div className="eyebrow">Describe the client</div><h2 className="h2">Plan builder</h2></div>
      <form style={{ display: "flex", flexDirection: "column", gap: 8 }} onSubmit={(e) => { e.preventDefault(); build(); }}>
        <textarea
          className="field pbd-area"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Goal, days a week, experience, where they train, session length, any injuries…"
          aria-label="Describe the client"
          autoFocus
        />
        <div className="row" style={{ gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <span className="tiny">Say it as you would to a colleague. Anything left out gets a safe default.</span>
          <button className="btn act" disabled={text.trim().length < 6}>Build the plan</button>
        </div>
      </form>
      {!plan && (
        <div className="pb-pick">
          {PLAN_EXAMPLES.map((e) => <button key={e} className="chip" style={{ textAlign: "left" }} onClick={() => { setText(e); build(e); }}>{e}</button>)}
        </div>
      )}

      {plan && (
        <>
          <div className="cop-sum">
            <b>{plan.template.name}</b>
            <span className="tiny num">{templateSummary(plan.template)} · {plan.template.note}</span>
          </div>
          <UnderstoodChips understood={plan.brief.understood} assumed={plan.brief.assumed} />
          <div className="pbd-days">
            {days.map((d, i) => <PlanDayCard key={`${d.day}-${d.name}`} view={d} index={i} />)}
          </div>
          <div className="card flat" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="row" style={{ gap: 8 }}><Label kind="insight">Why this plan</Label></div>
            <ul className="pbd-why">{plan.why.map((w) => <li key={w}>{w}</li>)}</ul>
            <span className="tiny">Loads start blank: {first} logs the first week, then Progressions on your Brief suggests the next step.</span>
          </div>
          {err && <p className="small" style={{ margin: 0, color: "var(--crit)" }}>{err}</p>}
          {confirm ? (
            <div className="tpl-confirm">
              <span className="small">Replaces {first}'s current programme. The old one stays in their history, and you can still edit every day after.</span>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn ghost sm" onClick={() => setConfirm(false)}>Cancel</button>
                <button className="btn act sm" onClick={use}>Start {first} on it</button>
              </div>
            </div>
          ) : (
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn act" onClick={() => setConfirm(true)}>Use for {first}</button>
              <button className="btn ghost" disabled={saved} onClick={() => void saveTemplate()}>{saved ? "Saved as template" : "Save as template"}</button>
              <button className="btn ghost" onClick={() => setPlan(null)}>Start again</button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
