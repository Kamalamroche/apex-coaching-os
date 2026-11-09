import { DIETS, EXPERIENCE, HEALTH_QUESTIONS, blankIntake, healthFlags, intakeProblem, type IntakeAnswers } from "@apex/core";
import { BackLink } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { useLifestyle, useLifestyleStore } from "../../data/LifestyleContext";

/** The onboarding questionnaire: a health check, goals, training background and lifestyle. Sent once, can be updated. */
export function Intake({ onExit, onDone }: { onExit: () => void; onDone: () => void }) {
  const store = useLifestyleStore();
  const { intake } = useLifestyle();
  const { coachName } = useAppInfo();
  const [a, setA] = useState<IntakeAnswers>(() => (intake ? { ...intake.answers, confirmed: false } : blankIntake()));
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof IntakeAnswers>(k: K, v: IntakeAnswers[K]) => setA((s) => ({ ...s, [k]: v }));
  const problem = intakeProblem(a);
  const flags = healthFlags(a).length;

  const send = async () => {
    setSending(true);
    setErr(null);
    try {
      await store.submitIntake(a);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send. Check your connection and try again.");
      setSending(false);
    }
  };

  const text = (k: "goal" | "why" | "injuries" | "equipment" | "lifestyle" | "healthDetail" | "foodNotes", label: string, hint: string, rows = 2) => (
    <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label}
      <textarea id={`in-${k}`} className="field" rows={rows} maxLength={1500} placeholder={hint} value={a[k]} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  return (
    <>
      <BackLink onClick={onExit}>Back</BackLink>
      <div><div className="eyebrow">About you</div><h1 className="h1">Help {coachName} plan for you</h1><p className="sub">About five minutes. Only {coachName} sees your answers.</p></div>

      <section className="card stack">
        <div><h2 className="h2">Health check</h2><div className="small" style={{ marginTop: 4 }}>A yes doesn't stop you training. It means {coachName} will talk it through with you first, and may ask you to check with your doctor.</div></div>
        {HEALTH_QUESTIONS.map((q) => (
          <div key={q.key} className="row" style={{ alignItems: "flex-start", gap: 12 }}>
            <div className="small grow" style={{ color: "var(--text)" }}>{q.text}</div>
            <div className="yn" role="group" aria-label={q.text}>
              <button type="button" className={a.health[q.key] ? "" : "on"} aria-pressed={!a.health[q.key]} onClick={() => set("health", { ...a.health, [q.key]: false })}>No</button>
              <button type="button" className={a.health[q.key] ? "on yes" : ""} aria-pressed={!!a.health[q.key]} onClick={() => set("health", { ...a.health, [q.key]: true })}>Yes</button>
            </div>
          </div>
        ))}
        {flags > 0 && text("healthDetail", "Tell us a little more", "What it is, when it started, and anything your doctor has said")}
      </section>

      <section className="card stack">
        <h2 className="h2">Your goal</h2>
        {text("goal", "What do you most want to achieve?", "e.g. Lose 6 kg by June, run a 10k, get stronger for rugby")}
        {text("why", "Why does it matter to you?", "The reason behind the goal")}
      </section>

      <section className="card stack">
        <h2 className="h2">Training</h2>
        <div>
          <div className="h3" style={{ marginBottom: 6 }}>How long have you been training?</div>
          <div className="chips" style={{ flexWrap: "wrap" }}>{EXPERIENCE.map((x) => <button key={x} type="button" className={`chip ${a.experience === x ? "on" : ""}`} aria-pressed={a.experience === x} onClick={() => set("experience", a.experience === x ? "" : x)}>{x}</button>)}</div>
        </div>
        <div>
          <div className="h3" style={{ marginBottom: 6 }}>Days a week you can train</div>
          <div className="rpe">{[1, 2, 3, 4, 5, 6, 7].map((n) => <button key={n} type="button" className={a.daysPerWeek === n ? "on" : ""} aria-pressed={a.daysPerWeek === n} onClick={() => set("daysPerWeek", a.daysPerWeek === n ? null : n)}>{n}</button>)}</div>
        </div>
        {text("equipment", "Where do you train, and with what?", "e.g. Commercial gym, or home with dumbbells up to 20 kg")}
        {text("injuries", "Injuries or niggles", "Past or present, and anything that hurts during exercise")}
      </section>

      <section className="card stack">
        <div><h2 className="h2">Food</h2><div className="small" style={{ marginTop: 4 }}>Your recipes are matched to this. Skip it if you eat everything.</div></div>
        <div>
          <div className="h3" style={{ marginBottom: 6 }}>How do you eat?</div>
          <div className="chips" style={{ flexWrap: "wrap" }} role="group" aria-label="Diet">
            {DIETS.map((x) => { const on = (a.diet ?? []).includes(x); return <button key={x} type="button" className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => set("diet", on ? a.diet.filter((d) => d !== x) : [...(a.diet ?? []), x])}>{x}</button>; })}
          </div>
        </div>
        {text("foodNotes", "Allergies or foods you don't eat", "e.g. Peanut allergy, no pork, don't like fish")}
      </section>

      <section className="card stack">
        <h2 className="h2">Day to day</h2>
        {text("lifestyle", "What does a normal day look like?", "Job, sleep, stress, how you usually eat", 3)}
      </section>

      <label className="row small" style={{ gap: 10, cursor: "pointer", color: "var(--text)" }}>
        <input type="checkbox" checked={a.confirmed} onChange={(e) => set("confirmed", e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
        My answers are true, and I'll tell {coachName} if anything changes.
      </label>
      {err && <div className="card" style={{ borderColor: "var(--crit)", background: "var(--crit-soft)" }}><div className="small" style={{ color: "var(--text)" }}>{err}</div></div>}
      {problem && a.goal && <div className="tiny">{problem}</div>}
      <button className="btn act block" style={{ minHeight: 52 }} disabled={!!problem || sending} onClick={() => void send()}>{sending ? "Sending…" : intake ? `Send update to ${coachName}` : `Send to ${coachName}`}</button>
    </>
  );
}
