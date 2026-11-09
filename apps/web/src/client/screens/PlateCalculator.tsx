import { BARS, BARS_LB, PLATES_KG, PLATES_LB, describePlates, loadPlates, type Exercise, type WeightUnit } from "@apex/core";
import { Label, Sheet, useUnits } from "@apex/ui";
import { useState } from "react";

/* Plate look by weight: heavier plates are taller and wider. Colours stay inside the token set. */
const PLATE_LOOK: Record<string, { h: number; w: number; bg: string; ink: string }> = {
  "25": { h: 112, w: 20, bg: "var(--act)", ink: "var(--act-ink)" },
  "20": { h: 104, w: 18, bg: "var(--blue)", ink: "#fff" },
  "15": { h: 92, w: 16, bg: "var(--warn)", ink: "var(--bg)" },
  "10": { h: 78, w: 14, bg: "var(--good)", ink: "var(--bg)" },
  "5": { h: 60, w: 12, bg: "var(--data)", ink: "var(--bg)" },
  "2.5": { h: 46, w: 10, bg: "var(--text2)", ink: "var(--bg)" },
  "1.25": { h: 38, w: 8, bg: "var(--text3)", ink: "var(--bg)" },
};

/* lb plates borrow the look of the kg plate closest in size. */
const LB_LOOK: Record<string, string> = { "45": "25", "35": "20", "25": "15", "10": "10", "5": "5", "2.5": "2.5" };

function Plate({ kg, side, i, unit }: { kg: number; side: "l" | "r"; i: number; unit: WeightUnit }) {
  const look = PLATE_LOOK[unit === "lb" ? LB_LOOK[String(kg)] ?? "" : String(kg)] ?? { h: 50, w: 10, bg: "var(--text3)", ink: "var(--bg)" };
  return (
    <div title={`${kg} ${unit}`} className={`plate plate-${side}`} style={{ ["--i" as string]: i, height: look.h, width: look.w, background: look.bg, borderRadius: 3, display: "grid", placeItems: "center", flex: "none" }}>
      {look.w >= 14 && <span style={{ writingMode: "vertical-rl", font: "800 10px/1 var(--num)", color: look.ink }}>{kg}</span>}
    </div>
  );
}

/** How to load the bar for a target weight: plates per side, drawn on a bar. */
export function PlateCalculator({ exercise, kg, barKg, setBarKg, onClose }: {
  exercise: Exercise; kg: number; barKg: number; setBarKg: (kg: number) => void; onClose: () => void;
}) {
  // Everything in here is in the person's unit: kg plates on a 20 kg bar, or lb plates on a 45 lb bar.
  const u = useUnits();
  const lb = u.weight === "lb";
  const unit = u.weight;
  const bars = lb ? BARS_LB : BARS;
  const bar = lb ? BARS_LB.reduce((a, b) => (Math.abs(b.kg - u.w(barKg)) < Math.abs(a.kg - u.w(barKg)) ? b : a)).kg : barKg;
  const pickBar = (v: number) => setBarKg(lb ? u.toKg(v) : v);
  const [target, setTarget] = useState(kg ? String(lb ? Math.round(u.w(kg)) : kg) : "");
  const t = Number(target.replace(",", ".")) || 0;
  const load = loadPlates(t, bar, lb ? PLATES_LB : PLATES_KG);
  const sleeve = <div style={{ width: 26, height: 10, background: "var(--line2)", borderRadius: 2, flex: "none" }} />;
  return (
    <Sheet onClose={onClose} label="Plate calculator">
      <div className="row"><Label kind="data">Data</Label><span className="tiny">{exercise.name}</span></div>
      <h2 className="h2">Load the bar</h2>
      <div className="row" style={{ gap: 8 }}>
        <input id="platetarget" className="field num" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} aria-label={`Target weight in ${unit}`} style={{ flex: 1, fontSize: 20, fontWeight: 800 }} />
        <span className="h3">{unit}</span>
      </div>
      <div className="chips" role="radiogroup" aria-label="Bar" style={{ flexWrap: "wrap" }}>
        {bars.map((b) => (
          <button key={b.kg} className={`chip ${b.kg === bar ? "on" : ""}`} role="radio" aria-checked={b.kg === bar} onClick={() => pickBar(b.kg)}>{b.label} · {b.kg} {unit}</button>
        ))}
      </div>
      <div className="card plate-bar" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, minHeight: 140, overflow: "hidden", padding: "12px 4px" }} aria-hidden="true">
        {sleeve}
        {[...load.perSide].reverse().map((p, i, all) => <Plate key={`l${all.length - 1 - i}-${p}`} kg={p} side="l" i={all.length - 1 - i} unit={unit} />)}
        <div style={{ flex: "1 1 40px", maxWidth: 120, minWidth: 30, height: 8, background: "var(--text3)", borderRadius: 2 }} />
        {load.perSide.map((p, i) => <Plate key={`r${i}-${p}`} kg={p} side="r" i={i} unit={unit} />)}
        {sleeve}
      </div>
      <div>
        <div className="small">Each side</div>
        <div className="h2 num" style={{ marginTop: 2 }}>{describePlates(load.perSide)}{load.perSide.length ? ` ${unit}` : ""}</div>
        {t > 0 && t < bar && <div className="small" style={{ marginTop: 6, color: "var(--warn)" }}>The bar alone weighs {bar} {unit}.</div>}
        {load.shortKg > 0 && t >= bar && (
          <div className="small" style={{ marginTop: 6, color: "var(--warn)" }}>{t} {unit} can't be made exactly with these plates. This loads <b className="num">{load.totalKg} {unit}</b>.</div>
        )}
      </div>
      <button className="btn act block" onClick={onClose}>Done</button>
    </Sheet>
  );
}
