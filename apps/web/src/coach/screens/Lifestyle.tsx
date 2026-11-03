import {
  EVERY_DAY, HABIT_PRESETS, HEALTH_QUESTIONS, againstTarget, dayTotals, firstName, habitCompliance, habitDays, habitStreak, kcalFromMacros, localDate, loggedAverage, parseNumber, shortDate,
  type Habit, type HabitKind,
} from "@apex/core";
import { HabitDays, Icons, Label, MacroBars, NumberField } from "@apex/ui";
import { useEffect, useState } from "react";
import { HabitIcon, LifestyleStatus, daysText } from "../../app/LifestyleParts";
import { useLifestyle, useLifestyleStore } from "../../data/LifestyleContext";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** Coach: the client's habits, how they're going, and adding or removing them. */
export function CoachHabits({ clientName, say }: { clientName: string; say: (m: string) => void }) {
  const store = useLifestyleStore();
  const s = useLifestyle();
  const today = localDate(new Date());
  const [title, setTitle] = useState("");
  const [days, setDays] = useState<number[]>(EVERY_DAY);
  const name = firstName(clientName) || "Your client";
  if (s.status !== "ready") return <LifestyleStatus state={s} />;

  const add = (kind: HabitKind, t: string) => {
    const h: Habit = { id: crypto.randomUUID(), kind, title: t.trim(), days: [...days].sort(), createdAt: new Date().toISOString() };
    store.saveHabit(h);
    say(`Habit added · ${name} sees it today`);
  };
  const presets = HABIT_PRESETS.filter((p) => !s.habits.some((h) => h.title === p.title));
  const pct = habitCompliance(s.habits, s.ticks, today);
  const toggleDay = (d: number) => setDays((ds) => (ds.includes(d) ? (ds.length > 1 ? ds.filter((x) => x !== d) : ds) : [...ds, d]));

  return (
    <>
      {s.habits.length > 0 && (
        <div className="card">
          <div className="sect" style={{ marginBottom: 10 }}>
            <h3 className="h3">Last 7 days</h3>
            <span className="row" style={{ gap: 8 }}>{pct !== null && <span className="num" style={{ fontWeight: 700, color: pct >= 80 ? "var(--good)" : pct >= 50 ? "var(--warn)" : "var(--crit)" }}>{pct}%</span>}<Label kind="data">Data</Label></span>
          </div>
          <HabitDays days={habitDays(s.habits, s.ticks, today)} today={today} />
        </div>
      )}
      <div className="card flat list">
        {s.habits.length === 0 && <div className="li small">No habits yet. Start with one or two small ones: they're easier to keep.</div>}
        {s.habits.map((h) => {
          const streak = habitStreak(h, s.ticks, today);
          return (
            <div key={h.id} className="hb-row">
              <HabitIcon kind={h.kind} />
              <div className="grow"><div className="h3">{h.title}</div><div className="tiny">{daysText(h.days)}{streak ? ` · ${streak} in a row` : ""}</div></div>
              <button className="iconbtn" aria-label={`Remove ${h.title}`} onClick={() => { store.removeHabit(h.id); say("Habit removed"); }}><Icons.trash width={16} height={16} /></button>
            </div>
          );
        })}
      </div>
      <section className="card stack">
        <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Add a habit</h3></div>
        <div>
          <div className="tiny" style={{ marginBottom: 6 }}>Days</div>
          <div className="chips" role="group" aria-label="Days">
            {DAY_LETTERS.map((l, d) => <button key={d} type="button" className={`chip ${days.includes(d) ? "on" : ""}`} style={{ minWidth: 34, justifyContent: "center" }} aria-pressed={days.includes(d)} aria-label={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][d]} onClick={() => toggleDay(d)}>{l}</button>)}
          </div>
        </div>
        {presets.length > 0 && <div className="chips" style={{ flexWrap: "wrap" }}>{presets.map((p) => <button key={p.title} className="chip" onClick={() => add(p.kind, p.title)}><Icons.plus width={13} height={13} /> {p.title}</button>)}</div>}
        <div className="row" style={{ gap: 8 }}>
          <input id="habit-title" className="field" style={{ flex: 1, minWidth: 0 }} maxLength={120} placeholder="Or write your own, e.g. Stretch before bed" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) { add("custom", title); setTitle(""); } }} />
          <button className="btn act" disabled={!title.trim()} onClick={() => { add("custom", title); setTitle(""); }}>Add</button>
        </div>
      </section>
    </>
  );
}

/** Coach: set the client's calorie and macro targets, and see what they've logged. */
export function CoachNutritionPanel({ clientName, say }: { clientName: string; say: (m: string) => void }) {
  const store = useLifestyleStore();
  const s = useLifestyle();
  const today = localDate(new Date());
  const name = firstName(clientName) || "Your client";
  const t = s.targets;
  const fromTargets = () => ({ kcal: t ? String(t.kcal) : "", p: t ? String(t.proteinG) : "", c: t ? String(t.carbsG) : "", f: t ? String(t.fatG) : "", note: t?.note ?? "" });
  const [form, setForm] = useState(fromTargets);
  // A different client, or the targets arriving from the database: start from what's saved.
  useEffect(() => setForm(fromTargets()), [t?.kcal, t?.proteinG, t?.carbsG, t?.fatG, t?.note]);
  if (s.status !== "ready") return <LifestyleStatus state={s} />;

  const vals = { kcal: parseNumber(form.kcal), p: parseNumber(form.p), c: parseNumber(form.c), f: parseNumber(form.f) };
  const ok = Object.values(vals).every((v) => v !== null && v >= 0);
  const fromMacros = ok ? kcalFromMacros({ proteinG: vals.p ?? 0, carbsG: vals.c ?? 0, fatG: vals.f ?? 0 }) : null;
  const changed = JSON.stringify(form) !== JSON.stringify(fromTargets());
  const save = () => {
    if (!ok) return;
    store.setTargets({ kcal: vals.kcal ?? 0, proteinG: vals.p ?? 0, carbsG: vals.c ?? 0, fatG: vals.f ?? 0, note: form.note });
    say(`Targets saved · ${name} sees them now`);
  };
  const eaten = dayTotals(s.food, today);
  const week = loggedAverage(s.food, today);
  const todays = s.food.filter((f) => f.day === today);
  const weekState = t && week.days ? againstTarget(week.avg.kcal, t.kcal) : null;

  return (
    <>
      {t && (
        <div className="card stack">
          <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Today · <span className="num">{Math.round(eaten.kcal).toLocaleString()}</span> of <span className="num">{t.kcal.toLocaleString()}</span> kcal</h3><Label kind="data">Data</Label></div>
          <MacroBars lines={[
            { label: "Protein", value: eaten.proteinG, target: t.proteinG, unit: "g", colour: "var(--viz-1)" },
            { label: "Carbs", value: eaten.carbsG, target: t.carbsG, unit: "g", colour: "var(--viz-2)" },
            { label: "Fat", value: eaten.fatG, target: t.fatG, unit: "g", colour: "var(--viz-3)" },
          ]} />
          <div className="small">
            {week.days ? <>7-day average <span className="num" style={{ color: "var(--text)", fontWeight: 700 }}>{week.avg.kcal.toLocaleString()} kcal</span>, <span className="num" style={{ color: "var(--text)", fontWeight: 700 }}>{week.avg.proteinG} g protein</span> over {week.days} day{week.days === 1 ? "" : "s"} logged{weekState === "on" ? ", on target." : weekState === "under" ? ", under target." : weekState === "over" ? ", over target." : "."}</> : `${name} hasn't logged any food this week.`}
          </div>
        </div>
      )}
      {todays.length > 0 && (
        <div className="card flat list">
          {todays.map((f) => (
            <div key={f.id} className="li"><div className="grow"><div className="h3">{f.name}</div><div className="tiny">{f.meal[0]?.toUpperCase()}{f.meal.slice(1)} · <span className="num">P {f.proteinG} · C {f.carbsG} · F {f.fatG}</span></div></div><span className="num small">{Math.round(f.kcal)}</span></div>
          ))}
        </div>
      )}
      <section className="card stack">
        <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">{t ? "Daily targets" : `Set ${name}'s daily targets`}</h3><Label kind="dec">Coach decision</Label></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(88px,1fr))", gap: 10 }}>
          <NumberField id="nt-kcal" label="Calories" unit="kcal" value={form.kcal} onChange={(v) => setForm({ ...form, kcal: v })} />
          <NumberField id="nt-p" label="Protein" unit="g" value={form.p} onChange={(v) => setForm({ ...form, p: v })} />
          <NumberField id="nt-c" label="Carbs" unit="g" value={form.c} onChange={(v) => setForm({ ...form, c: v })} />
          <NumberField id="nt-f" label="Fat" unit="g" value={form.f} onChange={(v) => setForm({ ...form, f: v })} />
        </div>
        {fromMacros !== null && vals.kcal !== null && Math.abs(fromMacros - vals.kcal) > Math.max(50, vals.kcal * 0.05) && (
          <div className="tiny" style={{ color: "var(--warn)" }}>These macros add up to {fromMacros.toLocaleString()} kcal, not {vals.kcal.toLocaleString()}.</div>
        )}
        <input id="nt-note" className="field" maxLength={500} placeholder={`A tip for ${name}, e.g. 30 g of protein at breakfast`} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button className="btn act block" disabled={!ok || !changed} onClick={save}>{t ? "Save targets" : "Set targets"}</button>
      </section>
    </>
  );
}

/** Coach: the client's onboarding answers, health answers first. */
export function IntakeView({ clientName }: { clientName: string }) {
  const s = useLifestyle();
  const name = firstName(clientName) || "Your client";
  if (s.status !== "ready") return <LifestyleStatus state={s} />;
  if (!s.intake) return <div className="card small">{name} hasn't filled in the questionnaire yet. It's waiting for them at the top of their Today screen.</div>;
  const a = s.intake.answers;
  const yes = HEALTH_QUESTIONS.filter((q) => a.health[q.key]);
  const rows: [string, string][] = [
    ["Goal", a.goal], ["Why it matters", a.why], ["Training for", a.experience], ["Days a week", a.daysPerWeek ? String(a.daysPerWeek) : ""],
    ["Where and with what", a.equipment], ["Injuries or niggles", a.injuries], ["A normal day", a.lifestyle],
  ];
  return (
    <>
      <div className="card" style={yes.length ? { borderColor: "var(--warn)", background: "var(--warn-soft)" } : undefined}>
        <div className="sect" style={{ marginBottom: 6 }}><h3 className="h3">Health check</h3><span className="tiny">Sent {shortDate(s.intake.submittedAt)}</span></div>
        {yes.length ? (
          <>
            <div className="small" style={{ color: "var(--text)" }}>{name} answered yes to {yes.length === 1 ? "one question" : `${yes.length} questions`}. Talk it through before hard training, and ask for a doctor's OK if you're unsure.</div>
            <ul className="small" style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--text)" }}>{yes.map((q) => <li key={q.key}>{q.text}</li>)}</ul>
            {a.healthDetail && <div className="small" style={{ marginTop: 8, color: "var(--text)" }}>“{a.healthDetail}”</div>}
          </>
        ) : <div className="small">No to every health question.</div>}
      </div>
      <div className="card flat list">
        {rows.filter(([, v]) => v.trim()).map(([k, v]) => (
          <div key={k} className="li" style={{ alignItems: "flex-start" }}><div className="grow"><div className="tiny">{k}</div><div className="small" style={{ color: "var(--text)", whiteSpace: "pre-wrap" }}>{v}</div></div></div>
        ))}
      </div>
    </>
  );
}
