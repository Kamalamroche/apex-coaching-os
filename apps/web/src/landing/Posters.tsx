/* Campaign posters from the earlier APEX site, kept as they were made (same photos, numbers and type), shown in the
   Ember page without a frame: CSS fades their edges into the black page and gives the photos the warm red grade of
   the pyramid video (see .ps in packages/ui/src/landing.css). Original HELIX photos and words only.
   Ideas taken (not copied) from Kamal's references: giant condensed numbers behind a cut-out athlete,
   split colour blocks, type filled with the photo, an athlete resting on a big shape. */

const Grain = () => <i className="ps-grain" aria-hidden="true" />;

/** Morning Brief: split colour block, a giant 07:30 that disappears into the lower half, the coach in front. */
export function BriefPoster() {
  return (
    <figure className="ps ps-split">
      <i className="ps-block" aria-hidden="true" />
      <span className="ps-num" aria-hidden="true">07:30</span>
      <img className="ps-cut" src="/hero/coach-cut.webp" width={1080} height={1350} loading="lazy" alt="A HELIX coach talking a client through her plan" />
      <span className="ps-label" aria-hidden="true">Morning<br />Brief</span>
      <span className="ps-meta tl" aria-hidden="true">Monday<br />3 clients need you</span>
      <span className="ps-meta tr" aria-hidden="true">Coach OS // no. 02</span>
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
