import { MEASURES, POSES, beforeAfterPair, bodyChange, measurementSeries, recentBests, shortDate, signedUnit, storyCaption, type MeasureKey, type Pose } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Sheet, cardHeight, drawBeforeAfter, drawBestCard, drawMeasureCard, loadStoryFonts, type CardFormat } from "@apex/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { PlaceDrag, SizeSlider } from "../../app/PlaceDrag";
import { loadPhoto, playIn, shareCards, siteName } from "../../app/shareImage";
import { useStore } from "../../data/StoreContext";
import { PhotoPick, useWeekStory } from "./WeekStory";

type Kind = "photos" | "body" | "best";

/**
 * Share progress as a clean card: before and after, a measurement, or a personal best, in story or post size.
 * Body numbers stay off the card unless the client switches them on, and the face can be left out of photos.
 */
export function ShareProgress({ onClose, openWeek }: { onClose: () => void; openWeek: () => void }) {
  const store = useStore();
  const { progress, history } = useApexState(store);
  const { coachName } = useAppInfo();
  const { story } = useWeekStory();
  const site = siteName();
  const [kind, setKind] = useState<Kind>("photos");
  const [format, setFormat] = useState<CardFormat>("story");
  const [pose, setPose] = useState<Pose>("front");
  const [hideFace, setHideFace] = useState(false);
  const [numbers, setNumbers] = useState<MeasureKey[]>([]);
  const [measure, setMeasure] = useState<MeasureKey>("waistCm");
  const [showValues, setShowValues] = useState(false);
  const [bestIdx, setBestIdx] = useState(0);
  const [showCoach, setShowCoach] = useState(true);
  const [imgs, setImgs] = useState<{ before: HTMLImageElement | null; after: HTMLImageElement | null }>({ before: null, after: null });
  const [fonts, setFonts] = useState(false);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [place, setPlace] = useState(1);
  const [size, setSize] = useState(1);
  const dragged = useRef(false);
  const [status, setStatus] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const coach = showCoach && coachName ? coachName : null;

  const pair = beforeAfterPair(progress.photos, pose);
  const measured = useMemo(() => MEASURES.filter((m) => measurementSeries(progress.measurements, m.key).length >= 2), [progress.measurements]);
  const change = bodyChange(progress.measurements, measure);
  const bests = recentBests(history.sessions ?? []);
  const best = bests[bestIdx];

  useEffect(() => { void loadStoryFonts().then(() => setFonts(true)); }, []);
  useEffect(() => {
    let live = true;
    void Promise.all([loadPhoto(pair?.before.url ?? null), loadPhoto(pair?.after.url ?? null)]).then(([before, after]) => { if (live) setImgs({ before, after }); });
    return () => { live = false; };
  }, [pair?.before.url, pair?.after.url]);
  useEffect(() => { if (measured.length && !measured.some((m) => m.key === measure)) setMeasure(measured[0]!.key); }, [measured, measure]);

  const draw = (cv: HTMLCanvasElement, t: number) => {
    if (kind === "photos" && pair) {
      const lines = numbers.flatMap((k) => {
        const c = bodyChange(progress.measurements, k);
        return c ? [`${signedUnit(c.delta, c.unit)} ${c.label.toLowerCase()}`] : [];
      });
      drawBeforeAfter(cv, { format, before: imgs.before, after: imgs.after, beforeDate: shortDate(pair.before.takenAt), afterDate: shortDate(pair.after.takenAt), weeks: pair.weeks, numbers: lines, hideFace, coach, site, t });
    } else if (kind === "body" && change) {
      drawMeasureCard(cv, { format, photo, place, size, change, series: measurementSeries(progress.measurements, measure), showValues, coach, site, t });
    } else if (kind === "best" && best) {
      drawBestCard(cv, { format, photo, place, size, best, date: shortDate(best.at), coach, site, t });
    } else {
      cv.width = 1080;
      cv.height = cardHeight(format);
      const c = cv.getContext("2d");
      if (c) { c.fillStyle = "#0D0F13"; c.fillRect(0, 0, cv.width, cv.height); }
    }
  };

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    if (dragged.current) { dragged.current = false; draw(cv, 1); return; }
    return playIn((t) => draw(cv, t), 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, format, pose, hideFace, numbers, measure, showValues, bestIdx, coach, imgs, fonts, progress.measurements, photo, place, size]);

  const ready = (kind === "photos" && !!pair) || (kind === "body" && !!change) || (kind === "best" && !!best);
  const share = async () => {
    const cv = document.createElement("canvas");
    draw(cv, 1);
    setStatus(await shareCards([cv], `apex-${kind}`, storyCaption(kind, coach, `https://${site}`)));
  };
  const toggleNumber = (k: MeasureKey) => setNumbers((n) => (n.includes(k) ? n.filter((x) => x !== k) : [...n, k]));

  return (
    <Sheet onClose={onClose} label="Share my progress">
      <div className="sect"><h3 className="h3">Share my progress</h3><button className="btn ghost sm" onClick={onClose}>Close</button></div>
      {story && (
        <button className="wk-mini" onClick={openWeek}>
          <span><b>Your week</b> · {story.label}</span><span className="tiny">Play the story ›</span>
        </button>
      )}
      <div className="seg" role="tablist" aria-label="Card">
        {([["photos", "Before & after"], ["body", "Measurements"], ["best", "Best lift"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>
      <div className="sp-stage">
        <canvas ref={canvas} className={`sp-canvas ${format}`} aria-label="Card preview" />
        {ready && photo && kind !== "photos" && <PlaceDrag canvas={canvas} format={format} place={place} onPlace={(p) => { dragged.current = true; setPlace(p); }} size={size} onSize={(z) => { dragged.current = true; setSize(z); }} watch={`${format}-${kind}`} />}
        {!ready && (
          <div className="sp-empty small">
            {kind === "photos" ? `Add ${pose} photos on two different days to make a before and after.` : kind === "body" ? "Log the same measurement twice to show your change." : "Your personal bests appear here after a workout."}
          </div>
        )}
      </div>
      <div className="seg sm" role="radiogroup" aria-label="Size">
        <button role="radio" aria-checked={format === "story"} className={format === "story" ? "on" : ""} onClick={() => setFormat("story")}>Story 9:16</button>
        <button role="radio" aria-checked={format === "post"} className={format === "post" ? "on" : ""} onClick={() => setFormat("post")}>Post 4:5</button>
      </div>

      {kind === "photos" && (
        <>
          <div className="chips" role="radiogroup" aria-label="Pose">
            {POSES.map((p) => <button key={p} role="radio" aria-checked={pose === p} className={`chip ${pose === p ? "on" : ""}`} onClick={() => setPose(p)}>{p[0]!.toUpperCase() + p.slice(1)}</button>)}
          </div>
          <label className="sp-opt"><input type="checkbox" checked={hideFace} onChange={(e) => setHideFace(e.target.checked)} /> Leave my face out</label>
          {measured.length > 0 && (
            <div>
              <div className="tiny" style={{ marginBottom: 6 }}>Add numbers (off unless you choose)</div>
              <div className="chips" style={{ flexWrap: "wrap" }}>
                {measured.map((m) => <button key={m.key} aria-pressed={numbers.includes(m.key)} className={`chip ${numbers.includes(m.key) ? "on" : ""}`} onClick={() => toggleNumber(m.key)}>{m.label}</button>)}
              </div>
            </div>
          )}
        </>
      )}
      {kind === "body" && measured.length > 0 && (
        <>
          <div className="chips" role="radiogroup" aria-label="Measurement" style={{ flexWrap: "wrap" }}>
            {measured.map((m) => <button key={m.key} role="radio" aria-checked={measure === m.key} className={`chip ${measure === m.key ? "on" : ""}`} onClick={() => setMeasure(m.key)}>{m.label}</button>)}
          </div>
          <label className="sp-opt"><input type="checkbox" checked={showValues} onChange={(e) => setShowValues(e.target.checked)} /> Show my actual numbers, not just the change</label>
        </>
      )}
      {kind === "best" && bests.length > 1 && (
        <div className="chips" role="radiogroup" aria-label="Personal best" style={{ flexWrap: "wrap" }}>
          {bests.slice(0, 6).map((b, i) => <button key={`${b.exerciseId}-${b.at}`} role="radio" aria-checked={bestIdx === i} className={`chip ${bestIdx === i ? "on" : ""}`} onClick={() => setBestIdx(i)}>{b.exercise} {b.kg} kg</button>)}
        </div>
      )}
      {kind !== "photos" && <div className="sp-photo"><PhotoPick photo={photo} onPhoto={setPhoto} /><span className="tiny">{photo ? "Drag to move, pinch to resize" : "Your picture behind the numbers"}</span></div>}
      {kind !== "photos" && photo && <SizeSlider size={size} onSize={(z) => { dragged.current = true; setSize(z); }} />}
      {coachName && <label className="sp-opt"><input type="checkbox" checked={showCoach} onChange={(e) => setShowCoach(e.target.checked)} /> Show "Coached by {coachName}"</label>}
      <button className="btn act block" style={{ minHeight: 52 }} disabled={!ready} onClick={() => void share()}>Share</button>
      <div className="tiny" style={{ textAlign: "center" }}>{status || "Your photos stay on your phone unless you share them."}</div>
    </Sheet>
  );
}
