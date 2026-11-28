/* Campaign posters from the earlier APEX site, kept as they were made (same photos, numbers and type), shown in the
   Ember page without a frame: CSS fades their edges into the black page and gives the photos the warm red grade of
   the pyramid video (see .ps in packages/ui/src/landing.css). Original HELIX photos and words only.
   Ideas taken (not copied) from Kamal's references: giant condensed numbers behind a cut-out athlete,
   split colour blocks, type filled with the photo, an athlete resting on a big shape. */

import { useEffect, useRef, useState } from "react";

const Grain = () => <i className="ps-grain" aria-hidden="true" />;

/** Morning Brief: split colour block, a giant 07:30 that disappears into the lower half, the coach in front.
    Alive: when it scrolls into view the clock rolls on to 07:30, then a short list of clients who need the coach
    today, ranked by urgency, works itself down: the top one is ticked off, the rest move up and the next arrives. */
const BRIEF: { who: string; what: string; tone: "act" | "warn" | "info" | "good" }[] = [
  { who: "Amara O.", what: "Missed 2 sessions", tone: "act" },
  { who: "Tom H.", what: "Squat stalled 3 weeks", tone: "warn" },
  { who: "Priya S.", what: "Check-in waiting 2 days", tone: "info" },
  { who: "Kenji T.", what: "Unread message", tone: "info" },
  { who: "Sofia R.", what: "New best: 120 kg deadlift", tone: "good" },
];
/** One flip-clock digit: when it changes, the old card folds away and the new one drops into place. */
function Flip({ d }: { d: string }) {
  const [pair, setPair] = useState<[string, string | null]>([d, null]);
  if (pair[0] !== d) setPair([d, pair[0]]);
  return (
    <span className="ps-flip">
      <b key={`n${pair[0]}`} className={pair[1] === null ? "" : "in"}>{pair[0]}</b>
      {pair[1] !== null && <b key={`o${pair[1]}`} className="old" aria-hidden="true">{pair[1]}</b>}
    </span>
  );
}

const initials = (n: string) => n.split(" ").map((w) => w[0]).join("");

export function BriefPoster() {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const [min, setMin] = useState(27);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== "function") { setSeen(true); return; }
    const io = new IntersectionObserver((es) => setSeen(es.some((e) => e.isIntersecting)), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // the clock flips 07:27 -> 07:30 the first time the poster is seen, then a minute passes each time a client is
  // ticked off; the top block takes the Why APEX colours in turn (sky, violet, rose, black) with every minute
  useEffect(() => {
    if (!seen || min >= 30) return;
    if (still) { setMin(30); return; }
    const t = setTimeout(() => setMin((m) => m + 1), min === 27 ? 600 : 700);
    return () => clearTimeout(t);
  }, [seen, min, still]);
  useEffect(() => {
    if (!seen || min < 30 || still) return;
    const t = setInterval(() => setStep((n) => n + 1), 2600);
    return () => clearInterval(t);
  }, [seen, min, still]);
  const now = 7 * 60 + min + step;
  const hh = String(Math.floor(now / 60) % 24).padStart(2, "0");
  const mm = String(now % 60).padStart(2, "0");
  const tone = (min + step - 27) % 4;
  const cards = [-1, 0, 1, 2].map((p) => ({ p, k: step + p })).filter((c) => c.k >= 0);
  return (
    <figure ref={ref} className={`ps ps-split ps-live t${tone} ${seen ? "seen" : ""}`}>
      <i className="ps-block" aria-hidden="true" />
      <span className="ps-num" aria-hidden="true">
        <Flip d={hh[0]!} /><Flip d={hh[1]!} /><b className="ps-colon">:</b><Flip d={mm[0]!} /><Flip d={mm[1]!} />
      </span>
      <img className="ps-cut" src="/hero/coach-cut.webp" width={1080} height={1350} loading="lazy" alt="A HELIX coach talking a client through her plan" />
      <span className="ps-label" aria-hidden="true">Morning<br />Brief</span>
      <span className="ps-meta tl" aria-hidden="true">Monday<br />3 clients need you</span>
      <span className="ps-meta tr" aria-hidden="true">Coach OS // no. 02</span>
      <ol className="ps-brief" aria-label="Example: clients who need the coach today, most urgent first">
        {cards.map(({ p, k }) => {
          const c = BRIEF[k % BRIEF.length]!;
          return (
            <li key={k} className={`ps-card ${c.tone} ${p < 0 ? "out" : ""}`} style={{ ["--p" as string]: Math.max(p, 0) }} aria-hidden={p < 0}>
              <span className="ps-av">{initials(c.who)}</span>
              <span className="ps-txt"><b>{c.who}</b>{c.what}</span>
              <span className="ps-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
            </li>
          );
        })}
      </ol>
      <span className="ps-meta br" aria-hidden="true">Ranked by urgency</span>
      <Grain />
    </figure>
  );
}

/** Train: flat orange, the sprinter running through TRAIN: the letters (filled with the studio photo) sit behind him and
    continue over him as fine outlines, with two speed echoes trailing behind. */
export function TrainPoster() {
  return (
    <figure className="ps ps-flat">
      <span className="ps-fill" aria-hidden="true">Train</span>
      {/* speed echoes: two fading silhouettes trail behind him */}
      <img className="ps-echo e2" src="/hero/run-cut.webp" width={1080} height={1350} loading="lazy" alt="" aria-hidden="true" />
      <img className="ps-echo e1" src="/hero/run-cut.webp" width={1080} height={1350} loading="lazy" alt="" aria-hidden="true" />
      <img className="ps-cut" src="/hero/run-cut.webp" width={1080} height={1350} loading="lazy" alt="A HELIX athlete sprinting" />
      {/* the letters carry on over him as fine outlines, so he runs through TRAIN instead of hiding it */}
      <span className="ps-fill ps-fill-line" aria-hidden="true">Train</span>
      <span className="ps-meta tl" aria-hidden="true">Client app<br />Today's session</span>
      <span className="ps-meta bl" aria-hidden="true">Cues · rest timer · last time's kg</span>
      <Grain />
    </figure>
  );
}

/** Progress: the same overhead press photo, redrawn in the Ember style. A fine line pyramid rises behind her with
    its tip at the dumbbells (she reaches the apex), the two inner peaks of the logo sit inside it, and six week
    markers climb its left edge with light pulsing up the lines, like the banner video. */
const LEG = (y: number) => -5.3 + (112 - y) / 1.39; // left edge of the big pyramid, same slope as the banner beams
const WEEKS = [82, 72.6, 63.2, 53.8, 44.4, 35];
const PYRAMID = "M-5.3 112 L71 6 L147.3 112";
const PEAKS = "M22 100 L52 58 L82 100 M44 108 L64 80 L84 108";

export function GrowPoster() {
  return (
    <figure className="ps ps-grow">
      <img className="ps-photo" src="/hero/upper.webp" width={1080} height={1350} loading="lazy" alt="" />
      <svg className="ps-lines" viewBox="0 0 100 125" aria-hidden="true">
        <defs>
          <filter id="ps-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".9" /></filter>
        </defs>
        <g className="ps-glowlines" filter="url(#ps-glow)">
          <path d={PYRAMID} />
          <path d={PEAKS} />
        </g>
        <path className="ps-pyr" d={PYRAMID} />
        <path className="ps-peak" d={PEAKS} />
        <path className="ps-pulse" pathLength={100} d="M-5.3 112 L71 6" />
        <path className="ps-pulse b" pathLength={100} d="M147.3 112 L71 6" />
        <path className="ps-scan" d="M8 112 H96" />
        {WEEKS.map((y, i) => (
          <g key={y} className="ps-week" style={{ animationDelay: `${i * 0.35}s` }}>
            <circle cx={LEG(y)} cy={y} r={i === WEEKS.length - 1 ? 1.5 : 1} />
            <text x={LEG(y) - 2.6} y={y + 0.9}>{`W${i + 1}`}</text>
          </g>
        ))}
      </svg>
      <img className="ps-cut" src="/hero/upper-cut.webp" width={1080} height={1350} loading="lazy" alt="A HELIX athlete pressing dumbbells overhead" />
      <span className="ps-grow-head" aria-hidden="true"><b>Stronger</b>every week.</span>
      <span className="ps-grow-stat" aria-hidden="true">
        <small>Overhead press</small>
        <b>+7.5<i>kg</i></b>
        <small>in 6 weeks</small>
      </span>
      <Grain />
    </figure>
  );
}

/** Built by a coach: an athlete leaping off a big rounded triangle. */
export function ShapePoster() {
  return (
    <figure className="ps ps-shape">
      <svg className="ps-tri" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M22 18 Q18 14 22 12 L86 30 Q91 32 88 37 L44 92 Q40 96 37 91 Z" />
      </svg>
      <img className="ps-cut" src="/hero/wall-ball-cut.webp" width={1080} height={1350} loading="lazy" alt="A HELIX athlete throwing a medicine ball" />
      <span className="ps-meta tl" aria-hidden="true">Built at HELIX</span>
      <span className="ps-meta br" aria-hidden="true">By a coach // for coaches</span>
      <Grain />
    </figure>
  );
}

/** Final call: the rings photo with NEXT stacked vertically in outline behind the athlete. */
export function NextPoster() {
  return (
    <figure className="ps ps-next">
      <img className="ps-photo" src="/hero/rings.webp" width={1080} height={1350} loading="lazy" alt="" />
      <span className="ps-vert" aria-hidden="true">Next</span>
      <img className="ps-cut" src="/hero/rings-cut.webp" width={1080} height={1350} loading="lazy" alt="A HELIX athlete holding an L-sit on gymnastic rings" />
      <span className="ps-meta br" aria-hidden="true">Start free // 3 clients</span>
      <Grain />
    </figure>
  );
}
