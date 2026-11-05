import { Icons } from "@apex/ui";

/* Campaign posters for the landing page. Each one is a fixed 4:5 composition sized in container units,
   so it looks the same on a phone and a desktop. Original HELIX photos and words only.
   Ideas taken (not copied) from Kamal's references: giant condensed numbers behind a cut-out athlete,
   slanted tags, split colour blocks, type filled with the photo, an athlete resting on a big shape. */

const Grain = () => <i className="ps-grain" aria-hidden="true" />;

/** Hero: his deadlift photo, DAY 01 in condensed numerals between the backdrop and the athlete, two slanted tags. */
export function DayPoster() {
  return (
    <figure className="ps ps-day">
      <img className="ps-photo" src="/hero/hinge.webp" width={1080} height={1350} alt="" />
      <span className="ps-spaced" aria-hidden="true">D A Y</span>
      <span className="ps-num" aria-hidden="true">01</span>
      <img className="ps-cut" src="/hero/hinge-cut.webp" width={1080} height={1350} alt="A HELIX athlete setting up a barbell deadlift" />
      <span className="ps-tag t1" aria-hidden="true">One plan</span>
      <span className="ps-tag t2" aria-hidden="true">Real progress</span>
      <span className="ps-mark" aria-hidden="true"><Icons.logo width={18} height={18} /></span>
      <span className="ps-meta tl" aria-hidden="true">Coaching OS<br />Season one</span>
      <span className="ps-meta br" aria-hidden="true">2026 // HELIX no. 01</span>
      <Grain />
    </figure>
  );
}

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

/** Train: flat orange, the sprinter on the left, TRAIN running down the right with the studio photo inside the letters. */
export function TrainPoster() {
  return (
    <figure className="ps ps-flat">
      <span className="ps-fill" aria-hidden="true">Train</span>
      <img className="ps-cut" src="/hero/run-cut.webp" width={1080} height={1350} loading="lazy" alt="A HELIX athlete sprinting" />
      <span className="ps-meta tl" aria-hidden="true">Client app<br />Today's session</span>
      <span className="ps-meta bl" aria-hidden="true">Cues · rest timer · last time's kg</span>
      <Grain />
    </figure>
  );
}

/** Progress: the studio photo full bleed with a clean headline in the corner and one real number. */
export function GrowPoster() {
  return (
    <figure className="ps ps-photo-only">
      <img className="ps-photo" src="/hero/upper.webp" width={1080} height={1350} loading="lazy" alt="A HELIX athlete pressing dumbbells overhead" />
      <span className="ps-head" aria-hidden="true">Stronger<br />every week.</span>
      <span className="ps-sub" aria-hidden="true">Overhead press</span>
      <span className="ps-stat" aria-hidden="true"><b>+7.5</b><small>kg in 6 weeks</small></span>
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
      <span className="ps-tag t1" aria-hidden="true">Your next client</span>
      <span className="ps-meta br" aria-hidden="true">Start free // 3 clients</span>
      <Grain />
    </figure>
  );
}
