import { RATINGS, parseNumber, type CheckInInput, type PhotoUpload, type RatingKey } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { BackLink, RatingPicker } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { MeasureInputs, PoseSlots, blankMeasures, parseMeasures } from "../../app/ProgressParts";
import { useStore } from "../../data/StoreContext";

type Ratings = Record<RatingKey, number | null>;
const noRatings = (): Ratings => Object.fromEntries(RATINGS.map((r) => [r.key, null])) as Ratings;

/** The weekly check-in: body, photos, how the week went, and a few words for the coach. */
export function CheckIn({ onExit, onDone }: { onExit: () => void; onDone: () => void }) {
  const store = useStore();
  const { coachName } = useAppInfo();
  const { progress } = useApexState(store);
  const lastWeight = progress.checkIns.find((c) => c.weightKg !== null)?.weightKg;
  const [weight, setWeight] = useState("");
  const [sleep, setSleep] = useState("");
  const [ratings, setRatings] = useState<Ratings>(noRatings);
  const [measures, setMeasures] = useState(blankMeasures);
  const [showMeasures, setShowMeasures] = useState(false);
  const [photos, setPhotos] = useState<PhotoUpload[]>([]);
  const [words, setWords] = useState({ wins: "", struggles: "", note: "" });
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const weightKg = parseNumber(weight);
  const sleepHours = parseNumber(sleep);
  const answered = weightKg !== null || sleepHours !== null || Object.values(ratings).some((v) => v !== null) || Object.values(words).some((w) => w.trim()) || photos.length > 0;

  const send = async () => {
    setSending(true);
    setErr(null);
    const checkIn: CheckInInput = { weightKg, sleepHours, ...ratings, ...words };
    try {
      await store.submitCheckIn(checkIn, { ...parseMeasures(measures), weightKg }, photos);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send your check-in. Check your connection and try again.");
      setSent(!!(e as { sent?: boolean } | null)?.sent);
      setSending(false);
    }
  };

  return (
    <>
      <BackLink onClick={onExit}>Back</BackLink>
      <div><div className="eyebrow">Weekly check-in</div><h1 className="h1">How was your week?</h1><p className="sub">About two minutes. {coachName} reads every one and uses it to plan next week. Skip anything you don't track.</p></div>

      <section className="card stack">
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">Body</h2></div>
        <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Weight this morning, kg
          <input id="ci-weight" className="field num" inputMode="decimal" placeholder={lastWeight ? `Last time ${lastWeight}` : "e.g. 72.4"} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        {showMeasures ? (
          <MeasureInputs value={measures} onChange={setMeasures} last={progress.measurements} skip={["weightKg"]} />
        ) : (
          <button type="button" className="link" style={{ alignSelf: "flex-start" }} onClick={() => setShowMeasures(true)}>+ Add tape measurements and body fat</button>
        )}
      </section>

      <section className="card stack">
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">Progress photos</h2><span className="tiny">Optional</span></div>
        <PoseSlots value={photos} onChange={setPhotos} />
      </section>

      <section className="card stack">
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">Your week</h2></div>
        <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Average sleep, hours a night
          <input id="ci-sleep" className="field num" inputMode="decimal" placeholder="e.g. 7.5" value={sleep} onChange={(e) => setSleep(e.target.value)} />
        </label>
        {RATINGS.map((r) => (
          <RatingPicker key={r.key} label={r.label} low={r.low} high={r.high} value={ratings[r.key]} onChange={(v) => setRatings((s) => ({ ...s, [r.key]: v }))} />
        ))}
      </section>

      <section className="card stack">
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">In your words</h2></div>
        {([["wins", "Wins this week", "A PR, a good habit, anything you're proud of"], ["struggles", "What was hard?", "Pain, missed sessions, cravings, busy days"], ["note", `Anything else for ${coachName}?`, "Questions, holidays coming up, requests"]] as const).map(([k, label, hint]) => (
          <label key={k} className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {label}
            <textarea id={`ci-${k}`} className="field" rows={2} maxLength={2000} placeholder={hint} value={words[k]} onChange={(e) => setWords((w) => ({ ...w, [k]: e.target.value }))} />
          </label>
        ))}
      </section>

      {err && <div className="card" style={{ borderColor: "var(--crit)", background: "var(--crit-soft)" }}><div className="small" style={{ color: "var(--text)" }}>{err}</div></div>}
      {sent ? (
        <button className="btn act block" style={{ minHeight: 52 }} onClick={onDone}>Done</button>
      ) : (
        <button className="btn act block" style={{ minHeight: 52 }} disabled={!answered || sending} onClick={() => void send()}>
          {sending ? (photos.length ? "Uploading photos…" : "Sending…") : `Send to ${coachName}`}
        </button>
      )}
    </>
  );
}
