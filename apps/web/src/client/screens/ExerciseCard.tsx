import { muscleHighlights, type Exercise } from "@apex/core";
import { Icons, MuscleMap } from "@apex/ui";

export function ExerciseCard({ exercise: ex }: { exercise: Exercise }) {
  const [primary, ...supporting] = ex.muscles;
  const steps = ex.steps ?? [];
  let n = 0;
  const num = () => String(++n).padStart(2, "0");
  return (
    <article className="card exc">
      <div className="ex-stage">
        {ex.video ? (
          <div className="video clip">
            <Icons.figure />
            <video src={ex.video.src} autoPlay muted loop playsInline preload="metadata" aria-label={`${ex.name} demonstration`} />
            <span className="tag label l-data">Demo video</span>
            {primary && <span className="target"><i />Target · {primary}</span>}
          </div>
        ) : (
          <div className="video"><span className="tag label l-data">Demo video</span><Icons.figure /></div>
        )}
      </div>

      <div className="ex-body">
        <header>
          <div className="ex-over" style={{ color: "var(--act)" }}>{[ex.category, ex.equipment, ex.type].join("  ·  ")}</div>
          <h2 className="h1" style={{ marginTop: 8 }}>{ex.name}</h2>
          <div className="small" style={{ marginTop: 4 }}>{ex.pattern} pattern</div>
        </header>

        {primary && (
          <section className="ex-sect">
            <div className="ex-over"><b>{num()}</b>Anatomy</div>
            <div className="ex-anat">
              <MuscleMap lit={muscleHighlights(ex.muscles)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div className="ex-over">Target</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--act)", boxShadow: "0 0 0 4px var(--act-soft)" }} />
                    <span className="h3">{primary}</span>
                  </div>
                </div>
                {supporting.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--line2)", paddingTop: 12 }}>
                    <div className="ex-over">Also working</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {supporting.map((m) => (
                        <span key={m} className="small" style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="ex-dot" />{m}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {steps.length > 0 && (
          <section className="ex-sect">
            <div className="ex-over"><b>{num()}</b>Technique</div>
            <ol className="ex-steps">
              {steps.map((s, i) => (
                <li key={s}><span>{String(i + 1).padStart(2, "0")}</span><span>{s}</span></li>
              ))}
            </ol>
          </section>
        )}

        <section className="ex-sect">
          <div className="ex-over"><b>{num()}</b>Coach's notes</div>
          {ex.cues.length ? (
            <div className="ex-cues">{ex.cues.map((c) => <div key={c}>{c}</div>)}</div>
          ) : (
            <div className="small">Notes for this movement are on the way. Ask your coach if you're unsure how to do it.</div>
          )}
          {ex.commonMistake && (
            <div className="ex-warn">
              <div className="ex-over">Watch out for</div>
              {ex.commonMistake}
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
