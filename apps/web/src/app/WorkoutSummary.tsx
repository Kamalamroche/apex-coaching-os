import { describeExerciseTotal, type WorkoutSummary } from "@apex/core";
import { Label } from "@apex/ui";
import { ReadinessSummary } from "./ReadinessViz";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toLocaleString("en-GB")}`;
const tone = (n: number) => (n > 0 ? "var(--good)" : n < 0 ? "var(--warn)" : "var(--text2)");

/** Muscles worked, personal bests and the comparison with last time. Shared by the client and coach apps. */
export function WorkoutSummaryCard({ summary: s, compact = false }: { summary: WorkoutSummary; compact?: boolean }) {
  const top = s.muscles[0]?.sets ?? 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {s.readiness && <ReadinessSummary readiness={s.readiness} />}
      {s.bests.length > 0 && (
        <div className="card" style={{ background: "var(--act-soft)", borderColor: "var(--act)", padding: "10px 12px" }}>
          <div className="h3">🏆 {s.bests.length} new personal best{s.bests.length > 1 ? "s" : ""}</div>
          {s.bests.map((b) => (
            <div key={b.exerciseId} className="small num" style={{ marginTop: 4 }}>{b.exercise}: <b style={{ color: "var(--text)" }}>{b.kg} kg</b> (was {b.previousKg} kg)</div>
          ))}
        </div>
      )}
      {s.exercises && s.exercises.length > 0 && (
        <div className="card" style={{ padding: "10px 12px" }}>
          <div className="sect" style={{ marginBottom: 6 }}><h3 className="h3">Exercises</h3><span className="num small" style={{ fontWeight: 700, color: "var(--text)" }}>{(s.totalReps ?? 0).toLocaleString("en-GB")} reps{s.totalKg ? ` · ${s.totalKg.toLocaleString("en-GB")} kg` : ""} in total</span></div>
          <div className="list">
            {s.exercises.map((e) => (
              <div key={e.exerciseId} style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>
                <div className="small" style={{ color: "var(--text)" }}>{e.exercise}</div>
                <div className="tiny num" style={{ marginTop: 2 }}>{describeExerciseTotal(e)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {s.muscles.length > 0 && (
        <div className="card" style={{ padding: "10px 12px" }}>
          <div className="sect" style={{ marginBottom: 8 }}><h3 className="h3">Muscles worked</h3><Label kind="data">Data</Label></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {s.muscles.slice(0, compact ? 3 : 8).map((m) => (
              <div key={m.muscle} style={{ display: "grid", gridTemplateColumns: "92px 1fr 44px", alignItems: "center", gap: 8 }}>
                <span className="small" style={{ color: "var(--text)" }}>{m.muscle}</span>
                <div style={{ height: 8, background: "var(--line)", borderRadius: 4 }}><div style={{ height: "100%", width: `${(m.sets / top) * 100}%`, background: "var(--blue)", borderRadius: 4 }} /></div>
                <span className="tiny num" style={{ textAlign: "right" }}>{m.sets} sets</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {s.vsLast && (
        <div className="kpis">
          <div className="kpi"><b className="num" style={{ color: tone(s.vsLast.volumeKg), fontSize: 18 }}>{signed(s.vsLast.volumeKg)}</b><small>kg vs last time</small></div>
          <div className="kpi"><b className="num" style={{ color: tone(s.vsLast.sets), fontSize: 18 }}>{signed(s.vsLast.sets)}</b><small>Sets</small></div>
          <div className="kpi"><b className="num" style={{ fontSize: 18 }}>{signed(s.vsLast.minutes)}</b><small>Minutes</small></div>
        </div>
      )}
      <div className="small" style={{ color: "var(--text)" }}>{s.fun}</div>
    </div>
  );
}
