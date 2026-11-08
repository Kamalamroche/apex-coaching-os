import { FOODS, HERO_IMAGES, MEALS, dayTotals, lastMeal, localDate, parseNumber, recentFoods, weekNutrition, weekDaysOf, type FoodEntry, type Meal } from "@apex/core";
import { FuelGauge, Icons, MacroRings, MacroTable, ScriptTitle, WeekFuel } from "@apex/ui";
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
  // The day being looked at or logged: today by default, any day of this week from the strip.
  const [day, setDay] = useState(today);
  const [meal, setMeal] = useState<Meal>(mealNow);
  const [tab, setTab] = useState<"search" | "recent">("search");
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState(false);
  const [qa, setQa] = useState({ name: "", kcal: "", p: "", c: "", f: "" });
  const eaten = dayTotals(s.food, day);
  const t = s.targets;
  const days = weekDaysOf(today);
  const week = weekNutrition(s.food, days);
  const todays = s.food.filter((f) => f.day === day);
  const recent = recentFoods(s.food);
  const isToday = day === today;
  const dayName = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const hits = q ? FOODS.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())) : [];

  const add = (e: Omit<FoodEntry, "id" | "day" | "meal">) => store.addFood({ ...e, id: crypto.randomUUID(), day, meal });
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
      <div className="daystrip nut-days" role="tablist" aria-label="Day of the week">
        {days.map((d) => {
          const logged = s.food.some((f) => f.day === d);
          const future = d > today;
          return (
            <button key={d} type="button" role="tab" aria-selected={d === day} disabled={future}
              className={`day${d === today ? " today" : ""}${d === day ? " pick" : ""}${logged ? " logged" : ""}`} style={future ? { opacity: 0.45 } : undefined} onClick={() => setDay(d)}>
              <small>{new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2)}</small>
              <b>{Number(d.slice(8))}</b>
              <i />
            </button>
          );
        })}
      </div>
      <section className="fuelboard">
        <img className="fb-bg" src={HERO_IMAGES.meal.src} alt="" />
        <div className="fb-head">
          <span className="gpill caps">Nutrition · {isToday ? "today" : dayName(day)}</span>
          {t && eaten.kcal >= t.kcal * 0.9 && eaten.kcal <= t.kcal * 1.05 ? <ScriptTitle script="Right">on target</ScriptTitle> : <ScriptTitle script="Fuel">{isToday ? "for today" : `for ${new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" })}`}</ScriptTitle>}
        </div>
        {!t && <p className="fb-note">{coachName} hasn't set your targets yet. Log what you eat and they'll use it to set them.</p>}
        <div className="fb-glass">
          <FuelGauge eaten={eaten.kcal} target={t?.kcal ?? null} logs={todays.length} />
        </div>
        {t && (
          <MacroRings lines={[
            { label: "Protein", value: eaten.proteinG, target: t.proteinG, unit: "g", colour: "var(--viz-1)" },
            { label: "Carbs", value: eaten.carbsG, target: t.carbsG, unit: "g", colour: "var(--act)" },
            { label: "Fat", value: eaten.fatG, target: t.fatG, unit: "g", colour: "var(--viz-3)" },
          ]} />
        )}
        {t?.note && <div className="fb-glass fb-coach"><b>{coachName}:</b> {t.note}</div>}
      </section>

      {MEALS.map((m) => {
        const list = todays.filter((f) => f.meal === m.key);
        const kcal = list.reduce((a, f) => a + f.kcal, 0);
        const prev = list.length ? null : lastMeal(s.food, day, m.key);
        return (
          <section key={m.key}>
            <div className="sect"><h2 className="h2">{m.label}</h2><span className="tiny num">{kcal ? `${Math.round(kcal)} kcal` : ""}</span></div>
            <div className="card flat list">
              {list.map((f) => (
                <div key={f.id} className="li">
                  <div className="grow"><div className="h3">{f.name}</div><div className="tiny num">{Math.round(f.kcal)} kcal</div></div>
                  <div className="mpills" aria-label={`Protein ${f.proteinG} g, carbs ${f.carbsG} g, fat ${f.fatG} g`}>
                    <span className="mpill p">P {f.proteinG}</span><span className="mpill c">C {f.carbsG}</span><span className="mpill f">F {f.fatG}</span>
                  </div>
                  <button className="iconbtn" aria-label={`Remove ${f.name}`} onClick={() => store.removeFood(f.id)}><Icons.close width={16} height={16} /></button>
                </div>
              ))}
              {prev && (
                <div className="li nut-repeat">
                  <div className="grow"><div className="small" style={{ color: "var(--text)" }}>Same as {dayName(prev.day)}?</div><div className="tiny">{prev.items.map((f) => f.name).join(", ")} · <span className="num">{Math.round(prev.items.reduce((a, f) => a + f.kcal, 0))} kcal</span></div></div>
                  <button className="btn sm ghost" onClick={() => prev.items.forEach((f) => store.addFood({ ...f, id: crypto.randomUUID(), day }))}>Repeat</button>
                </div>
              )}
              <button className="li link" style={{ minHeight: 44 }} onClick={() => { setMeal(m.key); setTab("search"); setTimeout(() => document.getElementById("foodsearch")?.focus(), 0); }}>+ Add to {m.label.toLowerCase()}</button>
            </div>
          </section>
        );
      })}

      <section className="card stack">
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">Add food</h2>{!isToday && <span className="tiny">to {dayName(day)}</span>}</div>
        <div className="chips" role="group" aria-label="Meal">
          {MEALS.map((m) => <button key={m.key} className={`chip ${meal === m.key ? "on" : ""}`} aria-pressed={meal === m.key} onClick={() => setMeal(m.key)}>{m.label}</button>)}
        </div>
        {recent.length > 0 && (
          <div className="seg" role="tablist" aria-label="Find food">
            <button type="button" role="tab" aria-selected={tab === "search"} className={tab === "search" ? "on" : ""} onClick={() => setTab("search")}>Search</button>
            <button type="button" role="tab" aria-selected={tab === "recent"} className={tab === "recent" ? "on" : ""} onClick={() => setTab("recent")}>Recent</button>
          </div>
        )}
        {tab === "recent" && recent.length > 0 && (
          <div className="card flat list">
            {recent.map((f) => (
              <div key={f.name} className="li">
                <div className="grow"><div className="h3">{f.name}</div><div className="tiny num">{Math.round(f.kcal)} kcal · P {f.proteinG} · C {f.carbsG} · F {f.fatG}</div></div>
                <button className="iconbtn" aria-label={`Add ${f.name}`} onClick={() => add(f)}><Icons.plus width={18} height={18} /></button>
              </div>
            ))}
          </div>
        )}
        {(tab === "search" || recent.length === 0) && <input id="foodsearch" className="field" placeholder="Search common foods" value={q} onChange={(e) => setQ(e.target.value)} />}
        {(tab === "search" || recent.length === 0) && q && (
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

      {week.loggedDays > 0 && (
        <section>
          <div className="sect"><h2 className="h2">This week</h2><span className="tiny">{week.loggedDays} of 7 days logged</span></div>
          <div className="card stack">
            <WeekFuel days={week.days.map((d) => ({ day: d.day, kcal: d.totals.kcal, logged: d.logged }))} goal={t?.kcal ?? null} selected={day} onSelect={(d) => { if (d <= today) setDay(d); }} />
            <div className="wf-stats">
              <div><span className="tiny">Average a day</span><b>{week.avg.kcal.toLocaleString("en-GB")}</b></div>
              <div><span className="tiny">Daily goal</span><b>{t ? t.kcal.toLocaleString("en-GB") : "–"}</b></div>
              <div><span className="tiny">Week total</span><b>{Math.round(week.total.kcal).toLocaleString("en-GB")}</b></div>
            </div>
            <MacroTable avg={week.avg} total={week.total} goal={t} />
          </div>
        </section>
      )}
    </>
  );
}
