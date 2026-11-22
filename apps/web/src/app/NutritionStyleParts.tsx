import {
  PORTION_KINDS, TRACKING_STYLES, NO_PORTIONS, cleanPortions, foodFromLabel, foodsFromOffSearch, offSearchUrl, parseNutritionLabel, portionMacros, portionsForTargets, portionsLabel,
  savedMealFrom, savedMealProblem, savedMealTotals, suggestMealName, sumPortions, MEALS,
  type Food, type FoodEntry, type Macros, type Meal, type PortionKind, type Portions, type SavedMeal, type TrackingStyle,
} from "@apex/core";
import { Icons, Label } from "@apex/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLifestyle, useLifestyleStore } from "../data/LifestyleContext";
import { shrinkPhoto } from "../data/photos";
import { useStore } from "../data/StoreContext";
import { useAppInfo } from "./AppContext";

/* Nutrition styles: the coach picks how each client tracks (full macros, protein and calories, hand portions
   or a photo diary), plus the pieces both sides share: hand-portion logging, meal photos, saved meals, and
   finding foods outside the built-in list (Open Food Facts search, reading a label with the camera). */

const mealLabel = (m: Meal) => MEALS.find((x) => x.key === m)?.label ?? m;

/** Simple line drawings for the four hand portions. Original APEX art, drawn to match the Lucide icon weight. */
export function HandGlyph({ kind, size = 22 }: { kind: PortionKind; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (kind === "protein") return <svg {...p}><path d="M6 20V10.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V20" /><path d="M5 20h14" /><path d="M9 8.5V5.5M12 8.5V4.5M15 8.5V5.5" /></svg>;
  if (kind === "veg") return <svg {...p}><rect x="5" y="8" width="13" height="10" rx="4" /><path d="M8 8V6.5a1.5 1.5 0 0 1 3 0V8M11 8V6a1.5 1.5 0 0 1 3 0v2" /><path d="M18 12h1.5" /></svg>;
  if (kind === "carbs") return <svg {...p}><path d="M3.5 11h17a8.5 8.5 0 0 1-17 0Z" /><path d="M8 8.5c1-1.2 2.6-1.2 3.6 0M12.4 8c1-1.2 2.6-1.2 3.6 0" /></svg>;
  return <svg {...p}><rect x="9" y="4" width="6" height="15" rx="3" /><path d="M9 9h6" /></svg>;
}

/* ───────────── Coach: how this client tracks ───────────── */

export function TrackingStyleCard({ name, targets, say }: { name: string; targets: Macros | null; say: (m: string) => void }) {
  const store = useLifestyleStore();
  const s = useLifestyle();
  const suggested = targets ? portionsForTargets(targets) : { protein: 5, veg: 6, carbs: 5, fats: 4 };
  const [style, setStyle] = useState<TrackingStyle>(s.style);
  const [portions, setPortions] = useState<Portions>(s.portionTargets ?? suggested);
  const [own, setOwn] = useState(!!s.portionTargets);
  useEffect(() => { setStyle(s.style); setPortions(s.portionTargets ?? suggested); setOwn(!!s.portionTargets); }, [s.style, JSON.stringify(s.portionTargets), JSON.stringify(suggested)]);
  const changed = style !== s.style || (style === "portions" && own !== !!s.portionTargets) || (style === "portions" && own && JSON.stringify(portions) !== JSON.stringify(s.portionTargets));
  const save = () => {
    store.setStyle(style, style === "portions" && own ? cleanPortions(portions) : null);
    say(`${name} now tracks with ${TRACKING_STYLES.find((x) => x.key === style)!.label.toLowerCase()}`);
  };
  const est = portionMacros(own ? portions : suggested);
  return (
    <section className="card stack ns-card" aria-label={`How ${name} tracks food`}>
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">How {name} tracks food</h3><Label kind="dec">Coach decision</Label></div>
      {!s.styleReady && <div className="tiny" style={{ color: "var(--warn)" }}>Needs the latest database update before this can be saved. {name} tracks full macros until then.</div>}
      <div className="ns-styles" role="radiogroup" aria-label="Tracking style">
        {TRACKING_STYLES.map((t) => (
          <button key={t.key} type="button" role="radio" aria-checked={style === t.key} className={`ns-style${style === t.key ? " on" : ""}`} onClick={() => setStyle(t.key)}>
            <b>{t.label}</b><span className="tiny">{t.note}</span>
          </button>
        ))}
      </div>
      {style === "portions" && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="small">{own ? `Daily hand portions for ${name}.` : targets ? `Worked out from ${name}'s targets. Change any of them if you like.` : `A starting point. Set targets and these follow them.`}</div>
          <div className="ns-portions">
            {PORTION_KINDS.map((k) => (
              <div key={k.key} className="ns-portion">
                <span className="ns-hand"><HandGlyph kind={k.key} /></span>
                <span className="grow"><b>{k.label}</b><span className="tiny">{k.hand}s a day</span></span>
                <Stepper value={(own ? portions : suggested)[k.key]} label={`${k.label} portions a day`} onChange={(v) => { setOwn(true); setPortions({ ...(own ? portions : suggested), [k.key]: v }); }} />
              </div>
            ))}
          </div>
          <div className="tiny">About <span className="num">{est.kcal.toLocaleString("en-GB")} kcal</span> and <span className="num">{est.proteinG} g</span> protein a day. Estimates: hands vary.{own && targets && <> <button className="link" onClick={() => { setOwn(false); setPortions(suggested); }}>Follow the targets again</button></>}</div>
        </div>
      )}
      <button className="btn act block" disabled={!changed || !s.styleReady} onClick={save}>Save</button>
    </section>
  );
}

function Stepper({ value, onChange, label, step = 0.5 }: { value: number; onChange: (v: number) => void; label: string; step?: number }) {
  return (
    <div className="nut-step" role="group" aria-label={label}>
      <button type="button" aria-label={`Fewer: ${label}`} onClick={() => onChange(Math.max(0, value - step))}>−</button>
      <b className="num">{value}</b>
      <button type="button" aria-label={`More: ${label}`} onClick={() => onChange(Math.min(20, value + step))}>+</button>
    </div>
  );
}

/* ───────────── Client: hand portions ───────────── */

/** Today's hand portions against the coach's, as four counters. */
export function PortionBoard({ food, day, target }: { food: FoodEntry[]; day: string; target: Portions }) {
  const eaten = sumPortions(food.filter((f) => f.day === day).map((f) => f.portions));
  return (
    <div className="pb-board" role="list" aria-label="Hand portions today">
      {PORTION_KINDS.map((k) => {
        const n = eaten[k.key];
        const of = target[k.key];
        const pct = of ? Math.min(100, (n / of) * 100) : 0;
        return (
          <div key={k.key} role="listitem" className={`pb-tile pb-${k.key}${of && n >= of ? " done" : ""}`} aria-label={`${k.label}: ${n} of ${of} ${k.hand.toLowerCase()}s`}>
            <span className="pb-hand"><HandGlyph kind={k.key} size={20} /></span>
            <b className="num">{n}<small>/{of}</small></b>
            <span className="tiny">{k.label}</span>
            <i className="pb-bar"><i style={{ width: `${pct}%` }} /></i>
          </div>
        );
      })}
    </div>
  );
}

/** Log a meal in hand portions. */
export function PortionLogger({ meal, onLog }: { meal: Meal; onLog: (p: Portions) => void }) {
  const [p, setP] = useState<Portions>(NO_PORTIONS);
  const any = PORTION_KINDS.some((k) => p[k.key] > 0);
  const m = portionMacros(p);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="ns-portions">
        {PORTION_KINDS.map((k) => (
          <div key={k.key} className="ns-portion">
            <span className="ns-hand"><HandGlyph kind={k.key} /></span>
            <span className="grow"><b>{k.label} · {k.hand.toLowerCase()}</b><span className="tiny">{k.examples}</span></span>
            <Stepper value={p[k.key]} label={`${k.label} in this meal`} onChange={(v) => setP({ ...p, [k.key]: v })} />
          </div>
        ))}
      </div>
      {any && <div className="tiny">Roughly <span className="num">{m.kcal} kcal · {m.proteinG} g protein</span></div>}
      <button className="btn act block" disabled={!any} onClick={() => { onLog(cleanPortions(p)); setP(NO_PORTIONS); }}>Add to {mealLabel(meal).toLowerCase()}</button>
    </div>
  );
}

/** A food entry from hand portions, with estimated macros. */
export function portionEntry(p: Portions): Omit<FoodEntry, "id" | "day" | "meal"> {
  return { name: portionsLabel(p), ...portionMacros(p), portions: p };
}

/* ───────────── Meal photos ───────────── */

/** Take or pick a photo of the meal. The photo is shrunk on the phone before it goes anywhere. */
export function MealPhotoButton({ meal, onAdded, big = false, children }: { meal: Meal; onAdded: (photo: string) => void; big?: boolean; children?: ReactNode }) {
  const store = useLifestyleStore();
  // The demo keeps photos in this browser, so they're kept small there.
  const { mode } = useAppInfo();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const blob = await shrinkPhoto(file, mode === "demo" ? 480 : 1080);
      onAdded(await store.uploadMealPhoto(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void pick(e.target.files?.[0])} />
      {big ? (
        <button type="button" className="mp-snap" disabled={busy} onClick={() => input.current?.click()}>
          <Icons.camera width={22} height={22} /><span>{busy ? "Saving the photo…" : children ?? `Snap your ${mealLabel(meal).toLowerCase()}`}</span>
        </button>
      ) : (
        <button type="button" className="iconbtn mp-add" disabled={busy} aria-label={`Add a photo of ${mealLabel(meal).toLowerCase()}`} onClick={() => input.current?.click()}><Icons.camera width={16} height={16} /></button>
      )}
      {error && <div className="tiny" style={{ color: "var(--warn)" }}>{error}</div>}
    </>
  );
}

/** One meal photo, fetched when it scrolls near. */
export function MealPhoto({ photo, alt, className = "mp-img" }: { photo: string; alt: string; className?: string }) {
  const store = useLifestyleStore();
  const [src, setSrc] = useState<string | null>(photo.startsWith("data:") || photo.startsWith("/") ? photo : null);
  useEffect(() => {
    if (src) return;
    let live = true;
    void store.mealPhotoUrl(photo).then((u) => live && setSrc(u));
    return () => { live = false; };
  }, [photo, src, store]);
  return src ? <img className={className} src={src} alt={alt} loading="lazy" /> : <span className={`${className} mp-wait`} aria-label={alt} />;
}

/** Coach: the client's meal photos from the last two weeks, newest first, with a reply that goes to the chat. */
export function MealPhotoGallery({ name, say }: { name: string; say: (m: string) => void }) {
  const s = useLifestyle();
  const store = useStore();
  const [open, setOpen] = useState<FoodEntry | null>(null);
  const [reply, setReply] = useState("");
  const photos = s.food.filter((f) => f.photo).slice().reverse().slice(0, 24);
  if (!photos.length) return s.style === "photos" ? <div className="card small">{name} hasn't added a meal photo yet. They'll show here as they do.</div> : null;
  const when = (f: FoodEntry) => `${mealLabel(f.meal)}, ${new Date(`${f.day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`;
  const send = () => {
    if (!open || !reply.trim()) return;
    store.sendMessage("coach", `About your ${when(open).toLowerCase()}: ${reply.trim()}`);
    say(`Sent to ${name}`);
    setReply(""); setOpen(null);
  };
  return (
    <section className="card stack" aria-label="Meal photos">
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Meal photos</h3><span className="tiny">{photos.length} lately</span></div>
      <div className="mp-grid">
        {photos.map((f) => (
          <button key={f.id} type="button" className={`mp-tile${open?.id === f.id ? " on" : ""}`} onClick={() => { setOpen(open?.id === f.id ? null : f); setReply(""); }} aria-label={`${when(f)}${f.kcal ? `, ${Math.round(f.kcal)} kcal` : ""}`}>
            <MealPhoto photo={f.photo!} alt={when(f)} />
            <span className="mp-cap tiny">{mealLabel(f.meal)}</span>
          </button>
        ))}
      </div>
      {open && (
        <div className="stack mp-reply" style={{ gap: 8 }}>
          <div className="small"><b style={{ color: "var(--text)" }}>{when(open)}</b>{open.kcal ? <span className="num"> · {Math.round(open.kcal)} kcal · P {open.proteinG}</span> : null}{open.name && !/photo$/i.test(open.name) ? ` · ${open.name}` : ""}</div>
          <input className="field" maxLength={300} placeholder={`A word for ${name} about this meal`} value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
          <div className="chips">
            {["Great plate 👏", "Add a palm of protein here", "More veg next time", "Perfect portion"].map((q) => <button key={q} type="button" className="chip" onClick={() => setReply(q)}>{q}</button>)}
          </div>
          <button className="btn act block" disabled={!reply.trim()} onClick={send}>Send to {name}</button>
        </div>
      )}
    </section>
  );
}

/* ───────────── Saved meals ───────────── */

export function SavedMeals({ meal, onLog }: { meal: Meal; onLog: (m: SavedMeal) => void }) {
  const s = useLifestyle();
  const store = useLifestyleStore();
  if (!s.savedMeals.length) return null;
  const list = [...s.savedMeals].sort((a, b) => Number(b.meal === meal) - Number(a.meal === meal));
  return (
    <div className="sm-row" role="list" aria-label="Saved meals">
      {list.map((m) => {
        const t = savedMealTotals(m);
        return (
          <div key={m.id} role="listitem" className="sm-card">
            <button type="button" className="sm-log" onClick={() => onLog(m)} aria-label={`Log ${m.name} to ${mealLabel(meal).toLowerCase()}`}>
              <span className="tiny">{mealLabel(m.meal)} · {m.items.length} food{m.items.length === 1 ? "" : "s"}</span>
              <b>{m.name}</b>
              <span className="tiny num">{t.kcal} kcal · P {t.proteinG}</span>
              <span className="sm-plus"><Icons.plus width={16} height={16} /></span>
            </button>
            <button type="button" className="iconbtn sm-del" aria-label={`Forget ${m.name}`} onClick={() => store.removeSavedMeal(m.id)}><Icons.close width={14} height={14} /></button>
          </div>
        );
      })}
    </div>
  );
}

/** "Save this meal" under a meal that has foods in it. */
export function SaveMealLink({ meal, entries, say }: { meal: Meal; entries: FoodEntry[]; say?: (m: string) => void }) {
  const store = useLifestyleStore();
  const s = useLifestyle();
  const [name, setName] = useState<string | null>(null);
  if (!s.styleReady || !entries.length || entries.every((e) => e.portions || e.photo)) return null;
  if (name === null) return <button className="li link" style={{ minHeight: 40 }} onClick={() => setName(suggestMealName(meal, entries))}>Save as a meal to log in one tap</button>;
  const problem = savedMealProblem(name, entries);
  return (
    <div className="li stack" style={{ gap: 8, alignItems: "stretch" }}>
      <input className="field" maxLength={60} autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Meal name" />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm ghost" onClick={() => setName(null)}>Cancel</button>
        <button className="btn sm act" style={{ flex: 1 }} disabled={!!problem} onClick={() => {
          store.saveMeal(savedMealFrom(name, meal, entries.filter((e) => !e.portions && !e.photo), crypto.randomUUID()));
          say?.("Meal saved · one tap next time");
          setName(null);
        }}>Save meal</button>
      </div>
    </div>
  );
}

/* ───────────── Finding foods outside the built-in list ───────────── */

/** Searches Open Food Facts (free and open) once the client stops typing. Only runs when the built-in list has little. */
export function useOnlineFoods(q: string, enabled: boolean): { foods: Food[]; state: "idle" | "loading" | "done" | "error" } {
  const [res, setRes] = useState<{ q: string; foods: Food[]; state: "idle" | "loading" | "done" | "error" }>({ q: "", foods: [], state: "idle" });
  useEffect(() => {
    const term = q.trim();
    if (!enabled || term.length < 3) { setRes({ q: term, foods: [], state: "idle" }); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setRes((r) => ({ ...r, q: term, state: "loading" }));
      fetch(offSearchUrl(term), { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j) => setRes({ q: term, foods: foodsFromOffSearch(j).slice(0, 12), state: "done" }))
        .catch((e: unknown) => { if ((e as { name?: string })?.name !== "AbortError") setRes({ q: term, foods: [], state: "error" }); });
    }, 450);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, enabled]);
  return { foods: res.foods, state: res.state };
}

/** Read a nutrition label with the camera (on the phone, nothing uploaded), check the numbers, then pick the amount. */
export function LabelScan({ onFound, onClose }: { onFound: (f: Food) => void; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const [vals, setVals] = useState<{ name: string; kcal: string; protein: string; carbs: string; fat: string; fibre?: number; sugar?: number; salt?: number } | null>(null);
  const read = async (file: File | undefined) => {
    if (!file) return;
    setNote("Reading the label…");
    try {
      const { extractImageText } = await import("../data/pdfText");
      const text = await extractImageText(file, setNote);
      const v = parseNutritionLabel(text);
      if (!v) { setNote("Couldn't read the numbers. Try again closer, straight on and in good light, or use quick add."); return; }
      setVals({ name: "", kcal: String(v.kcal), protein: String(v.protein), carbs: String(v.carbs), fat: String(v.fat), fibre: v.fibre, sugar: v.sugar, salt: v.salt });
      setNote(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      if (input.current) input.current.value = "";
    }
  };
  const n = (s: string) => Number(s.replace(",", "."));
  const ok = vals && vals.name.trim() && [vals.kcal, vals.protein, vals.carbs, vals.fat].every((x) => x.trim() !== "" && Number.isFinite(n(x)) && n(x) >= 0);
  return (
    <div className="card stack ls-card">
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Read a nutrition label</h3><button className="iconbtn" aria-label="Close" onClick={onClose}><Icons.close width={16} height={16} /></button></div>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void read(e.target.files?.[0])} />
      {!vals && <>
        <div className="small">Take a photo of the table on the pack. It's read on your phone, so nothing is uploaded.</div>
        <button className="btn sec block" onClick={() => input.current?.click()}><Icons.camera width={16} height={16} /> Take a photo of the label</button>
      </>}
      {note && <div className="tiny" role="status">{note}</div>}
      {vals && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="small">Per 100 g. Check them against the pack, then name it.</div>
          <input className="field" maxLength={70} placeholder="What is it? e.g. Oat bar" value={vals.name} onChange={(e) => setVals({ ...vals, name: e.target.value })} autoFocus />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
            {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
              <label key={k} className="tiny" style={{ display: "flex", flexDirection: "column", gap: 4 }}>{k === "kcal" ? "kcal" : `${k[0]!.toUpperCase()}${k.slice(1)} g`}<input className="field num" inputMode="decimal" value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></label>
            ))}
          </div>
          <button className="btn act block" disabled={!ok} onClick={() => vals && onFound(foodFromLabel(vals.name, { kcal: n(vals.kcal), protein: n(vals.protein), carbs: n(vals.carbs), fat: n(vals.fat), ...(vals.fibre !== undefined ? { fibre: vals.fibre } : {}), ...(vals.sugar !== undefined ? { sugar: vals.sugar } : {}), ...(vals.salt !== undefined ? { salt: vals.salt } : {}) }))}>Choose the amount</button>
        </div>
      )}
    </div>
  );
}
