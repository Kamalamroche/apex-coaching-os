import { MAX_VIDEO_MB, shortDate, videoProblem } from "@apex/core";
import { Icons, Sheet } from "@apex/ui";
import { useEffect, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { FormVideo } from "../../app/FormVideo";
import { useFormCheckStore, useFormChecks } from "../../data/FormCheckContext";

/** Film a set (or pick a video) and send it to the coach with a question. */
export function FormCheckSheet({ exerciseId, exercise, onClose, onSent }: { exerciseId: number | null; exercise: string; onClose: () => void; onSent: () => void }) {
  const store = useFormCheckStore();
  const { coachName } = useAppInfo();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const problem = videoProblem(f);
    setErr(problem);
    if (problem) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const send = async () => {
    if (!file) return;
    setSending(true);
    setErr(null);
    try {
      await store.submit({ exerciseId, exercise, note, file });
      onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send the video. Check your connection and try again.");
      setSending(false);
    }
  };

  return (
    <Sheet onClose={sending ? () => {} : onClose} label="Form check">
      <div className="stack">
        <div><div className="eyebrow">Form check</div><h2 className="h2" style={{ marginTop: 4 }}>{exercise}</h2><div className="small" style={{ marginTop: 4 }}>Film one set from the side, whole body in view. {coachName} watches it and replies with notes.</div></div>
        {preview ? (
          <>
            <video className="fc-video" src={preview} controls playsInline aria-label="Your video" />
            <button className="link" style={{ alignSelf: "flex-start" }} disabled={sending} onClick={() => { setFile(null); setPreview(null); }}>Choose a different video</button>
          </>
        ) : (
          <div className="fc-pick">
            <label className="btn act"><Icons.camera width={18} height={18} /> Film now<input type="file" accept="video/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} /></label>
            <label className="btn ghost"><Icons.upload width={18} height={18} /> Choose a video<input type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => pick(e.target.files?.[0])} /></label>
          </div>
        )}
        <textarea id="fc-note" className="field" rows={2} maxLength={1000} placeholder={`Question for ${coachName}, e.g. Is my back staying flat?`} value={note} onChange={(e) => setNote(e.target.value)} />
        {err && <div className="small" style={{ color: "var(--crit)" }}>{err}</div>}
        <button className="btn act block" style={{ minHeight: 50 }} disabled={!file || sending} onClick={() => void send()}>{sending ? "Uploading…" : `Send to ${coachName}`}</button>
        <div className="tiny" style={{ textAlign: "center" }}>Up to {MAX_VIDEO_MB} MB, about a minute. Only {coachName} can see it.</div>
      </div>
    </Sheet>
  );
}

/** The client's form checks and the coach's notes on them. */
export function FormCheckList({ say }: { say: (m: string) => void }) {
  const store = useFormCheckStore();
  const { checks, status, error } = useFormChecks();
  const { coachName } = useAppInfo();
  return (
    <>
      <div><div className="eyebrow">Form checks</div><h1 className="h1">Your technique videos</h1><p className="sub">Film a set from the workout screen with "Film my form". {coachName}'s notes appear here.</p></div>
      {status === "loading" && <div className="card small">Loading…</div>}
      {status === "needs-update" && <div className="card small">Form checks aren't switched on yet. {coachName} needs to finish the latest update.</div>}
      {status === "error" && <div className="card small">Couldn't load your videos: {error}</div>}
      {status === "ready" && checks.length === 0 && <div className="card small">No videos yet. Next workout, tap "Film my form" on any exercise.</div>}
      {checks.map((c) => (
        <section key={c.id} className="card stack" style={{ gap: 10 }}>
          <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">{c.exercise}</h3><span className="tiny">{shortDate(c.createdAt)}</span></div>
          <FormVideo check={c} />
          {c.note && <div className="small" style={{ color: "var(--text)" }}>“{c.note}”</div>}
          {c.coachReply ? (
            <div className="fc-reply"><div className="tiny">{coachName} replied</div><div className="small" style={{ color: "var(--text)", whiteSpace: "pre-wrap" }}>{c.coachReply}</div></div>
          ) : c.reviewedAt ? <div className="tiny">Seen by {coachName}</div> : (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="tiny">Waiting for {coachName}</span>
              <button className="link" onClick={() => void store.remove(c.id).then(() => say("Video deleted"), (e: Error) => say(e.message))}>Delete</button>
            </div>
          )}
        </section>
      ))}
    </>
  );
}
