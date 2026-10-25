import { CLIENTS } from "@apex/core";
import { Bar } from "@apex/ui";
import { useState } from "react";

/* kcal, protein, carbs, fat per client. Sample values. */
const TARGETS: Record<number, [number, number, number, number]> = { 2: [2800, 200, 320, 80], 5: [1900, 120, 210, 60], 3: [1700, 130, 170, 55] };
const LOGGED_PCT: Record<number, number> = { 2: 78, 5: 91, 3: 64 };
const SUPPLEMENTS = [["Creatine", "5 g", "Daily"], ["Whey protein", "30 g", "After training"], ["Vitamin D3", "2000 IU", "Morning"], ["Magnesium", "400 mg", "Before bed"]] as const;

export function CoachNutrition() {
  const [clientId, setClientId] = useState(2);
  const [kcal, protein, carbs, fat] = TARGETS[clientId] ?? [2200, 150, 240, 70];
  const pct = LOGGED_PCT[clientId] ?? 70;
  const macros = [["kcal", kcal, "var(--act)"], ["Protein g", protein, "var(--crit)"], ["Carbs g", carbs, "var(--data)"], ["Fat g", fat, "var(--warn)"]] as const;
  return (
    <>
      <div><div className="eyebrow">Nutrition</div><h1 className="h1">Targets and supplements</h1></div>
      <select id="nutclient" className="field" value={clientId} onChange={(e) => setClientId(Number(e.target.value))} aria-label="Client">
        {CLIENTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="card">
        <div className="kpis" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          {macros.map(([l, v, c]) => (
            <div key={l} style={{ textAlign: "center" }}><div className="num" style={{ fontWeight: 700, fontSize: 18, color: c }}>{v.toLocaleString()}</div><div className="tiny">{l}</div></div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}><Bar pct={pct} /></div>
        <div className="small" style={{ marginTop: 6 }}>{pct}% of today's target logged · 7-day average 82%</div>
      </div>
      <section>
        <div className="sect"><h2 className="h2">Supplement plan</h2></div>
        <div className="card flat list">
          {SUPPLEMENTS.map(([name, dose, when]) => (
            <div key={name} className="li"><div className="grow"><div className="h3">{name}</div><div className="small">{when}</div></div><span className="num" style={{ fontWeight: 700 }}>{dose}</span></div>
          ))}
        </div>
      </section>
    </>
  );
}
