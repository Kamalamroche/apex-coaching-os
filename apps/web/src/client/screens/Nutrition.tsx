import { FOODS, MEALS, dayTotals, localDate, loggedAverage, parseNumber, type FoodEntry, type Meal } from "@apex/core";
import { Icons, MacroBars } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { LifestyleStatus } from "../../app/LifestyleParts";
import { useLifestyle, useLifestyleStore } from "../../data/LifestyleContext";

const mealNow = (): Meal => {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 15 ? "lunch" : h < 21 ? "dinner" : "snack";
};

/** The client's food log for today, against the targets the coach set. */
export function ClientNutrition() {
  const store = useLifestyleStore();
  const s = useLifestyle();
  const { coachName } = useAppInfo();
  const today = localDate(new Date());
  const [meal, setMeal] = useState<Meal>(mealNow);
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState(false);
  const [qa, setQa] = useState({ name: "", kcal: "", p: "", c: "", f: "" });
  const eaten = dayTotals(s.food, today);
  const t = s.targets;
  const week = loggedAverage(s.food, today);
  const todays = s.food.filter((f) => f.day === today);
  const hits = q ? FOODS.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())) : [];

  const add = (e: Omit<FoodEntry, "id" | "day" | "meal">) => store.addFood({ ...e, id: crypto.randomUUID(), day: today, meal });
  const qaKcal = parseNumber(qa.kcal);
  const addQuick = () => {
    if (!qa.name.trim() || qaKcal === null) return;
    add({ name: qa.name.trim(), kcal: qaKcal, proteinG: parseNumber(qa.p) ?? 0, carbsG: parseNumber(qa.c) ?? 0, fatG: parseNumber(qa.f) ?? 0 });
    setQa({ name: "", kcal: "", p: "", c: "", f: "" });
    setQuick(false);
  };

  if (s.status !== "ready") return <><div><div className="eyebrow">Nutrition</div><h1 className="h1">Food today</h1></div><LifestyleStatus state={s} /></>;
  return (
    <>
      <div>
        <div className="eyebrow">Nutrition · today</div>
        <h1 className="h1"><span className="num">{Math.round(eaten.kcal).toLocaleString()}</span>{t ? <> / <span className="num">{t.kcal.toLocaleString()}</span></> : null} kcal</h1>
        {!t && <p className="sub">{coachName} hasn't set your targets yet. Log what you eat and they'll use it to set them.</p>}
      </div>
      {t && (
        <div className="card stack">
          <MacroBars lines={[
            { label: "Protein", value: eaten.proteinG, target: t.proteinG, unit: "g", colour: "var(--viz-1)" },
            { label: "Carbs", value: eaten.carbsG, target: t.carbsG, unit: "g", colour: "var(--viz-2)" },
            { label: "Fat", value: eaten.fatG, target: t.fatG, unit: "g", colour: "var(--viz-3)" },
          ]} />
          {t.note && <div className="small" style={{ color: "var(--text)" }}><b>{coachName}:</b> {t.note}</div>}
        </div>
      )}

      {MEALS.map((m) => {
        const list = todays.filter((f) => f.meal === m.key);
        const kcal = list.reduce((a, f) => a + f.kcal, 0);
        return (
          <section key={m.key}>
            <div className="sect"><h2 className="h2">{m.label}</h2><span className="tiny num">{kcal ? `${Math.round(kcal)} kcal` : ""}</span></div>
            <div className="card flat list">
              {list.map((f) => (
                <div key={f.id} className="li">
                  <div className="grow"><div className="h3">{f.name}</div><div className="tiny num">P {f.proteinG} · C {f.carbsG} · F {f.fatG}</div></div>
                  <span className="num small">{Math.round(f.kcal)}</span>
                  <button className="iconbtn" aria-label={`Remove ${f.name}`} onClick={() => store.removeFood(f.id)}><Icons.close width={16} height={16} /></button>
                </div>
              ))}
              <button className="li link" style={{ minHeight: 44 }} onClick={() => { setMeal(m.key); document.getElementById("foodsearch")?.focus(); }}>+ Add to {m.label.toLowerCase()}</button>
            </div>
          </section>
        );
      })}

      <section className="card stack">
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">Add food</h2></div>
        <div className="chips" role="group" aria-label="Meal">
          {MEALS.map((m) => <button key={m.key} className={`chip ${meal === m.key ? "on" : ""}`} aria-pressed={meal === m.key} onClick={() => setMeal(m.key)}>{m.label}</button>)}
        </div>
        <input id="foodsearch" className="field" placeholder="Search common foods" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && (
          <div className="card flat list">
            {hits.length === 0 ? <div className="li small">Not in the list. Use quick add below.</div> : hits.map((f) => (
              <div key={f.id} className="li">
                <div className="grow"><div className="h3">{f.name}</div><div className="tiny num">{f.kcal} kcal · P {f.protein} · C {f.carbs} · F {f.fat}</div></div>
                <button className="btn sm act" onClick={() => { add({ name: f.name, kcal: f.kcal, proteinG: f.protein, carbsG: f.carbs, fatG: f.fat }); setQ(""); }}>Add</button>
              </div>
            ))}
          </div>
        )}
        {quick ? (
          <div className="stack" style={{ gap: 10 }}>
            <input id="qa-name" className="field" placeholder="What did you eat?" maxLength={120} value={qa.name} onChange={(e) => setQa({ ...qa, name: e.target.value })} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
              {([["kcal", "kcal"], ["p", "Protein g"], ["c", "Carbs g"], ["f", "Fat g"]] as const).map(([k, l]) => (
                <label key={k} className="tiny" style={{ display: "flex", flexDirection: "column", gap: 4 }}>{l}<input id={`qa-${k}`} className="field num" inputMode="decimal" value={qa[k]} onChange={(e) => setQa({ ...qa, [k]: e.target.value })} /></label>
              ))}
            </div>
            <button className="btn act block" disabled={!qa.name.trim() || qaKcal === null} onClick={addQuick}>Add to {MEALS.find((m) => m.key === meal)?.label.toLowerCase()}</button>
          </div>
        ) : (
          <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => setQuick(true)}>+ Quick add calories and macros</button>
        )}
      </section>

      {week.days > 1 && (
        <div className="card small">
          Last 7 days: <span className="num" style={{ color: "var(--text)", fontWeight: 700 }}>{week.avg.kcal.toLocaleString()} kcal</span> and <span className="num" style={{ color: "var(--text)", fontWeight: 700 }}>{week.avg.proteinG} g protein</span> a day on average, over {week.days} days logged.
        </div>
      )}
    </>
  );
}
