import { CHALLENGE_PRESETS, challengeFromPreset, challengePhase, challengeProblem, localDate, parseNumber, type Challenge } from "@apex/core";
import { BackLink, Icons, Label, NumberField } from "@apex/ui";
import { useState } from "react";
import { ChallengeCard, ChallengeStatus, useChallenges } from "../../app/ChallengeParts";
import { useChallengeApi } from "../../data/challenges";

/** Coach: start challenges for all clients and follow the leaderboards. */
export function CoachChallenges({ onBack, say }: { onBack: () => void; say: (m: string) => void }) {
  const api = useChallengeApi();
  const data = useChallenges(api);
  const [draft, setDraft] = useState<Challenge | null>(null);
  if (!api) return null;
  const today = localDate(new Date());

  const remove = async (c: Challenge) => {
    try {
      await api.remove(c.id);
      say("Challenge removed");
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
    }
    await data.reload();
  };

  if (draft) return <Editor initial={draft} isNew={!data.challenges.some((x) => x.id === draft.id)} onCancel={() => setDraft(null)} onSave={async (c) => { await api.save(c); setDraft(null); say(data.challenges.some((x) => x.id === c.id) ? "Challenge saved" : "Challenge started · clients can join from More"); await data.reload(); }} onBack={onBack} />;
  return (
    <>
      <BackLink onClick={onBack}>Messages</BackLink>
      <div><div className="eyebrow">Challenges</div><h1 className="h1">Get everyone moving</h1></div>
      <ChallengeStatus data={data} />
      {data.status === "ready" && (
        <section className="card stack">
          <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Start a challenge</h3></div>
          <div className="chips" style={{ flexWrap: "wrap" }}>
            {CHALLENGE_PRESETS.map((p, i) => <button key={p.title} className="chip" onClick={() => setDraft(challengeFromPreset(i, today))}><Icons.plus width={12} height={12} /> {p.title}</button>)}
            <button className="chip" onClick={() => setDraft({ ...challengeFromPreset(1, today), title: "", description: "", unit: "", goal: null })}><Icons.plus width={12} height={12} /> Your own</button>
          </div>
        </section>
      )}
      {data.challenges.map((c) => (
        <ChallengeCard key={c.id} c={c} board={data.boards[c.id] ?? []}>
          <div className="row" style={{ gap: 8, justifyContent: "space-between" }}>
            <span className="tiny">{(data.boards[c.id] ?? []).length} joined</span>
            <span className="row" style={{ gap: 6 }}>
              {challengePhase(c, today) !== "ended" && <button className="iconbtn" onClick={() => setDraft(c)}>Edit</button>}
              <button className="iconbtn" aria-label={`Remove ${c.title}`} onClick={() => void remove(c)}><Icons.trash width={15} height={15} /></button>
            </span>
          </div>
        </ChallengeCard>
      ))}
    </>
  );
}

function Editor({ initial, isNew, onSave, onCancel, onBack }: { initial: Challenge; isNew: boolean; onSave: (c: Challenge) => Promise<void>; onCancel: () => void; onBack: () => void }) {
  const [c, setC] = useState(initial);
  const [goal, setGoal] = useState(initial.goal !== null ? String(initial.goal) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const next = { ...c, goal: goal.trim() ? parseNumber(goal) : null };
    const problem = challengeProblem(next);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await onSave(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <>
      <BackLink onClick={onBack}>Messages</BackLink>
      <section className="card stack">
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">{isNew ? "New challenge" : "Edit challenge"}</h2><Label kind="dec">Coach decision</Label></div>
        <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>Name<input className="field" maxLength={80} value={c.title} placeholder="e.g. Plank every day" onChange={(e) => setC({ ...c, title: e.target.value })} /></label>
        <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>What it's about<textarea className="field" rows={2} maxLength={500} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} /></label>
        <div>
          <div className="tiny" style={{ marginBottom: 6 }}>What counts</div>
          <div className="chips">
            <button type="button" className={`chip ${c.metric === "sessions" ? "on" : ""}`} aria-pressed={c.metric === "sessions"} onClick={() => setC({ ...c, metric: "sessions", unit: "sessions" })}>Finished workouts</button>
            <button type="button" className={`chip ${c.metric === "logged" ? "on" : ""}`} aria-pressed={c.metric === "logged"} onClick={() => setC({ ...c, metric: "logged", unit: c.unit === "sessions" ? "" : c.unit })}>A number they log</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
          {c.metric === "logged" && <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>Unit<input className="field" maxLength={16} placeholder="steps, km, minutes" value={c.unit} onChange={(e) => setC({ ...c, unit: e.target.value })} /></label>}
          <NumberField id="ch-goal" label="Goal each (optional)" unit={c.unit || ""} value={goal} onChange={setGoal} />
          <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>Starts<input type="date" className="field" value={c.startsOn} onChange={(e) => setC({ ...c, startsOn: e.target.value })} /></label>
          <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>Ends<input type="date" className="field" value={c.endsOn} min={c.startsOn} onChange={(e) => setC({ ...c, endsOn: e.target.value })} /></label>
        </div>
        <div className="tiny">The leaderboard shows first names and an initial only. Clients choose whether to join.</div>
        {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn act grow" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : isNew ? "Start challenge" : "Save challenge"}</button>
        </div>
      </section>
    </>
  );
}
