import { TEAM_TITLE_MAX } from "@apex/core";
import { BackLink, EffortBoard, TeamFeed, TeamHero } from "@apex/ui";
import { useState } from "react";
import { TeamStatus, useTeam } from "../../app/TeamParts";
import { effortWeekLabel, useTeamApi } from "../../data/team";

/** Coach: post a note to the team, cheer posts on, remove anything that shouldn't be there, see the week's effort. */
export function CoachTeam({ onBack, say }: { onBack: () => void; say: (m: string) => void }) {
  const api = useTeamApi();
  const data = useTeam(api);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!api) return null;
  const act = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try { await fn(); say(done); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
    await data.reload();
  };
  const left = TEAM_TITLE_MAX - note.trim().length;
  return (
    <>
      <BackLink onClick={onBack}>Messages</BackLink>
      <TeamHero
        eyebrow={effortWeekLabel()}
        title="Your team"
        pills={data.status === "ready" ? [{ icon: "clients", text: `${data.effort.length} joined` }, { icon: "train", text: `${data.effort.reduce((a, l) => a + l.workouts, 0)} workouts` }, { icon: "five", text: `${data.posts.reduce((a, p) => a + p.fives, 0)} high fives` }] : []}
      />
      <TeamStatus data={data} />
      {data.status === "ready" && (
        <>
          <section className="card stack">
            <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Note to the team</h3><span className="tiny num" style={left < 0 ? { color: "var(--crit)" } : undefined}>{left}</span></div>
            <textarea className="field" rows={2} placeholder="Big week, team. Rest well this weekend." value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn act block" disabled={busy || !note.trim() || left < 0} onClick={() => void act(async () => { await api.post({ kind: "note", title: note, detail: null }); setNote(""); }, "Posted to the team")}>Post note</button>
            <div className="tiny">Clients join from More, then Team. They choose what to post; the board counts workouts and minutes only.</div>
          </section>
          <EffortBoard lines={data.effort} week={effortWeekLabel()} limit={20} />
          <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Latest</h2></div>
          {data.posts.length ? (
            <TeamFeed posts={data.posts} onFive={data.five} onRemove={(p) => { if (window.confirm(`Remove ${p.author}'s post?`)) void act(() => api.remove(p.id), "Post removed"); }} />
          ) : (
            <div className="card small">No posts yet. Post a note to get things going.</div>
          )}
        </>
      )}
    </>
  );
}
