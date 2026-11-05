import { Icons } from "./icons";
import { CountUp } from "./motion";

/* Level and milestones. Quiet: a thin bar that fills, light numbers, one orange accent. */

export interface LevelView {
  points: number;
  level: number;
  name: string;
  from: number;
  next: number | null;
  nextName: string | null;
  progress: number;
  thisWeek: number;
}

export interface MilestoneView {
  id: string;
  title: string;
  sub: string;
  need: number;
  have: number;
  earned: boolean;
  at: string | null;
}

const n = (x: number) => Math.round(x).toLocaleString("en-GB");

/** One slim row for Today: level, name and the bar to the next level. */
export function LevelRow({ level, onOpen }: { level: LevelView; onOpen?: () => void }) {
  const body = (
    <>
      <span className="lv-badge num" aria-hidden="true">{level.level}</span>
      <span className="grow">
        <span className="lv-top"><b>{level.name}</b><small className="num">{level.next ? `${n(level.next - level.points)} to ${level.nextName}` : "Top level"}</small></span>
        <span className="lv-bar"><i style={{ ["--p" as string]: level.progress }} /></span>
      </span>
      {onOpen && <Icons.forward width={16} height={16} />}
    </>
  );
  const label = `Level ${level.level}, ${level.name}. ${n(level.points)} points.`;
  return onOpen ? <button className="lv-row" onClick={onOpen} aria-label={`${label} Open levels`}>{body}</button> : <div className="lv-row" aria-label={label}>{body}</div>;
}

/** The level up close, for the levels sheet. */
export function LevelCard({ level }: { level: LevelView }) {
  return (
    <div className="lv-card">
      <div className="lv-eyebrow">Level {level.level}</div>
      <div className="lv-name">{level.name}</div>
      <div className="lv-points"><b className="num"><CountUp value={level.points} format={n} /></b><span>points</span></div>
      <span className="lv-bar lg"><i style={{ ["--p" as string]: level.progress }} /></span>
      <div className="lv-foot">
        <span>{level.next ? <>Next: <b>{level.nextName}</b> at {n(level.next)}</> : "You've reached the top."}</span>
        {level.thisWeek > 0 && <span className="lv-week">+{n(level.thisWeek)} this week</span>}
      </div>
    </div>
  );
}

/** Milestones as a list: the next ones with how close, the earned ones with their day. */
export function MilestoneList({ list, onShare }: { list: MilestoneView[]; onShare?: (m: MilestoneView) => void }) {
  return (
    <ul className="ms-list">
      {list.map((m, i) => (
        <li key={m.id} className={m.earned ? "earned" : ""} style={{ ["--i" as string]: i }}>
          <span className="ms-mark" aria-hidden="true">{m.earned ? <Icons.check width={14} height={14} /> : <Icons.hike width={14} height={14} />}</span>
          <span className="grow">
            <b>{m.title}</b>
            {m.earned ? <small>{m.at ? new Date(`${m.at}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Reached"}</small> : (
              <span className="lv-bar sm"><i style={{ ["--p" as string]: m.have / m.need }} /></span>
            )}
          </span>
          {m.earned && onShare ? <button className="btn ghost sm" onClick={() => onShare(m)} aria-label={`Share ${m.title}`}><Icons.share width={14} height={14} /></button> : !m.earned && <small className="num ms-left">{n(m.have)} / {n(m.need)}</small>}
        </li>
      ))}
    </ul>
  );
}

/** The moment a milestone is reached: shown once on Today. */
export function MilestoneMoment({ m, onShare, onPost, onClose }: { m: MilestoneView & { value: string; unit: string }; onShare: () => void; onPost?: () => void; onClose: () => void }) {
  return (
    <div className="ms-moment" role="status">
      <button className="ms-x" onClick={onClose} aria-label="Dismiss"><Icons.close width={16} height={16} /></button>
      <div className="lv-eyebrow">New milestone</div>
      <div className="ms-big"><b className="num">{m.value}</b><span>{m.unit}</span></div>
      <div className="small">{m.sub}</div>
      <div className="ms-steps" aria-hidden="true"><i /><i /><i /></div>
      <button className="btn act block" onClick={onShare}><Icons.share width={16} height={16} /> Share it</button>
      {onPost && <button className="btn ghost block" onClick={onPost}><Icons.clients width={16} height={16} /> Post to your team</button>}
    </div>
  );
}
