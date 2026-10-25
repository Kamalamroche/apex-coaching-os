import { Bar, Icons, Label, Spark } from "@apex/ui";
import { useState } from "react";

const RECOVERY = [["Sleep", "7 h 24 m", 82, "var(--data)"], ["Resting HR", "58 bpm", 70, "var(--good)"], ["Steps", "8,412", 84, "var(--act)"]] as const;

export function Progress() {
  const [photos, setPhotos] = useState(false);
  return (
    <>
      <div><div className="eyebrow">Progress</div><h1 className="h1">8 weeks in</h1></div>
      <div className="kpis" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        <div className="kpi"><b>62.3</b><small>Weight, kg</small><i style={{ color: "var(--good)" }}>−1.2 since start</i></div>
        <div className="kpi"><b>70</b><small>Trap bar, kg × 5</small><i style={{ color: "var(--good)" }}>+15 since start</i></div>
      </div>
      <div className="card">
        <div className="sect" style={{ marginBottom: 6 }}><h3 className="h3">Trap bar deadlift, top set</h3></div>
        <Spark data={[55, 57.5, 60, 62.5, 62.5, 65, 67.5, 70]} unit="kg" />
      </div>
      <button className="card" style={{ textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }} onClick={() => setPhotos(!photos)} aria-expanded={photos}>
        <div><div className="h3">Progress photos</div><div className="small">Start · week 4 · now</div></div>
        <span className="h2">{photos ? "–" : "+"}</span>
      </button>
      {photos && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {["Start", "Week 4", "Now"].map((l, i) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div className="video" style={{ aspectRatio: "3/4", borderColor: i === 2 ? "var(--good)" : undefined }}><Icons.figure width={48} height={48} /></div>
              <div className="tiny" style={{ marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      )}
      <section>
        <div className="sect"><h2 className="h2">Recovery</h2><Label kind="data">From Apple Health</Label></div>
        <div className="card flat list">
          {RECOVERY.map(([name, value, pct, color]) => (
            <div key={name} className="li">
              <div className="grow">
                <div className="row" style={{ justifyContent: "space-between" }}><span className="h3">{name}</span><span className="num" style={{ fontWeight: 700 }}>{value}</span></div>
                <div style={{ marginTop: 6 }}><Bar pct={pct} color={color} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
