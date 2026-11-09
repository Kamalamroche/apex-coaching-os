import { FOODS, HERO_IMAGES, MEALS, addDays, parseMeal, dayTotals, lastMeal, localDate, loggingStreak, macroSplit, parseNumber, recentFoods, scalePortion, searchFoods, weekNutrition, weekDaysOf, targetsFor, workoutOn, type Food, type FoodEntry, type Meal, type MealItem, type Recipe, planItemFromRecipe } from "@apex/core";
import { FuelGauge, Icons, MacroRings, MacroTable, ScriptTitle, WeekFuel } from "@apex/ui";
import { useState } from "react";
import { useApexState } from "@apex/core/react";
import { ClientPlan, RecipeSheet, RecipeShelf, WorkoutFuelCard } from "../../app/MealPlanParts";
import { useStore } from "../../data/StoreContext";
import { BarcodeScan } from "./BarcodeScan";
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
  const [tab, setTab] = useState<"search" | "recent" | "describe">("search");
  const [said, setSaid] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [scan, setScan] = useState(false);
  // The food picked from the list, waiting for its amount.
  const [pick, setPick] = useState<{ food: Food; portions: number } | null>(null);
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState(false);
  const [qa, setQa] = useState({ name: "", kcal: "", p: "", c: "", f: "" });
  const { program, workout } = useApexState(useStore());
  const eaten = dayTotals(s.food, day);
  // Training day or rest day, from the client's program for this week.
  const session = workoutOn(program, workout.week, day);
  const hasProgram = program.days.length > 0;
  const t = s.targets ? targetsFor(s.targets, !!session) : null;
  const days = weekDaysOf(today);
  const week = weekNutrition(s.food, days);
  const todays = s.food.filter((f) => f.day === day);
  const recent = recentFoods(s.food);
  const isToday = day === today;
  const dayName = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const hits = searchFoods(FOODS, q);
  const streak = loggingStreak(s.food, today);
  const yesterdayFood = todays.length ? [] : s.food.filter((f) => f.day === addDays(day, -1));
  const split = macroSplit(eaten);
  const planSplit = t ? macroSplit(t) : null;

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
          <div className="gpills"><span className="gpill caps">Nutrition · {isToday ? "today" : dayName(day)}</span>{hasProgram && <span className="gpill dim">{session ? <><Icons.train />Training day</> : <><Icons.sleep />Rest day</>}</span>}{streak > 1 && <span className="gpill dim"><Icons.flame />{streak} days logged</span>}</div>
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
        {t?.kind === "rest" && <p className="fb-note">Rest day targets from {coachName}: fewer carbs, same protein.</p>}
        {t?.note && <div className="fb-glass fb-coach"><b>{coachName}:</b> {t.note}</div>}
      </section>

      {t && (
        <div className="card nut-sum" aria-label={`Goal ${t.kcal} minus food ${Math.round(eaten.kcal)} equals ${t.kcal - Math.round(eaten.kcal)} kcal left`}>
          <div><b className="num">{t.kcal.toLocaleString("en-GB")}</b><span className="tiny">Goal</span></div>
          <span className="nut-op">−</span>
          <div><b className="num">{Math.round(eaten.kcal).toLocaleString("en-GB")}</b><span className="tiny">Food</span></div>
          <span className="nut-op">=</span>
          <div className={t.kcal - eaten.kcal < 0 ? "over" : "left"}><b className="num">{Math.abs(Math.round(t.kcal - eaten.kcal)).toLocaleString("en-GB")}</b><span className="tiny">{t.kcal - eaten.kcal < 0 ? "Over" : "Left"}</span></div>
        </div>
      )}

      {split && (
        <section className="card stack" style={{ gap: 10 }}>
          <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Where your calories come from</h3><span className="tiny">{isToday ? "Today" : dayName(day)}</span></div>
          <SplitBar label="Eaten" s={split} />
          {planSplit && <SplitBar label="Plan" s={planSplit} muted />}
          <div className="rc-legend tiny"><span><i style={{ background: "var(--viz-1)" }} />Protein</span><span><i style={{ background: "var(--act)" }} />Carbs</span><span><i style={{ background: "var(--viz-3)" }} />Fat</span></div>
        </section>
      )}

      {s.mealPlan && s.mealPlan.days.length > 0 && (
        <ClientPlan key={`${day}-${!!session}`} plan={s.mealPlan} food={s.food} day={day} coachName={coachName} training={hasProgram ? !!session : null}
          onLog={(m, items) => items.forEach((i) => store.addFood({ id: crypto.randomUUID(), day, meal: m, name: i.name, kcal: i.kcal, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG }))} />
      )}

      {session && day >= today && (
        <WorkoutFuelCard session={session.name} seed={Number(day.slice(8))} diet={s.intake?.answers.diet ?? []} notes={s.intake?.answers.foodNotes ?? ""} onOpen={setRecipe} />
      )}

      {yesterdayFood.length > 0 && (
        <div className="card nut-repeat">
          <div className="grow"><div className="h3">Same day as {dayName(addDays(day, -1))}?</div><div className="tiny">{yesterdayFood.length} foods · <span className="num">{Math.round(yesterdayFood.reduce((a, f) => a + f.kcal, 0)).toLocaleString("en-GB")} kcal</span></div></div>
          <button className="btn sm ghost" onClick={() => yesterdayFood.forEach((f) => store.addFood({ ...f, id: crypto.randomUUID(), day }))}>Copy day</button>
        </div>
      )}

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
        <div className="seg" role="tablist" aria-label="Find food">
          <button type="button" role="tab" aria-selected={tab === "search"} className={tab === "search" ? "on" : ""} onClick={() => setTab("search")}>Search</button>
          {recent.length > 0 && <button type="button" role="tab" aria-selected={tab === "recent"} className={tab === "recent" ? "on" : ""} onClick={() => setTab("recent")}>Recent</button>}
          <button type="button" role="tab" aria-selected={tab === "describe"} className={tab === "describe" ? "on" : ""} onClick={() => { setTab("describe"); setTimeout(() => document.getElementById("mealtext")?.focus(), 0); }}>Describe</button>
        </div>
        {tab === "describe" && <DescribeMeal text={said} setText={setSaid} mealLabel={MEALS.find((m) => m.key === meal)?.label.toLowerCase() ?? ""}
          onAdd={(items) => { items.forEach((i) => add({ name: i.name, kcal: i.kcal, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG })); setSaid(""); }} />}
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
        {(tab === "search" || (tab === "recent" && recent.length === 0)) && (
          <div className="row" style={{ gap: 8 }}>
            <input id="foodsearch" className="field" style={{ flex: 1 }} placeholder="Search common foods" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="button" className="iconbtn nut-scan" aria-label="Scan a barcode" onClick={() => setScan(true)}><Icons.scan width={20} height={20} /></button>
          </div>
        )}
        {scan && <BarcodeScan onClose={() => setScan(false)}
          onFound={(f) => { setScan(false); setTab("search"); setPick({ food: f, portions: 1 }); }}
          onQuickAdd={() => { setScan(false); setQuick(true); }} />}
        {(tab === "search" || (tab === "recent" && recent.length === 0)) && q && (
          <div className="card flat list">
            {hits.length === 0 ? <div className="li small">Not in the list. Use quick add below.</div> : hits.map((f) => (
              <div key={f.id} className="li">
                <div className="grow"><div className="h3">{f.name}</div><div className="tiny num">{f.kcal} kcal · P {f.protein} · C {f.carbs} · F {f.fat}</div></div>
                <button className="btn sm act" onClick={() => setPick({ food: f, portions: 1 })}>Add</button>
              </div>
            ))}
          </div>
        )}
        {pick && <AmountPicker key={pick.food.id} food={pick.food} mealLabel={MEALS.find((m) => m.key === meal)?.label.toLowerCase() ?? ""}
          onCancel={() => setPick(null)}
          onAdd={(portions) => {
            const base = { kcal: pick.food.kcal, proteinG: pick.food.protein, carbsG: pick.food.carbs, fatG: pick.food.fat };
            const grams = pick.food.grams ? Math.round(pick.food.grams * portions) : null;
            const name = portions === 1 ? pick.food.name : grams ? `${pick.food.name.replace(/,\s*[^,]*$/, "")}, ${grams} ${/ml\b/.test(pick.food.name) ? "ml" : "g"}` : `${pick.food.name} × ${portions}`;
            add({ name, ...scalePortion(base, portions) });
            setPick(null); setQ("");
          }} />}
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

      <RecipeShelf key={(s.intake?.answers.diet ?? []).join()} diet={s.intake?.answers.diet ?? []} foodNotes={s.intake?.answers.foodNotes ?? ""} onOpen={setRecipe} />
      {recipe && <RecipeSheet r={recipe} foodNotes={s.intake?.answers.foodNotes ?? ""} onClose={() => setRecipe(null)} action={{
        label: `Log to ${MEALS.find((m) => m.key === recipe.meal)?.label.toLowerCase()}${isToday ? "" : `, ${dayName(day)}`}`,
        run: () => { const i = planItemFromRecipe(recipe); store.addFood({ id: crypto.randomUUID(), day, meal: recipe.meal, name: i.name, kcal: i.kcal, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG }); },
      }} />}

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

/** One stacked bar: the share of calories from protein, carbs and fat. */
/** Type a meal in plain words; the foods it finds can be checked, removed, then added in one go. */
function DescribeMeal({ text, setText, mealLabel, onAdd }: { text: string; setText: (v: string) => void; mealLabel: string; onAdd: (items: MealItem[]) => void }) {
  const [dropped, setDropped] = useState<number[]>([]);
  const parsed = parseMeal(text, FOODS);
  const items = parsed.items.filter((_, i) => !dropped.includes(i));
  const total = items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.proteinG, c: a.c + i.carbsG, f: a.f + i.fatG }), { kcal: 0, p: 0, c: 0, f: 0 });
  const r = (v: number) => Math.round(v);
  return (
    <div className="stack nut-say" style={{ gap: 10 }}>
      <textarea id="mealtext" className="field" rows={2} maxLength={400} placeholder="e.g. 2 eggs, 2 slices of toast and a banana" value={text}
        onChange={(e) => { setText(e.target.value); setDropped([]); }} />
      {parsed.items.length > 0 && (
        <div className="card flat list">
          {parsed.items.map((i, n) => dropped.includes(n) ? null : (
            <div key={`${n}-${i.food.id}`} className="li nut-say-item">
              <div className="grow"><div className="h3">{i.name}</div><div className="tiny num">{i.kcal} kcal · P {i.proteinG} · C {i.carbsG} · F {i.fatG}</div>{i.guess && <div className="tiny" style={{ color: "var(--warn)" }}>Best guess for “{i.text}”</div>}</div>
              <button className="iconbtn" aria-label={`Remove ${i.name}`} onClick={() => setDropped([...dropped, n])}><Icons.close width={16} height={16} /></button>
            </div>
          ))}
        </div>
      )}
      {parsed.unmatched.length > 0 && <div className="tiny" style={{ color: "var(--warn)" }}>Not found: {parsed.unmatched.join(", ")}. Try Search or quick add.</div>}
      {items.length > 0 && <div className="tiny">Typical values. Total <b className="num" style={{ color: "var(--text)" }}>{r(total.kcal)} kcal</b> · <span className="num">P {r(total.p)} · C {r(total.c)} · F {r(total.f)}</span></div>}
      <button className="btn act block" disabled={!items.length} onClick={() => onAdd(items)}>{items.length > 1 ? `Add ${items.length} foods to ${mealLabel}` : `Add to ${mealLabel}`}</button>
    </div>
  );
}

function SplitBar({ label, s, muted = false }: { label: string; s: { protein: number; carbs: number; fat: number }; muted?: boolean }) {
  return (
    <div className="nut-split">
      <span className="tiny">{label}</span>
      <div className="nut-split-bar" style={muted ? { opacity: 0.55 } : undefined} role="img" aria-label={`${label}: protein ${s.protein}%, carbs ${s.carbs}%, fat ${s.fat}%`}>
        <i style={{ flexGrow: s.protein, background: "var(--viz-1)" }}>{s.protein >= 12 && `${s.protein}%`}</i>
        <i style={{ flexGrow: s.carbs, background: "var(--act)" }}>{s.carbs >= 12 && `${s.carbs}%`}</i>
        <i style={{ flexGrow: s.fat, background: "var(--viz-3)" }}>{s.fat >= 12 && `${s.fat}%`}</i>
      </div>
    </div>
  );
}

/** Choose how much before adding: portions in half steps, or grams when the portion weight is known. Macros update as you go. */
function AmountPicker({ food, mealLabel, onAdd, onCancel }: { food: Food; mealLabel: string; onAdd: (portions: number) => void; onCancel: () => void }) {
  const [portions, setPortions] = useState(1);
  const [grams, setGrams] = useState(food.grams ? String(food.grams) : "");
  const unit = / ml\b/.test(food.name) ? "ml" : "g";
  const set = (p: number) => { const v = Math.max(0.25, Math.min(10, Math.round(p * 4) / 4)); setPortions(v); if (food.grams) setGrams(String(Math.round(food.grams * v))); };
  const fromGrams = (txt: string) => { setGrams(txt); const g = parseNumber(txt); if (food.grams && g !== null && g > 0) setPortions(Math.min(20, g / food.grams)); };
  const m = scalePortion({ kcal: food.kcal, proteinG: food.protein, carbsG: food.carbs, fatG: food.fat }, portions);
  return (
    <div className="card nut-amount">
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">{food.name}</h3><button className="iconbtn" aria-label="Cancel" onClick={onCancel}><Icons.close width={16} height={16} /></button></div>
      <div className="nut-amount-row">
        <div className="nut-step" role="group" aria-label="Portions">
          <button type="button" aria-label="Less" onClick={() => set(portions - 0.5)}>−</button>
          <b className="num">{Number.isInteger(portions) ? portions : portions.toFixed(2).replace(/0$/, "")}</b>
          <button type="button" aria-label="More" onClick={() => set(portions + 0.5)}>+</button>
        </div>
        <span className="tiny">portion{portions === 1 ? "" : "s"}</span>
        {food.grams ? <label className="tiny nut-grams">or <input className="field num" inputMode="decimal" value={grams} onChange={(e) => fromGrams(e.target.value)} aria-label={`Amount in ${unit}`} /> {unit}</label> : null}
      </div>
      <div className="nut-amount-macros num">
        <span><b>{m.kcal}</b> kcal</span><span>P <b>{m.proteinG}</b></span><span>C <b>{m.carbsG}</b></span><span>F <b>{m.fatG}</b></span>
      </div>
      <button className="btn act block" onClick={() => onAdd(portions)}>Add to {mealLabel}</button>
    </div>
  );
}
