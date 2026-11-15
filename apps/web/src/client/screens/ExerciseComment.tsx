import { COMMENT_IDEAS, COMMENT_MAX, VOICE_MIN_SECONDS, commentMessage, commentProblem, voiceClock, voiceCommentMessage, type ExerciseComment } from "@apex/core";
import { CommentTag, Icons, Sheet } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { canRecord, useVoiceRecorder } from "../../app/voice";
import { useStore } from "../../data/StoreContext";

/** Client, mid-workout: a quick comment or voice note on this exercise. The coach gets it straight away,
    tagged with the exercise and set, and it is listed again in the session summary. */
export function ExerciseCommentSheet({ exerciseId, exercise, set, onClose, onSent }: {
  exerciseId: number; exercise: string; set: number | null; onClose: () => void; onSent: (c: ExerciseComment) => void;
}) {
  const store = useStore();
  const { coachName } = useAppInfo();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const coach = coachName || "your coach";

  const send = () => {
    const p = commentProblem(text);
    if (p) return setError(p);
    const c: ExerciseComment = { exerciseId, exercise, set, text: text.trim() };
    store.sendMessage("client", commentMessage(c));
    onSent(c);
  };

  const voice = useVoiceRecorder((audio, seconds) => {
    if (seconds < VOICE_MIN_SECONDS) { setError("Hold on a little longer to record."); return; }
    if (!store.sendVoice) return;
    setSending(true);
    store.sendMessage("client", voiceCommentMessage({ exercise, set }));
    store.sendVoice("client", audio, seconds)
      .then(() => onSent({ exerciseId, exercise, set, text: "", voice: true }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't send the voice note"))
      .finally(() => setSending(false));
  });
  const voiceOn = !!store.sendVoice && canRecord();

  return (
    <Sheet label={`Comment on ${exercise}`} onClose={onClose}>
      <div>
        <CommentTag exercise={exercise} set={set} />
        <h2 className="h2">Tell {coach}</h2>
        <p className="small" style={{ margin: "4px 0 0" }}>A quick note on this exercise. {coach} sees it straight away and in your session summary.</p>
      </div>
      <div className="xc-sheet-ideas">
        {COMMENT_IDEAS.map((i) => <button key={i} className={`chip ${text === i ? "on" : ""}`} onClick={() => { setText(i); setError(null); }}>{i}</button>)}
      </div>
      {voice.recording ? (
        <div className="vn-rec" role="status" aria-live="polite">
          <span className="vn-dot" aria-hidden />
          <span className="grow small">Recording · <span className="num">{voiceClock(voice.seconds)}</span> of 2:00</span>
          <button className="btn ghost" onClick={voice.cancel}>Cancel</button>
          <button className="btn act" onClick={voice.send} aria-label="Send voice note"><Icons.send width={16} height={16} /></button>
        </div>
      ) : (
        <>
          <textarea className="field" rows={3} maxLength={COMMENT_MAX} placeholder="How did it feel? Anything hurt, too light, unsure about form…" value={text} onChange={(e) => { setText(e.target.value); setError(null); }} autoFocus />
          {error && <p className="small" role="alert" style={{ margin: 0, color: "var(--crit)" }}>{error}</p>}
          <div className="row" style={{ gap: 8 }}>
            {voiceOn && <button className="btn ghost" disabled={sending} onClick={() => void voice.start().catch(() => setError("Allow the microphone for this site to send voice notes."))}><Icons.mic width={16} height={16} /> {sending ? "Sending…" : "Voice note"}</button>}
            <button className="btn act grow" disabled={!text.trim() || sending} onClick={send}><Icons.send width={16} height={16} /> Send to {coach}</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
