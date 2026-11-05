import { biggestChange, storyCaption, storySlides, weeklyStory, type StorySlide, type WeekStory as Story } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Icons, drawStorySlide, loadStoryFonts } from "@apex/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAppInfo } from "../../app/AppContext";
import { PlaceDrag, SizeSlider } from "../../app/PlaceDrag";
import { playIn, shareCards, siteName } from "../../app/shareImage";
import { useLifestyle } from "../../data/LifestyleContext";
import { useStore } from "../../data/StoreContext";
import { localDate } from "@apex/core";

const SLIDE_MS = 5200;

/** Last week's story from the client's own training, habits and (only if they choose) body change. */
export function useWeekStory(includeBody = false): { story: Story | null; slides: StorySlide[] } {
  const store = useStore();
  const { history, progress } = useApexState(store);
  const life = useLifestyle();
  const { coachName } = useAppInfo();
  return useMemo(() => {
    const story = weeklyStory({ sessions: history.sessions ?? [], today: localDate(new Date()), habits: life.habits, ticks: life.ticks, coach: coachName });
    if (!story) return { story: null, slides: [] };
    return { story, slides: storySlides(story, includeBody ? biggestChange(progress.measurements) : null) };
  }, [history.sessions, life.habits, life.ticks, coachName, progress.measurements, includeBody]);
}

/** The small card on Today that opens the story. */
export function WeekStoryCard({ onOpen }: { onOpen: () => void }) {
  const { story } = useWeekStory();
  if (!story) return null;
  return (
    <button className="wk-card" onClick={onOpen} aria-label={`Open your week, ${story.label}`}>
      <span className="wk-ring" aria-hidden="true"><i /></span>
      <span className="grow">
        <span className="wk-eyebrow">{story.soFar ? "Your week so far" : "Your week"}</span>
        <b>{story.label}</b>
        <span className="wk-sub">{story.workouts} workout{story.workouts === 1 ? "" : "s"} · {story.kg.toLocaleString("en-GB")} kg{story.best ? " · new best" : ""}</span>
      </span>
      <Icons.forward width={18} height={18} />
    </button>
  );
}

/** Full-screen story: one slide at a time, plays itself, tap to move, share any slide or the whole week. */
export function WeekStoryViewer({ onClose }: { onClose: () => void }) {
  const [withBody, setWithBody] = useState(false);
  const { story, slides } = useWeekStory(withBody);
  const { coachName } = useAppInfo();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState("");
  const [fonts, setFonts] = useState(false);
  /** The client's own picture behind every slide. It stays on the phone. */
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  /** Where the numbers sit on the photo, 0 top to 1 bottom. One place for every slide. */
  const [place, setPlace] = useState(1);
  const [size, setSize] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const site = siteName();
  const slide = slides[Math.min(idx, slides.length - 1)];

  useEffect(() => { void loadStoryFonts().then(() => setFonts(true)); }, []);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(slides.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", key); };
  }, [onClose, slides.length]);

  // Draw the slide playing in.
  useEffect(() => {
    if (!slide || !story || !canvas.current) return;
    const cv = canvas.current;
    return playIn((t) => drawStorySlide(cv, { slide, format: "story", t, week: story.label, coach: coachName || null, site, photo, place, size }));
  }, [slide, story, coachName, site, fonts, photo]);
  // Moving the numbers redraws at once, without playing the slide in again.
  useEffect(() => {
    if (!slide || !story || !canvas.current || !photo) return;
    drawStorySlide(canvas.current, { slide, format: "story", t: 1, week: story.label, coach: coachName || null, site, photo, place, size });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, size]);

  // Move on by itself; the bar of the open slide fills while it plays.
  useEffect(() => {
    if (paused || !slides.length) return;
    let raf = 0;
    const t0 = performance.now() - (Number(bar.current?.dataset.done ?? 0) * SLIDE_MS);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / SLIDE_MS);
      if (bar.current) { bar.current.style.scale = `${k} 1`; bar.current.dataset.done = String(k); }
      if (k >= 1) {
        if (bar.current) bar.current.dataset.done = "0";
        if (idx < slides.length - 1) setIdx(idx + 1);
        else setPaused(true);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [idx, paused, slides.length]);

  const go = (d: number) => {
    if (bar.current) bar.current.dataset.done = "0";
    setIdx((i) => Math.max(0, Math.min(slides.length - 1, i + d)));
    setPaused(false);
  };

  const render = (s: StorySlide) => {
    const cv = document.createElement("canvas");
    drawStorySlide(cv, { slide: s, format: "story", t: 1, week: story?.label ?? "", coach: coachName || null, site, photo, place, size });
    return cv;
  };
  const caption = storyCaption("week", coachName || null, `https://${site}`);
  const shareOne = async () => { if (slide) { setPaused(true); setStatus(await shareCards([render(slide)], "apex-week", caption)); } };
  const shareAll = async () => { setPaused(true); setStatus(await shareCards(slides.map(render), "apex-week", caption)); };

  if (!story || !slide) return null;
  return createPortal(
    <div className="wk-view" role="dialog" aria-modal="true" aria-label={`Your week, ${story.label}`}>
      <div className="wk-bars" aria-hidden="true">
        {slides.map((s, i) => <span key={`${s.kind}-${i}`} className={i < idx ? "done" : ""}>{i === idx && <i ref={bar} data-done="0" />}</span>)}
      </div>
      <div className="wk-top">
        <span className="wk-who">Your week · {story.label}</span>
        <button className="wk-x" onClick={onClose} aria-label="Close"><Icons.close width={20} height={20} /></button>
      </div>
      <div className="wk-stage" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
        <canvas key={idx} ref={canvas} className="wk-canvas" aria-label={`Slide ${idx + 1} of ${slides.length}`} />
        <button className="wk-tap prev" onClick={() => go(-1)} aria-label="Previous slide" />
        <button className="wk-tap next" onClick={() => go(1)} aria-label="Next slide" />
        {photo && <PlaceDrag canvas={canvas} format="story" place={place} onPlace={(p) => { setPaused(true); setPlace(p); }} size={size} onSize={(z) => { setPaused(true); setSize(z); }} watch={idx} />}
      </div>
      <div className="wk-foot">
        <div className="wk-row">
          <label className="wk-opt"><input type="checkbox" checked={withBody} onChange={(e) => { setWithBody(e.target.checked); setIdx(0); }} /> Add my body change</label>
          <PhotoPick photo={photo} onPhoto={setPhoto} dark />
        </div>
        {photo && <SizeSlider size={size} onSize={(z) => { setPaused(true); setSize(z); }} dark />}
        <div className="wk-btns">
          <button className="btn wk-ghost" onClick={() => void shareOne()}>Share this slide</button>
          <button className="btn act" onClick={() => void shareAll()}>Share my week</button>
        </div>
        <div className="wk-status" role="status">{status || "Only you choose what to share. Nothing is posted for you."}</div>
      </div>
    </div>,
    document.body,
  );
}

/** "Add my photo" / "Remove photo": a picture from the phone, kept on the phone. */
export function PhotoPick({ photo, onPhoto, dark = false }: { photo: HTMLImageElement | null; onPhoto: (img: HTMLImageElement | null) => void; dark?: boolean }) {
  const pick = (file: File | undefined) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => onPhoto(img);
    img.src = URL.createObjectURL(file);
  };
  return photo ? (
    <button className={`btn sm ${dark ? "wk-ghost" : "ghost"}`} onClick={() => onPhoto(null)}>Remove photo</button>
  ) : (
    <label className={`btn sm ${dark ? "wk-ghost" : "ghost"}`} style={{ cursor: "pointer" }}>
      <Icons.camera width={16} height={16} /> Add my photo
      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => pick(e.target.files?.[0])} />
    </label>
  );
}
