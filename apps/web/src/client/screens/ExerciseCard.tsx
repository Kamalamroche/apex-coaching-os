import type { Exercise } from "@apex/core";
import { Icons } from "@apex/ui";

export function ExerciseCard({ exercise: ex }: { exercise: Exercise }) {
  return (
    <>
      <div className="video"><span className="tag label l-data">Demo video</span><Icons.figure /></div>
      <div>
        <div className="eyebrow">{ex.type} · {ex.pattern} · {ex.equipment}</div>
        <h2 className="h1" style={{ fontSize: 24 }}>{ex.name}</h2>
        <div className="small">{ex.muscles.length ? ex.muscles.join(", ") : ex.focus}</div>
      </div>
      <div className="card">
        <h3 className="h3" style={{ marginBottom: 8 }}>Coaching cues</h3>
        {ex.cues.length ? (
          <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>{ex.cues.map((c) => <li key={c}>{c}</li>)}</ol>
        ) : (
          <div className="small">Cues for this movement are on the way. Ask your coach if you're unsure how to do it.</div>
        )}
        {ex.commonMistake && <div className="small" style={{ marginTop: 10 }}><b style={{ color: "var(--crit)" }}>Common mistake:</b> {ex.commonMistake}</div>}
      </div>
    </>
  );
}
