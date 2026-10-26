import { muscleHighlights, type Exercise } from "@apex/core";
import { Icons, MuscleMap } from "@apex/ui";

const swatch = (color: string) => (
  <span style={{ width: 22, height: 8, borderRadius: 4, background: color, flex: "none" }} />
);

export function ExerciseCard({ exercise: ex }: { exercise: Exercise }) {
  const [primary, ...supporting] = ex.muscles;
  const steps = ex.steps ?? [];
  return (
    <>
      <div className="video"><span className="tag label l-data">Demo video</span><Icons.figure /></div>
      <div>
        <h2 className="h1" style={{ fontSize: 24 }}>{ex.name}</h2>
        <div className="chips" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <span className="chip" style={{ background: "var(--act-soft)", color: "var(--act)", borderColor: "transparent" }}>{ex.category}</span>
          <span className="chip">{ex.equipment}</span>
          <span className="chip">{ex.type}</span>
          <span className="chip">{ex.pattern}</span>
        </div>
      </div>

      {primary && (
        <div className="card">
          <h3 className="h3" style={{ marginBottom: 12 }}>Muscles worked</h3>
          <MuscleMap lit={muscleHighlights(ex.muscles)} />
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 12px", alignItems: "center", marginTop: 14 }}>
            <span className="row" style={{ gap: 8 }}>{swatch("var(--act)")}<b className="small" style={{ color: "var(--text)" }}>Primary</b></span>
            <span className="small">{primary}</span>
            {supporting.length > 0 && (
              <>
                <span className="row" style={{ gap: 8 }}>{swatch("color-mix(in srgb,var(--blue) 55%,transparent)")}<b className="small" style={{ color: "var(--text)" }}>Supporting</b></span>
                <span className="small">{supporting.join(", ")}</span>
              </>
            )}
          </div>
        </div>
      )}

      {steps.length > 0 && (
        <section>
          <div className="eyebrow" style={{ marginBottom: 10 }}>How to do it</div>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {steps.map((s, i) => (
              <li key={s} style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 10, alignItems: "start" }}>
                <span className="num" style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--act-soft)", color: "var(--act)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                <span style={{ paddingTop: 3 }}>{s}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Coaching tips</div>
        {ex.cues.length ? (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {ex.cues.map((c) => (
              <li key={c} style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--act)", marginTop: 8 }} />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="small">Tips for this movement are on the way. Ask your coach if you're unsure how to do it.</div>
        )}
        {ex.commonMistake && <div className="small" style={{ marginTop: 12 }}><b style={{ color: "var(--crit)" }}>Common mistake:</b> {ex.commonMistake}</div>}
      </section>
    </>
  );
}
