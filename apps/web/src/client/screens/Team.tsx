import { HERO_IMAGES, heroForPost, postFigure, type TeamDraft } from "@apex/core";
import { EffortBoard, Icons, TeamFeed, TeamHero, type IconName } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { InviteFriend } from "../../app/GrowthParts";
import { PostToTeam, TeamStatus, useTeam, useTeamSuggestions } from "../../app/TeamParts";
import { effortWeekLabel, useTeamApi } from "../../data/team";

const RULES: [IconName, string, string][] = [
  ["check", "You choose", "Only what you post. Nothing is shared by itself."],
  ["five", "High fives", "Cheer each other on after every session."],
  ["progress", "Effort only", "Workouts and minutes. Never weight or photos."],
  ["clients", "Private", "Only your coach and the team. Leave any time."],
];

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
  const fives = data.posts.reduce((a, p) => a + p.fives, 0);
  const people = new Set(data.effort.map((l) => l.name)).size;
  const joined = data.status === "ready" && data.joined;
  return (
    <>
      <TeamHero
        eyebrow={joined ? effortWeekLabel() : "Private team"}
        title={`${coachName}'s team`}
        pills={joined ? [{ icon: "clients", text: `${people} training` }, { icon: "five", text: `${fives} high fives` }] : [{ icon: "clients", text: `Coached by ${coachName}` }]}
      >
        {data.status === "ready" && !data.joined && <button className="btn act block" style={{ minHeight: 50 }} onClick={() => void act(() => api.join(), `You're in · ${coachName}'s team`)}>Join the team</button>}
      </TeamHero>
      <TeamStatus data={data} />
      {data.status === "ready" && !data.joined && (
        <ul className="tm-rules">
          {RULES.map(([icon, t, s], i) => { const I = Icons[icon]; return <li key={t} style={{ ["--i" as string]: i }}><I width={18} height={18} /><b>{t}</b>{s}</li>; })}
        </ul>
      )}
      {joined && (
        <>
          {ideas.length > 0 && (
            <section className="stack" style={{ gap: 8 }}>
              <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Post to the team</h2><span className="tiny">You see it first</span></div>
              <div className="tm-suggest">
                {ideas.map((x, i) => {
                  const hero = heroForPost(x.draft);
                  const I = Icons[x.icon];
                  const fig = hero ? null : postFigure({ kind: x.draft.kind, title: x.draft.title });
                  return (
                    <button key={x.label} className={`tm-idea${hero ? "" : " plain"}`} style={{ ["--i" as string]: i }} onClick={() => setDraft(x.draft)}>
                      {hero && <img src={HERO_IMAGES[hero].src} alt="" style={{ objectPosition: HERO_IMAGES[hero].focus }} />}
                      <span className="tm-plus" aria-hidden="true"><Icons.plus width={15} height={15} /></span>
                      {fig && <span className="tm-idea-fig num">{fig.value}</span>}
                      <small><I width={12} height={12} /> {x.draft.kind}</small>
                      <b>{x.label}</b>
                    </button>
                  );
                })}
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
          <InviteFriend say={say} />
          <button className="btn ghost sm" style={{ alignSelf: "center" }} onClick={() => { if (window.confirm(`Leave ${coachName}'s team? Your posts stay until you remove them.`)) void act(() => api.leave(), "You left the team"); }}>Leave the team</button>
        </>
      )}
      {draft && <PostToTeam draft={draft} say={say} onClose={() => { setDraft(null); void data.reload(); }} />}
    </>
  );
}
