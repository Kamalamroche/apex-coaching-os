import { matchAnswers, type CoachAnswer } from "@apex/core";
import { AnswerHit, Avatar, Icons, Label } from "@apex/ui";
import { useEffect, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { Thread } from "../../app/Thread";
import { useExtras } from "../../data/extras";
import { useStore } from "../../data/StoreContext";

export function Chat({ say }: { say?: (m: string) => void }) {
  const { coachName } = useAppInfo();
  return (
    <>
      <div className="row"><Avatar initials={coachName.slice(0, 1).toUpperCase()} tone="var(--act)" /><div><h1 className="h1" style={{ fontSize: 20 }}>Coach {coachName}</h1><div className="tiny">Usually replies within a few hours</div></div></div>
      <Ask say={say} />
      <Thread me="client" to={coachName} say={say} />
    </>
  );
}

/** "Ask": the client types a question and sees the coach's own written answers that fit, straight away.
    Nothing fits, or not quite? It goes to the coach as a normal message. Word matching only, no AI. */
function Ask({ say }: { say?: (m: string) => void }) {
  const api = useExtras();
  const store = useStore();
  const { coachName } = useAppInfo();
  const [answers, setAnswers] = useState<CoachAnswer[] | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!api) return;
    api.answers.list().then(setAnswers, () => setAnswers([]));
  }, [api]);
  if (!api || !answers?.length) return null;
  const hits = q.trim().length >= 3 ? matchAnswers(q, answers) : [];
  const send = () => {
    const t = q.trim();
    if (!t) return;
    store.sendMessage("client", t);
    setQ("");
    setOpen(false);
    say?.(`Sent to ${coachName}`);
  };
  if (!open) {
    return (
      <button className="card flat li" style={{ width: "100%", textAlign: "left" }} onClick={() => setOpen(true)}>
        <Icons.replies width={18} height={18} style={{ color: "var(--act)" }} />
        <div className="grow"><div className="h3">Got a question?</div><div className="tiny">See {coachName}'s answers straight away</div></div>
        <span className="tiny">›</span>
      </button>
    );
  }
  return (
    <div className="xq-ask">
      <div className="sect" style={{ margin: 0 }}><h2 className="h3">Ask {coachName}</h2><button className="iconbtn" onClick={() => { setOpen(false); setQ(""); }}>Close</button></div>
      <input className="field" autoFocus aria-label="Your question" placeholder="e.g. What if I miss a session?" value={q} onChange={(e) => setQ(e.target.value)} />
      {hits.length > 0 && (
        <>
          <div className="row" style={{ justifyContent: "space-between" }}><span className="tiny">{coachName} has answered this</span><Label kind="dec">Written by {coachName}</Label></div>
          {hits.map((a, i) => <AnswerHit key={a.id} i={i} question={a.question} answer={a.answer} />)}
        </>
      )}
      {q.trim().length >= 3 && hits.length === 0 && <div className="tiny">No saved answer for that yet. Send it and {coachName} will reply.</div>}
      {q.trim().length >= 3 && (
        <button className={`btn ${hits.length ? "ghost" : "act"} block`} onClick={send}><Icons.send width={15} height={15} /> {hits.length ? `Still unsure? Send to ${coachName}` : `Send to ${coachName}`}</button>
      )}
    </div>
  );
}
