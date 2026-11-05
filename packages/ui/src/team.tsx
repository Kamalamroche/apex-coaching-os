import { agoText, rankEffort, type EffortLine, type TeamDraft, type TeamPost, type TeamPostKind } from "@apex/core";
import { useState } from "react";
import { Icons, type IconName } from "./icons";

/* Team feed and effort board. Calm cards, one orange accent for the coach and for high fives. */

const KIND: Record<TeamPostKind, [IconName, string]> = {
  workout: ["train", "Workout"], milestone: ["trophy", "Milestone"], distance: ["run", "Distance"],
  streak: ["flame", "Streak"], level: ["spark", "Level"], note: ["note", "Coach note"],
};

const initials = (name: string) => name.replace(/\./g, "").split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();

/** One post: who, when, what, and the high five. */
export function TeamPostItem({ p, onFive, onRemove, now, i = 0 }: { p: TeamPost; onFive?: () => void; onRemove?: () => void; now?: Date; i?: number }) {
  const [icon, label] = KIND[p.kind];
  const I = Icons[icon];
  // Bumps on each tap so the hand pops again.
  const [pop, setPop] = useState(0);
  const note = p.kind === "note";
  return (
    <article className={`tm-post${note ? " is-note" : ""}`} style={{ ["--i" as string]: i }}>
      <header className="tm-head">
        <span className={`tm-av${p.isCoach ? " coach" : ""}`} aria-hidden="true">{initials(p.author)}</span>
        <span className="tm-who">
          <b>{p.isMe ? `${p.author} (you)` : p.author}{p.isCoach && <em className="tm-coach">Coach</em>}</b>
          <small>{agoText(p.at, now)}</small>
        </span>
        {onRemove && <button className="tm-rm" onClick={onRemove} aria-label={`Remove ${p.author}'s post`}><Icons.trash width={15} height={15} /></button>}
      </header>
      {note ? (
        <p className="tm-note">{p.title}</p>
      ) : (
        <div className="tm-body">
          <span className="tm-kind" aria-label={label}><I width={18} height={18} /></span>
          <span className="grow"><b>{p.title}</b>{p.detail && <small>{p.detail}</small>}</span>
        </div>
      )}
      {note && p.detail && <small className="tm-detail">{p.detail}</small>}
      <footer className="tm-foot">
        <button
          className={`tm-five${p.iFived ? " on" : ""}`} aria-pressed={p.iFived} disabled={!onFive}
          onClick={() => { setPop((n) => n + 1); onFive?.(); }}
          aria-label={p.iFived ? `Take back your high five (${p.fives})` : `High five ${p.author} (${p.fives})`}
        >
          <Icons.five key={pop} width={16} height={16} className={pop ? "tm-pop" : undefined} />
          <span className="num">{p.fives}</span>
          <span className="tm-five-label">{p.fives === 1 ? "high five" : "high fives"}</span>
        </button>
      </footer>
    </article>
  );
}

export function TeamFeed({ posts, onFive, onRemove, canRemove, now }: { posts: TeamPost[]; onFive?: (id: string) => void; onRemove?: (p: TeamPost) => void; canRemove?: (p: TeamPost) => boolean; now?: Date }) {
  return (
    <div className="tm-feed">
      {posts.map((p, i) => (
        <TeamPostItem key={p.id} p={p} i={i} now={now} onFive={onFive ? () => onFive(p.id) : undefined} onRemove={onRemove && (canRemove?.(p) ?? true) ? () => onRemove(p) : undefined} />
      ))}
    </div>
  );
}

/** Effort only: workouts this week, then active minutes. Never weight or measurements. */
export function EffortBoard({ lines, week, limit = 6 }: { lines: EffortLine[]; week: string; limit?: number }) {
  const ranked = rankEffort(lines);
  const me = ranked.find((l) => l.isMe);
  const top = ranked.slice(0, limit);
  const shown = me && !top.includes(me) ? [...top, me] : top;
  const most = Math.max(1, ...ranked.map((l) => l.minutes));
  return (
    <section className="tm-board" aria-label="Effort this week">
      <div className="tm-board-top"><b>Effort this week</b><small className="num">{week}</small></div>
      {shown.length ? (
        <ol>
          {shown.map((l, i) => (
            <li key={`${l.name}-${i}`} className={l.isMe ? "me" : undefined} style={{ ["--i" as string]: i }}>
              <span className="num tm-place">{l.place}</span>
              <span className="grow">
                <span className="tm-line"><b>{l.isMe ? `${l.name} (you)` : l.name}</b><small className="num">{l.workouts} workout{l.workouts === 1 ? "" : "s"} · {l.minutes} min</small></span>
                <span className="tm-bar"><i style={{ ["--p" as string]: l.minutes / most }} /></span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="tiny" style={{ margin: "8px 0 0" }}>Nobody has trained yet this week.</p>
      )}
      <p className="tm-fine">Workouts and active minutes only. Never weight, measurements or photos.</p>
    </section>
  );
}

/** What the team will see, before it goes. */
export function TeamDraftPreview({ draft, author }: { draft: TeamDraft; author: string }) {
  return <TeamPostItem p={{ id: "draft", ...draft, at: new Date().toISOString(), author, isCoach: false, isMe: false, fives: 0, iFived: false }} />;
}
