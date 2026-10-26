import { muscleHighlights, type Exercise } from "@apex/core";
import { Icons, MuscleMap } from "@apex/ui";

const overline = { font: "600 10.5px/1 var(--ui)", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text3)" } as const;
const hairline = "1px solid var(--line)";

export function ExerciseCard({ exercise: ex }: { exercise: Exercise }) {
  const [primary, ...supporting] = ex.muscles;
  const steps = ex.steps ?? [];
  return (
    <>
      <div className="video"><span className="tag label l-data">Demo video</span><Icons.figure /></div>

      <header>
        <div style={{ ...overline, color: "var(--act)" }}>{[ex.category, ex.equipment, ex.type].join("  ·  ")}</div>
        <h2 className="h1" style={{ fontSize: 26, marginTop: 8, letterSpacing: "-.01em" }}>{ex.name}</h2>
        <div className="small" style={{ marginTop: 4 }}>{ex.pattern} pattern</div>
      </header>

      {primary && (
        <div className="card" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr)", gap: 18, alignItems: "center", padding: "18px 16px" }}>
          <MuscleMap lit={muscleHighlights(ex.muscles)} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={overline}>Target</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--act)", boxShadow: "0 0 0 4px var(--act-soft)" }} />
                <span className="h3">{primary}</span>
              </div>
            </div>
            {supporting.length > 0 && (
              <div style={{ borderTop: hairline, paddingTop: 14 }}>
                <div style={overline}>Also working</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {supporting.map((m) => (
                    <span key={m} className="small" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "color-mix(in srgb,var(--blue) 50%,transparent)" }} />{m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {steps.length > 0 && (
        <section>
          <div style={{ ...overline, marginBottom: 6 }}>Technique</div>
          <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {steps.map((s, i) => (
              <li key={s} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 10, padding: "12px 0", borderTop: i ? hairline : "none" }}>
                <span style={{ font: "500 13px/1.5 var(--num)", color: "var(--act)" }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ lineHeight: 1.5 }}>{s}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <div style={{ ...overline, marginBottom: 10 }}>Coach's notes</div>
        {ex.cues.length ? (
          <div style={{ borderLeft: "2px solid var(--act)", paddingLeft: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {ex.cues.map((c) => <div key={c} style={{ lineHeight: 1.5 }}>{c}</div>)}
          </div>
        ) : (
          <div className="small">Notes for this movement are on the way. Ask your coach if you're unsure how to do it.</div>
        )}
        {ex.commonMistake && (
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: "var(--r)", background: "var(--crit-soft)" }}>
            <div style={{ ...overline, color: "var(--crit)" }}>Watch out for</div>
            <div style={{ marginTop: 6 }}>{ex.commonMistake}</div>
          </div>
        )}
      </section>
    </>
  );
}
