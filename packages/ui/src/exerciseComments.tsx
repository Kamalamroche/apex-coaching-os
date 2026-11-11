import { Icons } from "./icons";
import "./exerciseComments.css";

/** The exercise a message is about, as a small tag over the bubble: "Back Squat · set 3". */
export function CommentTag({ exercise, set, voice }: { exercise: string; set: number | null; voice?: boolean }) {
  return (
    <span className="xc-tag">
      {voice ? <Icons.mic width={12} height={12} /> : <Icons.chat width={12} height={12} />}
      <span>{exercise}{set ? <i> · set {set}</i> : null}</span>
    </span>
  );
}

/** Comments from one session, grouped by exercise. */
export function CommentList({ groups, title = "Comments on exercises" }: { groups: { exercise: string; comments: { set: number | null; text: string; voice?: boolean }[] }[]; title?: string }) {
  return (
    <div className="xc-list">
      <div className="xc-head"><Icons.chat width={15} height={15} /><b>{title}</b></div>
      {groups.map((g) => (
        <div key={g.exercise} className="xc-group">
          <div className="xc-ex">{g.exercise}</div>
          {g.comments.map((c, i) => (
            <div key={i} className="xc-line">
              <span className="xc-set num">{c.set ? `Set ${c.set}` : "All"}</span>
              <span className="xc-text">{c.voice ? <><Icons.mic width={12} height={12} /> Voice note, in your messages</> : `“${c.text}”`}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
