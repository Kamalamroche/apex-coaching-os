import { ANSWER_STARTERS, answerProblem, type CoachAnswer } from "@apex/core";
import { BackLink, Icons, Label, Sheet } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { useExtras } from "../../data/extras";

type Edit = { id?: string; question: string; answer: string };

/** Coach: quick answers. Clients see the closest one the moment they type a question, before it reaches the coach. */
export function CoachAnswers({ onBack, say }: { onBack: () => void; say: (m: string) => void }) {
  const api = useExtras();
  const [list, setList] = useState<CoachAnswer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const reload = useCallback(async () => {
    if (!api) return;
    try { setList(await api.answers.list()); setError(null); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);
  if (!api) return null;

  const save = async () => {
    if (!edit) return;
    const p = answerProblem(edit);
    if (p) return say(p);
    try { await api.answers.save(edit); setEdit(null); await reload(); say("Answer saved"); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
  };
  const remove = async (a: CoachAnswer) => {
    if (!confirm(`Delete "${a.question}"?`)) return;
    try { await api.answers.remove(a.id); await reload(); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
  };
  const addStarters = async () => {
    try { for (const a of ANSWER_STARTERS) await api.answers.save(a); await reload(); say(`${ANSWER_STARTERS.length} answers added. Edit them into your own words`); }
    catch (e) { say(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <>
      <BackLink onClick={onBack}>Messages</BackLink>
      <div><div className="eyebrow">Messages</div><h1 className="h1">Quick answers</h1></div>
      <p className="small" style={{ margin: 0 }}>Answer the questions clients ask again and again. When a client asks something close in their Messages, your answer shows straight away. If none fits, their question comes to you as a normal message. Only your own words are shown.</p>
      {error && <div className="card small">{error}</div>}
      {list && list.length === 0 && (
        <div className="card small">
          No answers yet.
          <div style={{ marginTop: 10 }}><button className="btn ghost" onClick={() => void addStarters()}>Add {ANSWER_STARTERS.length} common ones to edit</button></div>
        </div>
      )}
      {list && list.length > 0 && (
        <ul className="sr-list" style={{ maxHeight: "none" }}>
          {list.map((a) => (
            <li key={a.id} className="sr-item">
              <button className="sr-use" onClick={() => setEdit(a)}><b>{a.question}</b><span>{a.answer}</span></button>
              <div className="sr-tools"><button className="iconbtn" aria-label={`Delete ${a.question}`} onClick={() => void remove(a)}><Icons.trash width={15} height={15} /></button></div>
            </li>
          ))}
        </ul>
      )}
      {!error && <button className="btn act block" onClick={() => setEdit({ question: "", answer: "" })}><Icons.plus width={16} height={16} /> New answer</button>}
      {edit && (
        <Sheet label={edit.id ? "Edit answer" : "New answer"} onClose={() => setEdit(null)}>
          <div className="stack" style={{ gap: 10 }}>
            <div className="sect" style={{ margin: 0 }}><h2 className="h2">{edit.id ? "Edit answer" : "New answer"}</h2><Label kind="dec">Coach decision</Label></div>
            <input className="field" aria-label="Question" maxLength={160} placeholder="The question, as a client would ask it" value={edit.question} onChange={(e) => setEdit({ ...edit, question: e.target.value })} />
            <textarea className="field" aria-label="Your answer" rows={5} maxLength={1500} placeholder="Your answer" value={edit.answer} onChange={(e) => setEdit({ ...edit, answer: e.target.value })} />
            <div className="row">
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn act" style={{ flex: 1 }} onClick={() => void save()}>Save</button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
