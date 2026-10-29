import { bestPerDay, formatSleep } from "@apex/core";
import { BackLink, Icons, Spark } from "@apex/ui";
import { useState } from "react";
import { SampleNote } from "../../app/AppContext";
import { useActivities } from "../../data/ActivityContext";
import { ConnectedApps } from "./ConnectedApps";
import { Recovery } from "./Recovery";

export function Progress({ say }: { say: (m: string) => void }) {
  const [photos, setPhotos] = useState(false);
  const [mode, setMode] = useState<"body" | "recovery" | "apps">("body");
  const { recovery } = useActivities();
  const last = bestPerDay(recovery)[0];
  const modes = (
    <div className="chips" role="tablist" aria-label="Progress view">
      <button role="tab" aria-selected={mode === "body"} className={`chip ${mode === "body" ? "on" : ""}`} onClick={() => setMode("body")}>Body and strength</button>
      <button role="tab" aria-selected={mode !== "body"} className={`chip ${mode !== "body" ? "on" : ""}`} onClick={() => setMode("recovery")}>Recovery</button>
    </div>
  );
  if (mode === "apps") return <>{modes}<BackLink onClick={() => setMode("recovery")}>Recovery</BackLink><ConnectedApps say={say} /></>;
  if (mode === "recovery") return <>{modes}<Recovery say={say} openApps={() => setMode("apps")} /></>;
  return (
    <>
      {modes}
      <div><div className="eyebrow">Progress</div><h1 className="h1">8 weeks in</h1></div>
      <SampleNote />
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
      <button className="card" style={{ textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }} onClick={() => setMode("recovery")}>
        <div><div className="h3">Recovery</div><div className="small num">{last ? [last.sleepMinutes ? `${formatSleep(last.sleepMinutes)} sleep` : null, last.hrvMs ? `HRV ${Math.round(last.hrvMs)} ms` : null, last.restingHr ? `${last.restingHr} bpm resting` : null].filter(Boolean).join(" · ") : "Sleep, HRV and resting heart rate from your watch"}</div></div>
        <span className="tiny">›</span>
      </button>
    </>
  );
}
