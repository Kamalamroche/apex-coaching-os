import { BARS, describePlates, loadPlates, type Exercise } from "@apex/core";
import { Label, Sheet } from "@apex/ui";
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

function Plate({ kg }: { kg: number }) {
  const look = PLATE_LOOK[String(kg)] ?? { h: 50, w: 10, bg: "var(--text3)", ink: "var(--bg)" };
  return (
    <div title={`${kg} kg`} style={{ height: look.h, width: look.w, background: look.bg, borderRadius: 3, display: "grid", placeItems: "center", flex: "none" }}>
      {look.w >= 14 && <span style={{ writingMode: "vertical-rl", font: "800 10px/1 var(--num)", color: look.ink }}>{kg}</span>}
    </div>
  );
}

/** How to load the bar for a target weight: plates per side, drawn on a bar. */
export function PlateCalculator({ exercise, kg, barKg, setBarKg, onClose }: {
  exercise: Exercise; kg: number; barKg: number; setBarKg: (kg: number) => void; onClose: () => void;
}) {
  const [target, setTarget] = useState(kg ? String(kg) : "");
  const t = Number(target.replace(",", ".")) || 0;
  const load = loadPlates(t, barKg);
  const sleeve = <div style={{ width: 26, height: 10, background: "var(--line2)", borderRadius: 2, flex: "none" }} />;
  return (
    <Sheet onClose={onClose} label="Plate calculator">
      <div className="row"><Label kind="data">Data</Label><span className="tiny">{exercise.name}</span></div>
      <h2 className="h2">Load the bar</h2>
      <div className="row" style={{ gap: 8 }}>
        <input id="platetarget" className="field num" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Target weight in kg" style={{ flex: 1, fontSize: 20, fontWeight: 800 }} />
        <span className="h3">kg</span>
      </div>
      <div className="chips" role="radiogroup" aria-label="Bar" style={{ flexWrap: "wrap" }}>
        {BARS.map((b) => (
          <button key={b.kg} className={`chip ${b.kg === barKg ? "on" : ""}`} role="radio" aria-checked={b.kg === barKg} onClick={() => setBarKg(b.kg)}>{b.label} · {b.kg} kg</button>
        ))}
      </div>
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, minHeight: 140, overflow: "hidden", padding: "12px 4px" }} aria-hidden="true">
        {sleeve}
        {[...load.perSide].reverse().map((p, i) => <Plate key={`l${i}`} kg={p} />)}
        <div style={{ flex: "1 1 40px", maxWidth: 120, minWidth: 30, height: 8, background: "var(--text3)", borderRadius: 2 }} />
        {load.perSide.map((p, i) => <Plate key={`r${i}`} kg={p} />)}
        {sleeve}
      </div>
      <div>
        <div className="small">Each side</div>
        <div className="h2 num" style={{ marginTop: 2 }}>{describePlates(load.perSide)}{load.perSide.length ? " kg" : ""}</div>
        {t > 0 && t < barKg && <div className="small" style={{ marginTop: 6, color: "var(--warn)" }}>The bar alone weighs {barKg} kg.</div>}
        {load.shortKg > 0 && t >= barKg && (
          <div className="small" style={{ marginTop: 6, color: "var(--warn)" }}>{t} kg can't be made exactly with these plates. This loads <b className="num">{load.totalKg} kg</b>.</div>
        )}
      </div>
      <button className="btn act block" onClick={onClose}>Done</button>
    </Sheet>
  );
}
