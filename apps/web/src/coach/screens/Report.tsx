import { firstName, localDate, progressReport, reportMessage } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Label, ReportHero, ReportView } from "@apex/ui";
import { useMemo, useState } from "react";
import { useLifestyle } from "../../data/LifestyleContext";
import { useStore } from "../../data/StoreContext";

/** One client's last four weeks, with the coach's note on top, sent to them as a chat message in one tap. */
export function ClientReport({ clientName, say }: { clientName: string; say: (m: string) => void }) {
  const store = useStore();
  const { history, progress } = useApexState(store);
  const life = useLifestyle();
  const first = firstName(clientName);
  const today = localDate(new Date());
  const report = useMemo(
    () => progressReport({ sessions: history.sessions ?? [], measurements: progress.measurements, checkIns: progress.checkIns, habits: life.habits, ticks: life.ticks, today }),
    [history.sessions, progress.measurements, progress.checkIns, life.habits, life.ticks, today],
  );
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(false);
  const [sent, setSent] = useState(false);
  const text = reportMessage(report, first, note);
  const send = () => {
    store.sendMessage("coach", text);
    setSent(true);
    say(`Report sent to ${first}`);
  };

  return (
    <>
      <ReportHero name={clientName} label={report.label} />
      <ReportView report={report} />
      <section className="rp-send">
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">Your note to {first}</h2><Label kind="dec">Coach decision</Label></div>
        <textarea className="field" placeholder={`A few words in your own voice, e.g. "Great month, ${first}. Next we push the squat."`} value={note} maxLength={800} onChange={(e) => { setNote(e.target.value); setSent(false); }} aria-label={`Note to ${first}`} />
        <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => setPreview((p) => !p)}>{preview ? "Hide what they'll see" : "See what they'll get"}</button>
        {preview && <div className="rp-preview">{text}</div>}
        <button className="btn act block" disabled={sent} onClick={send}>{sent ? `Sent to ${first}` : `Send report to ${first}`}</button>
        <div className="tiny">It arrives in your chat with {first}. Nothing is sent until you press the button.</div>
      </section>
    </>
  );
}
