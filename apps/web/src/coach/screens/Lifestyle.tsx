import {
  feetInches, fromFeetInches, ACTIVITY_LEVELS, EVERY_DAY, HABIT_PRESETS, NUTRITION_GOALS, suggestTargets, targetInputsProblem, HEALTH_QUESTIONS, againstTarget, dayTotals, firstName, habitCompliance, habitDays, habitStreak, formatMl, kcalFromMacros, localDate, loggedAverage, parseNumber, shortDate, waterGoalMl, waterOn,
  type ActivityLevel, type Habit, type HabitKind, type NutritionGoal, type Sex, type SuggestedTargets,
  weekDaysOf, weekNutrition, restDayProblem, suggestRestDay, nutritionNudge, nutritionScore, targetsFor, workoutOn,
  type NutritionTargets,
} from "@apex/core";
import { useApexState } from "@apex/core/react";
import { useStore } from "../../data/StoreContext";
import { HabitDays, Icons, Label, LiquidTank, MacroBars, MacroTable, NumberField, WeekFuel, useUnits, useConvertedText } from "@apex/ui";
import { useEffect, useState } from "react";
import { HabitIcon, LifestyleStatus, daysText } from "../../app/LifestyleParts";
import { CoachPlanEditor } from "../../app/MealPlanParts";
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
              {h.kind === "water" && s.waterReady
                ? <LiquidTank size="mini" pct={waterOn(s.water, today) / waterGoalMl(h.title)} label={`${formatMl(waterOn(s.water, today))} of water today`} />
                : <HabitIcon kind={h.kind} />}
              <div className="grow"><div className="h3">{h.title}</div><div className="tiny">{daysText(h.days)}{streak ? ` · ${streak} in a row` : ""}{h.kind === "water" && s.waterReady ? ` · ${formatMl(waterOn(s.water, today))} today` : ""}</div></div>
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
  const r = t?.restDay;
  const fromTargets = () => ({
    kcal: t ? String(t.kcal) : "", p: t ? String(t.proteinG) : "", c: t ? String(t.carbsG) : "", f: t ? String(t.fatG) : "", note: t?.note ?? "",
    rest: !!r, rk: r ? String(r.kcal) : "", rp: r ? String(r.proteinG) : "", rc: r ? String(r.carbsG) : "", rf: r ? String(r.fatG) : "",
  });
  const [form, setForm] = useState(fromTargets);
  // A different client, or the targets arriving from the database: start from what's saved.
  useEffect(() => setForm(fromTargets()), [t?.kcal, t?.proteinG, t?.carbsG, t?.fatG, t?.note, JSON.stringify(r ?? null)]);
  if (s.status !== "ready") return <LifestyleStatus state={s} />;

  const vals = { kcal: parseNumber(form.kcal), p: parseNumber(form.p), c: parseNumber(form.c), f: parseNumber(form.f) };
  const restVals = { kcal: parseNumber(form.rk) ?? -1, proteinG: parseNumber(form.rp) ?? -1, carbsG: parseNumber(form.rc) ?? -1, fatG: parseNumber(form.rf) ?? -1 };
  const restProblem = form.rest ? restDayProblem(restVals) : null;
  const ok = Object.values(vals).every((v) => v !== null && v >= 0) && !restProblem;
  const toggleRest = () => {
    if (form.rest) { setForm({ ...form, rest: false }); return; }
    const s0 = form.rk ? null : suggestRestDay({ kcal: vals.kcal ?? 0, proteinG: vals.p ?? 0, carbsG: vals.c ?? 0, fatG: vals.f ?? 0 });
    setForm({ ...form, rest: true, ...(s0 ? { rk: String(s0.kcal), rp: String(s0.proteinG), rc: String(s0.carbsG), rf: String(s0.fatG) } : {}) });
  };
  const fromMacros = ok ? kcalFromMacros({ proteinG: vals.p ?? 0, carbsG: vals.c ?? 0, fatG: vals.f ?? 0 }) : null;
  const changed = JSON.stringify(form) !== JSON.stringify(fromTargets());
  const save = () => {
    if (!ok) return;
    // Leave restDay out entirely when it was never used, so targets keep saving before the rest-day SQL runs.
    const restDay = form.rest ? restVals : r ? null : undefined;
    store.setTargets({ kcal: vals.kcal ?? 0, proteinG: vals.p ?? 0, carbsG: vals.c ?? 0, fatG: vals.f ?? 0, note: form.note, ...(restDay !== undefined ? { restDay } : {}) });
    say(`Targets saved · ${name} sees them now`);
  };
  const eaten = dayTotals(s.food, today);
  const week = loggedAverage(s.food, today);
  const todays = s.food.filter((f) => f.day === today);
  const weekView = weekNutrition(s.food, weekDaysOf(today));
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
      {t && <NutritionScoreCard name={name} targets={t} food={s.food} today={today} />}
      {weekView.loggedDays > 0 && (
        <div className="card stack">
          <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">This week · {weekView.loggedDays} of 7 days logged</h3><Label kind="data">Data</Label></div>
          <WeekFuel days={weekView.days.map((d) => ({ day: d.day, kcal: d.totals.kcal, logged: d.logged }))} goal={t?.kcal ?? null} selected={today} />
          <div className="wf-stats">
            <div><span className="tiny">Average a day</span><b>{weekView.avg.kcal.toLocaleString("en-GB")}</b></div>
            <div><span className="tiny">Daily goal</span><b>{t ? t.kcal.toLocaleString("en-GB") : "–"}</b></div>
            <div><span className="tiny">Week total</span><b>{Math.round(weekView.total.kcal).toLocaleString("en-GB")}</b></div>
          </div>
          <MacroTable avg={weekView.avg} total={weekView.total} goal={t} />
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
        <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">{t ? (form.rest ? "Training-day targets" : "Daily targets") : `Set ${name}'s daily targets`}</h3><Label kind="dec">Coach decision</Label></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(88px,1fr))", gap: 10 }}>
          <NumberField id="nt-kcal" label="Calories" unit="kcal" value={form.kcal} onChange={(v) => setForm({ ...form, kcal: v })} />
          <NumberField id="nt-p" label="Protein" unit="g" value={form.p} onChange={(v) => setForm({ ...form, p: v })} />
          <NumberField id="nt-c" label="Carbs" unit="g" value={form.c} onChange={(v) => setForm({ ...form, c: v })} />
          <NumberField id="nt-f" label="Fat" unit="g" value={form.f} onChange={(v) => setForm({ ...form, f: v })} />
        </div>
        {fromMacros !== null && vals.kcal !== null && Math.abs(fromMacros - vals.kcal) > Math.max(50, vals.kcal * 0.05) && (
          <div className="tiny" style={{ color: "var(--warn)" }}>These macros add up to {fromMacros.toLocaleString()} kcal, not {vals.kcal.toLocaleString()}.</div>
        )}
        <button type="button" className={`chip rest-toggle ${form.rest ? "on" : ""}`} aria-pressed={form.rest} disabled={!form.rest && !Object.values(vals).every((v) => v !== null && v > 0)} onClick={toggleRest}>
          <Icons.sleep width={14} height={14} /> {form.rest ? "Different targets on rest days" : "Set different targets for rest days"}
        </button>
        {form.rest && (
          <div className="stack rest-day" style={{ gap: 8 }}>
            <div className="small">Rest days are the days with no workout in {name}'s program, and {name}'s Nutrition screen switches to these on its own. We started from the same protein and fat with about a third fewer carbs. Change anything you like.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(88px,1fr))", gap: 10 }}>
              <NumberField id="nt-rkcal" label="Calories" unit="kcal" value={form.rk} onChange={(v) => setForm({ ...form, rk: v })} />
              <NumberField id="nt-rp" label="Protein" unit="g" value={form.rp} onChange={(v) => setForm({ ...form, rp: v })} />
              <NumberField id="nt-rc" label="Carbs" unit="g" value={form.rc} onChange={(v) => setForm({ ...form, rc: v })} />
              <NumberField id="nt-rf" label="Fat" unit="g" value={form.rf} onChange={(v) => setForm({ ...form, rf: v })} />
            </div>
            {restProblem && <div className="tiny" style={{ color: "var(--warn)" }}>{restProblem}</div>}
          </div>
        )}
        <TargetCalculator name={name} onUse={(r) => setForm({ ...form, kcal: String(r.kcal), p: String(r.proteinG), c: String(r.carbsG), f: String(r.fatG) })} />
        <input id="nt-note" className="field" maxLength={500} placeholder={`A tip for ${name}, e.g. 30 g of protein at breakfast`} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button className="btn act block" disabled={!ok || !changed} onClick={save}>{t ? "Save targets" : "Set targets"}</button>
      </section>
      {s.planReady
        ? <CoachPlanEditor key={s.mealPlan?.updatedAt ?? "none"} plan={s.mealPlan} targets={t} name={name} diet={s.intake?.answers.diet ?? []} foodNotes={s.intake?.answers.foodNotes ?? ""} onSave={(p) => { store.setMealPlan(p); say(p ? `Meal plan saved · ${name} sees it now` : "Meal plan removed"); }} />
        : <div className="card small">Meal plans need the latest database update. Run supabase/migrations/20261111090000_meal_plans.sql in the Supabase SQL Editor.</div>}
    </>
  );
}

const CALC_KEY = "apex.targetCalc";
type CalcForm = { sex: Sex; age: string; height: string; weight: string; activity: ActivityLevel; goal: NutritionGoal };
const blankCalc: CalcForm = { sex: "female", age: "", height: "", weight: "", activity: "moderate", goal: "maintain" };
function loadCalc(): CalcForm {
  try { return { ...blankCalc, ...JSON.parse(localStorage.getItem(CALC_KEY) ?? "{}") }; } catch { return blankCalc; }
}

/** Coach: suggested calories and macros from body stats, activity and goal. Fills the target fields; the coach still saves. */
function TargetCalculator({ name, onUse }: { name: string; onUse: (t: SuggestedTargets) => void }) {
  const [open, setOpen] = useState(false);
  const [c, setC] = useState(loadCalc);
  const set = (patch: Partial<CalcForm>) => {
    const next = { ...c, ...patch };
    setC(next);
    try { localStorage.setItem(CALC_KEY, JSON.stringify(next)); } catch { /* private mode: fine */ }
  };
  const u = useUnits();
  const [weightText, setWeightText] = useConvertedText(c.weight, (v) => set({ weight: v }), u.toKg, (kg) => u.w(kg), u.weight === "kg");
  if (!open) return <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}><Icons.target width={14} height={14} style={{ verticalAlign: -2, marginRight: 4 }} />Work out targets for me</button>;
  // The form keeps cm and kg; the boxes show feet, inches and lb when the coach uses them.
  const heightCm = parseNumber(c.height);
  const ftIn = heightCm ? feetInches(heightCm) : null;
  const setFtIn = (ft: string, inch: string) => set({ height: ft || inch ? String(fromFeetInches(parseNumber(ft) ?? 0, parseNumber(inch) ?? 0)) : "" });
  const inputs = { sex: c.sex, age: parseNumber(c.age) ?? undefined, heightCm: parseNumber(c.height) ?? undefined, weightKg: parseNumber(c.weight) ?? undefined, activity: c.activity, goal: c.goal };
  const filled = c.age && c.height && c.weight;
  const problem = filled ? targetInputsProblem(inputs) : null;
  const r = filled && !problem ? suggestTargets(inputs as Parameters<typeof suggestTargets>[0]) : null;
  const act = ACTIVITY_LEVELS.find((a) => a.key === c.activity);
  return (
    <div className="card flat stack" style={{ gap: 12, padding: 14 }}>
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Target calculator</h3><button className="iconbtn" aria-label="Close calculator" onClick={() => setOpen(false)}><Icons.close width={16} height={16} /></button></div>
      <div className="seg" role="radiogroup" aria-label="Sex">
        {(["female", "male"] as const).map((x) => <button key={x} type="button" role="radio" aria-checked={c.sex === x} className={c.sex === x ? "on" : ""} onClick={() => set({ sex: x })}>{x === "female" ? "Female" : "Male"}</button>)}
      </div>
      <div className="nut-calc-grid" style={u.length === "in" ? { gridTemplateColumns: "repeat(2,minmax(0,1fr))" } : undefined}>
        <NumberField id="calc-age" label="Age" unit="yrs" value={c.age} onChange={(v) => set({ age: v })} />
        {u.length === "cm" ? <NumberField id="calc-h" label="Height" unit="cm" value={c.height} onChange={(v) => set({ height: v })} /> : <>
          <NumberField id="calc-h" label="Height" unit="ft" value={ftIn ? String(ftIn.ft) : ""} onChange={(v) => setFtIn(v, ftIn ? String(ftIn.in) : "")} />
          <NumberField id="calc-hi" label="and" unit="in" value={ftIn ? String(ftIn.in) : ""} onChange={(v) => setFtIn(ftIn ? String(ftIn.ft) : "", v)} />
        </>}
        <NumberField id="calc-w" label="Weight" unit={u.weight} value={weightText} onChange={setWeightText} />
      </div>
      <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>Activity
        <select id="calc-act" className="field" value={c.activity} onChange={(e) => set({ activity: e.target.value as ActivityLevel })}>
          {ACTIVITY_LEVELS.map((a) => <option key={a.key} value={a.key}>{a.label}: {a.hint.toLowerCase()}</option>)}
        </select>
      </label>
      <div className="chips" role="group" aria-label="Goal">
        {NUTRITION_GOALS.map((g) => <button key={g.key} className={`chip ${c.goal === g.key ? "on" : ""}`} aria-pressed={c.goal === g.key} onClick={() => set({ goal: g.key })}>{g.label}</button>)}
      </div>
      {problem && <div className="tiny" style={{ color: "var(--warn)" }}>{problem}</div>}
      {r && (
        <>
          <div className="sect" style={{ marginBottom: 0 }}><span className="small">Maintenance about <b className="num" style={{ color: "var(--text)" }}>{r.maintenance.toLocaleString("en-GB")} kcal</b></span><Label kind="insight">Insight</Label></div>
          <div key={`${r.kcal}-${r.proteinG}`} className="nut-calc-out">
            <div><span className="tiny">Calories</span><span className="num"><b>{r.kcal.toLocaleString("en-GB")}</b></span></div>
            <div><span className="tiny">Protein</span><span className="num"><b>{r.proteinG}</b> g</span></div>
            <div><span className="tiny">Carbs</span><span className="num"><b>{r.carbsG}</b> g</span></div>
            <div><span className="tiny">Fat</span><span className="num"><b>{r.fatG}</b> g</span></div>
          </div>
          <div className="tiny">Mifflin-St Jeor, {act?.label.toLowerCase()} activity{c.goal === "lose" ? ", 20% under maintenance, protein 2 g per kg" : c.goal === "gain" ? ", 10% over maintenance, protein 1.8 g per kg" : ", protein 1.8 g per kg"}. A starting point: check {name}'s weight trend after 2 to 3 weeks and adjust.</div>
          <button className="btn block" onClick={() => { onUse(r); setOpen(false); }}>Use these targets</button>
        </>
      )}
    </div>
  );
}

/** Coach: one number for how the client's last week of eating went, and a message to send about it. */
function NutritionScoreCard({ name, targets, food, today }: { name: string; targets: NutritionTargets; food: Parameters<typeof nutritionScore>[0]; today: string }) {
  const store = useStore();
  const { program, workout } = useApexState(store);
  const score = nutritionScore(food, (d) => targetsFor(targets, !!workoutOn(program, workout.week, d)), today);
  const suggested = nutritionNudge(score, name, targets.proteinG);
  const [text, setText] = useState(suggested);
  const [sent, setSent] = useState(false);
  useEffect(() => { setText(suggested); setSent(false); }, [suggested]);
  const word = score.band === "on" ? "On track" : score.band === "mixed" ? "Mixed week" : "Slipping";
  const stat = (label: string, v: number) => <div><b className="num">{v}<span className="of">/{score.days}</span></b><span className="tiny">{label}</span></div>;
  return (
    <section className={`card stack nscore ${score.band}`}>
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Last 7 days</h3><Label kind="data">Data</Label></div>
      <div className="nscore-top">
        <div className="nscore-ring" style={{ ["--p" as string]: `${score.score}%` }}><b className="num">{score.score}</b></div>
        <div className="grow"><div className="nscore-word">{word}</div><div className="tiny">Days logged, calories within 10% and protein hit, against each day's targets.</div></div>
      </div>
      <div className="nscore-stats">{stat("Days logged", score.logged)}{stat("Calories on target", score.onCalories)}{stat("Protein hit", score.onProtein)}</div>
      <div className="nscore-msg stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="h3">Message for {name}</span><Label kind="ai">AI suggestion</Label></div>
        <textarea id="nscore-text" className="field" rows={4} maxLength={600} value={text} onChange={(e) => { setText(e.target.value); setSent(false); }} />
        <button className="btn act" disabled={!text.trim() || sent} onClick={() => { store.sendMessage("coach", text.trim()); setSent(true); }}>{sent ? `Sent to ${name}` : `Send to ${name}`}</button>
      </div>
    </section>
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
    ["Where and with what", a.equipment], ["Injuries or niggles", a.injuries], ["Diet", (a.diet ?? []).join(", ")], ["Allergies or foods to avoid", a.foodNotes ?? ""], ["A normal day", a.lifestyle],
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
