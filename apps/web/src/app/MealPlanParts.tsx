import {
  FOODS, MAX_PLAN_DAYS, MAX_RECIPE_STEPS, MEALS, RECIPES, filterRecipes, newCoachRecipe, recipeProblem, mealLogged, mealTotals, newPlanDay, planDayTotals, planItemFromFood, planItemFromRecipe, recipeById, recipeMacros, recipePhoto, sampleMealPlan, searchFoods, shoppingList,
  type FoodEntry, type Meal, type MealPlan, type NutritionTargets, type PlanItem, type Recipe, type RecipeTag,
} from "@apex/core";
import { Icons, Label, Sheet } from "@apex/ui";
import { useRef, useState } from "react";
import { recipePhotoFromFile, useCoachRecipes } from "../data/coachRecipes";

const TAGS: RecipeTag[] = ["High protein", "Under 15 min", "Vegetarian", "Vegan", "Gluten free", "Dairy free", "Batch cook"];
const MEAL_TONE: Record<Meal, string> = { breakfast: "var(--viz-2)", lunch: "var(--viz-1)", dinner: "var(--act)", snack: "var(--viz-3)" };
const mealLabel = (m: Meal) => MEALS.find((x) => x.key === m)?.label ?? m;
const r0 = (v: number) => Math.round(v);

/* ---------- Recipes ---------- */

/** The recipe's photo, or a plain tile with the meal colour when a coach recipe has none. */
function RecipeImg({ r, small = false, className }: { r: Recipe; small?: boolean; className?: string }) {
  const src = recipePhoto(r, small);
  return src
    ? <img className={className} src={src} alt="" loading={small ? "lazy" : undefined} decoding="async" />
    : <span className={`rcp-noimg ${className ?? ""}`} aria-hidden="true"><Icons.food width={small ? 22 : 30} height={small ? 22 : 30} /></span>;
}

export function RecipeCard({ r, onOpen }: { r: Recipe; onOpen: (r: Recipe) => void }) {
  const m = recipeMacros(r);
  return (
    <button type="button" className="rcp-card" style={{ ["--tone" as string]: MEAL_TONE[r.meal] }} onClick={() => onOpen(r)}>
      <span className="rcp-photo"><RecipeImg r={r} small /><span className="rcp-time tiny"><Icons.clock width={12} height={12} /> {r.minutes} min</span></span>
      <span className="rcp-body">
        <span className="tiny caps rcp-meal">{mealLabel(r.meal)}{r.byCoach && <span className="rcp-mine"> · Your coach</span>}</span>
        <b className="rcp-name">{r.name}</b>
        <span className="rcp-nums"><span><b className="num">{m.kcal}</b> kcal</span><span><b className="num">{m.proteinG}</b> g protein</span></span>
      </span>
    </button>
  );
}

/** The recipe library: filter chips and a scrolling shelf of cards. */
export function RecipeShelf({ onOpen }: { onOpen: (r: Recipe) => void }) {
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [meal, setMeal] = useState<Meal | null>(null);
  const { recipes: coach } = useCoachRecipes();
  const list = filterRecipes(tags, meal ?? undefined, coach);
  return (
    <section>
      <div className="sect"><h2 className="h2">Recipes</h2><span className="tiny">{list.length} of {RECIPES.length + coach.length}</span></div>
      <div className="seg rcp-meals" role="radiogroup" aria-label="Meal">
        {[null, ...MEALS.map((m) => m.key)].map((k) => <button key={k ?? "all"} type="button" role="radio" aria-checked={meal === k} className={meal === k ? "on" : ""} onClick={() => setMeal(k)}>{k ? mealLabel(k) : "All"}</button>)}
      </div>
      <div className="chips rcp-tags" role="group" aria-label="Filter recipes">
        {TAGS.map((t) => <button key={t} className={`chip ${tags.includes(t) ? "on" : ""}`} aria-pressed={tags.includes(t)} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>{t}</button>)}
      </div>
      {list.length ? (
        <div className="rcp-shelf">{list.map((r) => <RecipeCard key={r.id} r={r} onOpen={onOpen} />)}</div>
      ) : <div className="card small">No recipe has all of those. Take a filter off.</div>}
    </section>
  );
}

export function RecipeSheet({ r, onClose, action }: { r: Recipe; onClose: () => void; action?: { label: string; run: () => void } }) {
  const m = recipeMacros(r);
  return (
    <Sheet label={r.name} onClose={onClose}>
      <div className="stack rcp-sheet" style={{ gap: 14 }}>
        <div className="rcp-hero" style={{ ["--tone" as string]: MEAL_TONE[r.meal] }}>
          <RecipeImg r={r} className="rcp-hero-img" />
          <span className="tiny caps">{mealLabel(r.meal)} · {r.minutes} min · 1 serving{r.byCoach ? " · Your coach's recipe" : ""}</span>
          <h2 className="h1" style={{ margin: 0 }}>{r.name}</h2>
          <div className="rcp-macros">
            <div><b className="num">{m.kcal}</b><span className="tiny">kcal</span></div>
            <div><b className="num">{m.proteinG}</b><span className="tiny">Protein g</span></div>
            <div><b className="num">{m.carbsG}</b><span className="tiny">Carbs g</span></div>
            <div><b className="num">{m.fatG}</b><span className="tiny">Fat g</span></div>
          </div>
        </div>
        <div className="chips">{r.tags.map((t) => <span key={t} className="chip" style={{ cursor: "default" }}>{t}</span>)}</div>
        <div>
          <h3 className="h3">Ingredients</h3>
          <ul className="rcp-ing">
            {r.ingredients.map((i) => {
              const f = FOODS.find((x) => x.id === i.foodId);
              return f ? <li key={i.foodId}><span>{f.name}</span><span className="num tiny">{i.factor === 1 ? "" : `× ${i.factor}`}</span></li> : null;
            })}
          </ul>
        </div>
        <div>
          <h3 className="h3">Method</h3>
          <ol className="rcp-steps">{r.steps.map((s, n) => <li key={n}>{s}</li>)}</ol>
        </div>
        {action && <button className="btn act block" onClick={() => { action.run(); onClose(); }}>{action.label}</button>}
      </div>
    </Sheet>
  );
}

/* ---------- Shopping list ---------- */

const SHOP_KEY = "apex.shopTicks";
function readTicks(): string[] {
  try { return JSON.parse(localStorage.getItem(SHOP_KEY) ?? "[]") as string[]; } catch { return []; }
}

export function ShoppingSheet({ plan, onClose, recipes = [] }: { plan: MealPlan; onClose: () => void; recipes?: Recipe[] }) {
  const [days, setDays] = useState(7);
  const [ticks, setTicks] = useState<string[]>(readTicks);
  const list = shoppingList(plan, days, recipes);
  const toggle = (k: string) => {
    const next = ticks.includes(k) ? ticks.filter((x) => x !== k) : [...ticks, k];
    setTicks(next);
    try { localStorage.setItem(SHOP_KEY, JSON.stringify(next)); } catch { /* fine */ }
  };
  const groups = [...new Set(list.map((l) => l.group))];
  const done = list.filter((l) => ticks.includes(l.key)).length;
  return (
    <Sheet label="Shopping list" onClose={onClose}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">Shopping list</h2><span className="tiny num">{done} of {list.length}</span></div>
        <div className="seg" role="radiogroup" aria-label="How many days">
          {[3, 7].map((d) => <button key={d} type="button" role="radio" aria-checked={days === d} className={days === d ? "on" : ""} onClick={() => setDays(d)}>{d} days</button>)}
        </div>
        {groups.map((g) => (
          <div key={g}>
            <div className="tiny caps" style={{ margin: "6px 0" }}>{g}</div>
            <div className="card flat list">
              {list.filter((l) => l.group === g).map((l) => (
                <label key={l.key} className={`li shop-li${ticks.includes(l.key) ? " got" : ""}`}>
                  <input type="checkbox" checked={ticks.includes(l.key)} onChange={() => toggle(l.key)} />
                  <span className="grow">{l.name}</span><span className="num small">{l.amount}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {done > 0 && <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => { setTicks([]); try { localStorage.removeItem(SHOP_KEY); } catch { /* fine */ } }}>Untick everything</button>}
      </div>
    </Sheet>
  );
}

/* ---------- Client: today's plan ---------- */

export function ClientPlan({ plan, food, day, coachName, onLog }: { plan: MealPlan; food: FoodEntry[]; day: string; coachName: string; onLog: (meal: Meal, items: PlanItem[]) => void }) {
  const [dayId, setDayId] = useState(plan.days[0]?.id ?? "");
  const [shop, setShop] = useState(false);
  const [open, setOpen] = useState<Recipe | null>(null);
  const { recipes: coach } = useCoachRecipes();
  const d = plan.days.find((x) => x.id === dayId) ?? plan.days[0];
  if (!d) return null;
  const total = planDayTotals(d);
  return (
    <section>
      <div className="sect"><h2 className="h2">Your plan</h2><Label kind="dec">Coach decision</Label></div>
      <div className="card stack plan-card">
        {plan.days.length > 1 && (
          <div className="seg" role="tablist" aria-label="Plan day">
            {plan.days.map((x) => <button key={x.id} type="button" role="tab" aria-selected={x.id === d.id} className={x.id === d.id ? "on" : ""} onClick={() => setDayId(x.id)}>{x.name}</button>)}
          </div>
        )}
        <div className="plan-total tiny"><span><b className="num">{r0(total.kcal).toLocaleString("en-GB")}</b> kcal</span><span>P <b className="num">{r0(total.proteinG)}</b></span><span>C <b className="num">{r0(total.carbsG)}</b></span><span>F <b className="num">{r0(total.fatG)}</b></span></div>
        {MEALS.map((m) => {
          const items = d.meals[m.key];
          if (!items.length) return null;
          const logged = mealLogged(food, day, m.key, items);
          return (
            <div key={m.key} className={`plan-meal${logged ? " done" : ""}`} style={{ ["--tone" as string]: MEAL_TONE[m.key] }}>
              <div className="plan-meal-head"><span className="tiny caps">{m.label}</span><span className="tiny num">{r0(mealTotals(items).kcal)} kcal</span></div>
              {items.map((i) => {
                const r = i.recipeId ? recipeById(i.recipeId, coach) : undefined;
                return r
                  ? <button key={i.id} type="button" className="plan-item link-like" onClick={() => setOpen(r)}><RecipeImg r={r} small className="plan-thumb" />{i.name}<Icons.forward width={14} height={14} /></button>
                  : <div key={i.id} className="plan-item">{i.name}</div>;
              })}
              <button className={`btn sm ${logged ? "ghost" : "act"} plan-log`} disabled={logged} onClick={() => onLog(m.key, items)}>
                {logged ? <><Icons.check width={14} height={14} /> Logged</> : "Ate as planned"}
              </button>
            </div>
          );
        })}
        {plan.note && <div className="small"><b>{coachName}:</b> {plan.note}</div>}
        <button className="btn block" onClick={() => setShop(true)}><Icons.note width={16} height={16} /> Shopping list</button>
      </div>
      {shop && <ShoppingSheet plan={plan} recipes={coach} onClose={() => setShop(false)} />}
      {open && <RecipeSheet r={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

/* ---------- Coach: write the plan ---------- */

type Hit = { kind: "recipe"; r: Recipe } | { kind: "food"; f: (typeof FOODS)[number] };

export function CoachPlanEditor({ plan, targets, name, onSave }: { plan: MealPlan | null; targets: NutritionTargets | null; name: string; onSave: (p: MealPlan | null) => void }) {
  const [draft, setDraft] = useState<MealPlan | null>(plan);
  const [dayId, setDayId] = useState(plan?.days[0]?.id ?? "");
  const [adding, setAdding] = useState<Meal | null>(null);
  const [q, setQ] = useState("");
  const [amount, setAmount] = useState(1);
  const [library, setLibrary] = useState(false);
  const { recipes: coach, api: recipeApi, reload } = useCoachRecipes();
  const changed = JSON.stringify(draft) !== JSON.stringify(plan);
  const librarySheet = library && recipeApi ? <CoachRecipesSheet recipes={coach} api={recipeApi} onChanged={reload} onClose={() => setLibrary(false)} /> : null;

  if (!draft) {
    return (
      <section className="card stack">
        <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Meal plan</h3><Label kind="dec">Coach decision</Label></div>
        <div className="small">Give {name} a plan to follow: they tick meals off in one tap and get a shopping list.</div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn act" onClick={() => { const p = sampleMealPlan(); setDraft(p); setDayId(p.days[0]!.id); }}>Start from APEX starter plan</button>
          <button className="btn" onClick={() => { const d = newPlanDay(0); setDraft({ days: [d], note: "", updatedAt: new Date().toISOString() }); setDayId(d.id); }}>Blank plan</button>
        </div>
        {recipeApi && <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => setLibrary(true)}>My recipes ({coach.length})</button>}
        {librarySheet}
      </section>
    );
  }

  const d = draft.days.find((x) => x.id === dayId) ?? draft.days[0]!;
  const total = planDayTotals(d);
  const setDay = (meals: typeof d.meals, nameText = d.name) => setDraft({ ...draft, days: draft.days.map((x) => (x.id === d.id ? { ...x, meals, name: nameText } : x)) });
  const ql = q.trim().toLowerCase();
  const hits: Hit[] = ql
    ? [...[...coach, ...RECIPES].filter((r) => r.name.toLowerCase().includes(ql) || r.tags.some((t) => t.toLowerCase().includes(ql))).sort((a, b) => Number(b.meal === adding) - Number(a.meal === adding)).slice(0, 4).map((r) => ({ kind: "recipe" as const, r })), ...searchFoods(FOODS, q, 6).map((f) => ({ kind: "food" as const, f }))]
    : adding ? filterRecipes([], adding, coach).map((r) => ({ kind: "recipe" as const, r })) : [];
  const add = (h: Hit) => {
    if (!adding) return;
    const item = h.kind === "recipe" ? planItemFromRecipe(h.r, amount) : planItemFromFood(h.f, amount);
    setDay({ ...d.meals, [adding]: [...d.meals[adding], item] });
    setQ(""); setAmount(1);
  };
  const diff = (v: number, t?: number) => <><b>{r0(v).toLocaleString("en-GB")}</b>{t ? <span className="of"> / {t.toLocaleString("en-GB")}</span> : null}</>;

  return (
    <section className="card stack">
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Meal plan</h3><Label kind="dec">Coach decision</Label></div>
      {recipeApi && <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => setLibrary(true)}>My recipes ({coach.length})</button>}
      {librarySheet}
      <div className="chips" role="tablist" aria-label="Plan days">
        {draft.days.map((x) => <button key={x.id} role="tab" aria-selected={x.id === d.id} className={`chip ${x.id === d.id ? "on" : ""}`} onClick={() => { setDayId(x.id); setAdding(null); }}>{x.name}</button>)}
        {draft.days.length < MAX_PLAN_DAYS && <button className="chip" onClick={() => { const nd = newPlanDay(draft.days.length); setDraft({ ...draft, days: [...draft.days, nd] }); setDayId(nd.id); }}><Icons.plus width={13} height={13} /> Day</button>}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input id="plan-day-name" className="field" style={{ flex: 1 }} maxLength={40} value={d.name} aria-label="Day name" onChange={(e) => setDay(d.meals, e.target.value)} />
        {draft.days.length > 1 && <button className="iconbtn" aria-label={`Remove ${d.name}`} onClick={() => { const days = draft.days.filter((x) => x.id !== d.id); setDraft({ ...draft, days }); setDayId(days[0]!.id); }}><Icons.trash width={16} height={16} /></button>}
      </div>
      <div className={`plan-total tiny${targets && Math.abs(total.kcal - targets.kcal) > targets.kcal * 0.1 ? " off" : ""}`}>
        <span>{diff(total.kcal, targets?.kcal)} kcal</span><span>P {diff(total.proteinG, targets?.proteinG)}</span><span>C {diff(total.carbsG, targets?.carbsG)}</span><span>F {diff(total.fatG, targets?.fatG)}</span>
      </div>
      {MEALS.map((m) => (
        <div key={m.key} className="plan-meal" style={{ ["--tone" as string]: MEAL_TONE[m.key] }}>
          <div className="plan-meal-head"><span className="tiny caps">{m.label}</span><span className="tiny num">{r0(mealTotals(d.meals[m.key]).kcal)} kcal</span></div>
          {d.meals[m.key].map((i) => (
            <div key={i.id} className="plan-item row" style={{ gap: 6 }}>
              <span className="grow">{i.name}</span><span className="tiny num">{r0(i.kcal)}</span>
              <button className="iconbtn" aria-label={`Remove ${i.name}`} onClick={() => setDay({ ...d.meals, [m.key]: d.meals[m.key].filter((x) => x.id !== i.id) })}><Icons.close width={14} height={14} /></button>
            </div>
          ))}
          {adding === m.key ? (
            <div className="stack plan-add" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 6 }}>
                <input id="plan-search" className="field" style={{ flex: 1 }} autoFocus placeholder="Recipe or food" value={q} onChange={(e) => setQ(e.target.value)} />
                <div className="nut-step" role="group" aria-label="Amount">
                  <button type="button" aria-label="Less" onClick={() => setAmount(Math.max(0.5, amount - 0.5))}>−</button><b className="num">{amount}</b><button type="button" aria-label="More" onClick={() => setAmount(Math.min(10, amount + 0.5))}>+</button>
                </div>
              </div>
              <div className="card flat list">
                {hits.length ? hits.map((h) => {
                  const label = h.kind === "recipe" ? h.r.name : h.f.name;
                  const kcal = h.kind === "recipe" ? recipeMacros(h.r).kcal : h.f.kcal;
                  return (
                    <button key={h.kind === "recipe" ? h.r.id : `f${h.f.id}`} type="button" className="li plan-hit" onClick={() => add(h)}>
                      <span className="grow" style={{ textAlign: "left" }}>{label}{h.kind === "recipe" && <span className="tiny"> · Recipe</span>}</span><span className="tiny num">{r0(kcal * amount)} kcal</span><Icons.plus width={15} height={15} />
                    </button>
                  );
                }) : <div className="li small">Nothing matches. Try another word.</div>}
              </div>
              <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => { setAdding(null); setQ(""); }}>Done</button>
            </div>
          ) : <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => { setAdding(m.key); setQ(""); setAmount(1); }}>+ Add to {m.label.toLowerCase()}</button>}
        </div>
      ))}
      <input id="plan-note" className="field" maxLength={500} placeholder={`A note for ${name}, e.g. swap any dinner for a recipe you like`} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
      <button className="btn act block" disabled={!changed} onClick={() => onSave({ ...draft, updatedAt: new Date().toISOString() })}>{plan ? "Save plan" : `Send plan to ${name}`}</button>
      {plan && <button className="link" style={{ alignSelf: "flex-start", color: "var(--crit)" }} onClick={() => { if (confirm(`Remove ${name}'s meal plan?`)) { onSave(null); setDraft(null); } }}>Remove plan</button>}
      {!plan && <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => setDraft(null)}>Cancel</button>}
    </section>
  );
}

/* ---------- Coach: their own recipes ---------- */

function CoachRecipesSheet({ recipes, api, onChanged, onClose }: { recipes: Recipe[]; api: NonNullable<ReturnType<typeof useCoachRecipes>["api"]>; onChanged: () => void; onClose: () => void }) {
  const [edit, setEdit] = useState<Recipe | null>(null);
  if (edit) return <RecipeEditor key={edit.id} start={edit} isNew={!recipes.some((r) => r.id === edit.id)} api={api} onDone={() => { setEdit(null); onChanged(); }} onClose={onClose} />;
  return (
    <Sheet label="My recipes" onClose={onClose}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">My recipes</h2><button className="iconbtn" aria-label="Close" onClick={onClose}><Icons.close width={16} height={16} /></button></div>
        <div className="small">Your own recipes sit next to the APEX library. Your clients see them, and you can put them in any meal plan.</div>
        <button className="btn act" onClick={() => setEdit(newCoachRecipe())}><Icons.plus width={16} height={16} /> New recipe</button>
        {recipes.length ? (
          <div className="card flat list">
            {recipes.map((r) => (
              <button key={r.id} type="button" className="li plan-hit" onClick={() => setEdit(r)}>
                <RecipeImg r={r} small className="plan-thumb" />
                <span className="grow" style={{ textAlign: "left" }}>{r.name}<span className="tiny"> · {mealLabel(r.meal)}</span></span>
                <span className="tiny num">{recipeMacros(r).kcal} kcal</span><Icons.forward width={14} height={14} />
              </button>
            ))}
          </div>
        ) : <div className="card small">No recipes yet. Write one in a minute: pick the foods, add the method and a photo if you have one.</div>}
      </div>
    </Sheet>
  );
}

function RecipeEditor({ start, isNew, api, onDone, onClose }: { start: Recipe; isNew: boolean; api: NonNullable<ReturnType<typeof useCoachRecipes>["api"]>; onDone: () => void; onClose: () => void }) {
  const [r, setR] = useState<Recipe>(start);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const m = recipeMacros(r);
  const set = (patch: Partial<Recipe>) => { setR({ ...r, ...patch }); setError(null); };
  const hits = q.trim() ? searchFoods(FOODS, q, 6) : [];
  const save = async () => {
    const problem = recipeProblem(r);
    if (problem) return setError(problem);
    setBusy(true);
    try { await api.save(r); onDone(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save the recipe."); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm(`Delete ${r.name || "this recipe"}? Meal plans that use it will show it as a plain line.`)) return;
    setBusy(true);
    try { await api.remove(r.id); onDone(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't delete the recipe."); } finally { setBusy(false); }
  };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    try { set({ photo: await recipePhotoFromFile(f) }); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't use that photo."); }
  };
  return (
    <Sheet label={isNew ? "New recipe" : "Edit recipe"} onClose={onClose}>
      <div className="stack rcp-edit" style={{ gap: 12 }}>
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">{isNew ? "New recipe" : "Edit recipe"}</h2><button className="iconbtn" aria-label="Close" onClick={onClose}><Icons.close width={16} height={16} /></button></div>
        <button type="button" className="rcp-edit-photo" style={{ ["--tone" as string]: MEAL_TONE[r.meal] }} onClick={() => file.current?.click()}>
          {r.photo ? <img src={r.photo} alt="" /> : <span className="rcp-noimg"><Icons.camera width={26} height={26} /><span className="small">Add a photo</span></span>}
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        {r.photo && <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => set({ photo: undefined })}>Remove photo</button>}
        <input id="rcp-name" className="field" maxLength={80} placeholder="Recipe name" value={r.name} onChange={(e) => set({ name: e.target.value })} />
        <div className="seg" role="radiogroup" aria-label="Meal">
          {MEALS.map((x) => <button key={x.key} type="button" role="radio" aria-checked={r.meal === x.key} className={r.meal === x.key ? "on" : ""} onClick={() => set({ meal: x.key })}>{x.label}</button>)}
        </div>
        <label className="row small" style={{ gap: 8 }}>Takes
          <input id="rcp-minutes" className="field num" style={{ width: 80 }} type="number" inputMode="numeric" min={1} max={600} value={r.minutes} onChange={(e) => set({ minutes: Number(e.target.value) })} /> minutes
        </label>
        <div className="chips" role="group" aria-label="Tags">
          {TAGS.map((t) => <button key={t} type="button" className={`chip ${r.tags.includes(t) ? "on" : ""}`} aria-pressed={r.tags.includes(t)} onClick={() => set({ tags: r.tags.includes(t) ? r.tags.filter((x) => x !== t) : [...r.tags, t] })}>{t}</button>)}
        </div>
        <div>
          <div className="sect" style={{ marginBottom: 6 }}><h3 className="h3">Ingredients</h3><span className="tiny num">{m.kcal} kcal · P {m.proteinG} · C {m.carbsG} · F {m.fatG}</span></div>
          <div className="card flat list">
            {r.ingredients.map((i, n) => {
              const f = FOODS.find((x) => x.id === i.foodId);
              const setFactor = (v: number) => set({ ingredients: r.ingredients.map((x, k) => (k === n ? { ...x, factor: v } : x)) });
              return (
                <div key={`${i.foodId}-${n}`} className="li row" style={{ gap: 6 }}>
                  <span className="grow small">{f?.name}</span>
                  <div className="nut-step sm" role="group" aria-label={`Amount of ${f?.name}`}>
                    <button type="button" aria-label="Less" onClick={() => setFactor(Math.max(0.25, Math.round((i.factor - 0.25) * 100) / 100))}>−</button><b className="num">{i.factor}</b><button type="button" aria-label="More" onClick={() => setFactor(Math.min(20, i.factor + 0.25))}>+</button>
                  </div>
                  <button className="iconbtn" aria-label={`Remove ${f?.name}`} onClick={() => set({ ingredients: r.ingredients.filter((_, k) => k !== n) })}><Icons.close width={14} height={14} /></button>
                </div>
              );
            })}
            <div className="li"><input id="rcp-food" className="field" style={{ width: "100%" }} placeholder="Add a food, e.g. chicken, rice, spinach" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            {hits.map((f) => (
              <button key={f.id} type="button" className="li plan-hit" onClick={() => { set({ ingredients: [...r.ingredients, { foodId: f.id, factor: 1 }] }); setQ(""); }}>
                <span className="grow" style={{ textAlign: "left" }}>{f.name}</span><span className="tiny num">{f.kcal} kcal</span><Icons.plus width={15} height={15} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="h3">Method</h3>
          <ol className="rcp-steps rcp-steps-edit">
            {r.steps.map((st, n) => (
              <li key={n}>
                <div className="row" style={{ gap: 6 }}>
                  <textarea className="field" rows={2} maxLength={400} aria-label={`Step ${n + 1}`} value={st} onChange={(e) => set({ steps: r.steps.map((x, k) => (k === n ? e.target.value : x)) })} />
                  {r.steps.length > 1 && <button className="iconbtn" aria-label={`Remove step ${n + 1}`} onClick={() => set({ steps: r.steps.filter((_, k) => k !== n) })}><Icons.close width={14} height={14} /></button>}
                </div>
              </li>
            ))}
          </ol>
          {r.steps.length < MAX_RECIPE_STEPS && <button className="link" onClick={() => set({ steps: [...r.steps, ""] })}>+ Add a step</button>}
        </div>
        {error && <div className="small" role="alert" style={{ color: "var(--warn)" }}>{error}</div>}
        <button className="btn act block" disabled={busy} onClick={() => void save()}>{isNew ? "Save recipe" : "Save changes"}</button>
        {!isNew && <button className="link" style={{ alignSelf: "flex-start", color: "var(--crit)" }} disabled={busy} onClick={() => void remove()}>Delete recipe</button>}
      </div>
    </Sheet>
  );
}
