import type { TeamDraft } from "@apex/core";
import { EffortBoard, Icons, TeamFeed } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { PostToTeam, TeamStatus, useTeam, useTeamSuggestions } from "../../app/TeamParts";
import { effortWeekLabel, useTeamApi } from "../../data/team";

/** Client: the coach's private team. Join, post what you choose, give high fives, see this week's effort. */
export function Team({ say }: { say: (m: string) => void }) {
  const api = useTeamApi();
  const data = useTeam(api);
  const { coachName } = useAppInfo();
  const ideas = useTeamSuggestions();
  const [draft, setDraft] = useState<TeamDraft | null>(null);
  if (!api) return null;
  const act = async (fn: () => Promise<void>, done: string) => {
    try { await fn(); say(done); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    await data.reload();
  };
  return (
    <>
      <div><div className="eyebrow">Team</div><h1 className="h1">{coachName}'s team</h1></div>
      <TeamStatus data={data} />
      {data.status === "ready" && !data.joined && (
        <section className="card stack">
          <span className="tm-kind" aria-hidden="true"><Icons.clients width={20} height={20} /></span>
          <div className="h3">Train alongside {coachName}'s other clients</div>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            <li>You choose what to post: a finished workout, a milestone, your week's distance.</li>
            <li>Give and get high fives. Your name shows as first name and initial.</li>
            <li>The weekly board counts effort only. Never weight, measurements or photos.</li>
            <li>Only {coachName} and the team can see it. Leave any time.</li>
          </ul>
          <button className="btn act block" onClick={() => void act(() => api.join(), `You're in · ${coachName}'s team`)}>Join the team</button>
        </section>
      )}
      {data.status === "ready" && data.joined && (
        <>
          {ideas.length > 0 && (
            <section className="stack" style={{ gap: 8 }}>
              <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Post to the team</h2></div>
              <div className="tm-suggest">
                {ideas.map((x) => { const I = Icons[x.icon]; return <button key={x.label} onClick={() => setDraft(x.draft)}><I width={15} height={15} /> {x.label}</button>; })}
              </div>
            </section>
          )}
          <EffortBoard lines={data.effort} week={effortWeekLabel()} />
          <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Latest</h2></div>
          {data.posts.length ? (
            <TeamFeed posts={data.posts} onFive={data.five} canRemove={(p) => p.isMe} onRemove={(p) => { if (window.confirm("Remove your post?")) void act(() => api.remove(p.id), "Post removed"); }} />
          ) : (
            <div className="card small">Nothing yet. Finish a workout and be the first to post.</div>
          )}
          <button className="btn ghost sm" style={{ alignSelf: "center" }} onClick={() => { if (window.confirm(`Leave ${coachName}'s team? Your posts stay until you remove them.`)) void act(() => api.leave(), "You left the team"); }}>Leave the team</button>
        </>
      )}
      {draft && <PostToTeam draft={draft} say={say} onClose={() => { setDraft(null); void data.reload(); }} />}
    </>
  );
}
