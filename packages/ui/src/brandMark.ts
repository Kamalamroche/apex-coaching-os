/** The APEX logo mark, drawn from one set of shapes everywhere it appears: the app header (Icons.logo), share and
 *  story images (canvas), the printable poster (SVG string) and the store icons (apps/web/public/icon.svg).
 *  A summit A with a blue peak inside and a second, smaller mountain cut into its left side. Fixed brand colours,
 *  the same in light and dark (tokens --logo-orange and --logo-blue). Coordinates are a 40 x 40 box. */
export const LOGO_ORANGE = "#FF6A1A";
export const LOGO_BLUE = "#2F6BFF";

export const MARK_A = "M3.6 36.5 20 3.6 36.4 36.5H27.8L20 21.3 12.2 36.5Z";
export const MARK_PEAK = "M20 26.1 25.4 36.5H14.6Z";
/** The groove that draws the second mountain: a line this wide, cut out of the A. */
export const MARK_CUT = "M8.2 38.1 13.7 26.8 16.8 30.9";
export const MARK_CUT_W = 1.6;

/** The mark as an SVG string, for HTML that is not React (printable pages). */
export function markSvg(size: number, id = "apex-mark-cut"): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true"><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40"><rect width="40" height="40" fill="#fff"/><path d="${MARK_CUT}" stroke="#000" stroke-width="${MARK_CUT_W}"/></mask><path d="${MARK_A}" fill="${LOGO_ORANGE}" stroke="${LOGO_ORANGE}" stroke-width=".7" stroke-linejoin="round" mask="url(#${id})"/><path d="${MARK_PEAK}" fill="${LOGO_BLUE}" stroke="${LOGO_BLUE}" stroke-width=".7" stroke-linejoin="round"/></svg>`;
}

/** Outline of a thick polyline (mitred), so the groove can be cut out with an even-odd clip. */
function strokeOutline(pts: [number, number][], h: number): [number, number][] {
  const side = (s: number) => pts.map((p, i) => {
    const a = pts[Math.max(i - 1, 0)]!, b = pts[Math.min(i + 1, pts.length - 1)]!;
    const n = (u: [number, number], v: [number, number]) => { const dx = v[0] - u[0], dy = v[1] - u[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l] as const; };
    if (i === 0 || i === pts.length - 1) { const [nx, ny] = n(a, b); return [p[0] + nx * h * s, p[1] + ny * h * s] as [number, number]; }
    const [n1x, n1y] = n(a, p), [n2x, n2y] = n(p, b);
    const mx = n1x + n2x, my = n1y + n2y, dot = (mx * n1x + my * n1y) || 1;
    return [p[0] + (mx / dot) * h * s, p[1] + (my / dot) * h * s] as [number, number];
  });
  return [...side(1), ...side(-1).reverse()];
}
const CUT_PTS: [number, number][] = [[8.2, 38.1], [13.7, 26.8], [16.8, 30.9]];

/** Draws the mark on a canvas with its top-left corner at (x, y), `size` pixels square. */
export function drawApexMark(c: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const k = size / 40;
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.lineJoin = "round";
  c.lineWidth = 0.7;
  // Clip away the groove: a big rectangle plus the groove outline, filled even-odd.
  const clip = new Path2D();
  clip.rect(-10, -10, 60, 60);
  const g = strokeOutline(CUT_PTS, MARK_CUT_W / 2);
  clip.moveTo(g[0]![0], g[0]![1]);
  for (const p of g.slice(1)) clip.lineTo(p[0], p[1]);
  clip.closePath();
  c.save();
  c.clip(clip, "evenodd");
  const a = new Path2D(MARK_A);
  c.fillStyle = LOGO_ORANGE; c.strokeStyle = LOGO_ORANGE;
  c.fill(a); c.stroke(a);
  c.restore();
  const b = new Path2D(MARK_PEAK);
  c.fillStyle = LOGO_BLUE; c.strokeStyle = LOGO_BLUE;
  c.fill(b); c.stroke(b);
  c.restore();
}

/* The APEX letters, drawn to match the mark rather than typed: the A has the mark's slope and its small peak
   inside instead of a crossbar, and every stroke has the weight of the mark's legs. Cap height 100. */
const S = 0.497; // the mark's slope (run over rise)
const LETTER_A = (() => {
  const w = 2 * 103 * S, leg = 22.3, gap = 6.6; // the point overshoots the cap height by 3 so it looks as tall as the flat letters
  const ix = leg, iy = 100 - (w / 2 - ix) / S, bx = ix + gap, by = 100 - (w / 2 - bx) / S;
  const f = (n: number) => +n.toFixed(2);
  return { w, d: `M0 100 L${f(w / 2)} -3 L${f(w)} 100 H${f(w - ix)} L${f(w / 2)} ${f(iy)} L${f(ix)} 100Z M${f(w / 2)} ${f(by)} L${f(w - bx)} 100 H${f(bx)}Z` };
})();
const LETTERS: { w: number; d: string; kern: number }[] = [
  { ...LETTER_A, kern: 0 },
  { w: 84, kern: 11, d: "M0 0H54A30 30 0 0 1 54 60H21V100H0Z M21 20V40H53A10 10 0 0 0 53 20Z" },
  { w: 62, kern: 14, d: "M0 0H62V20H21V40H56V60H21V80H62V100H0Z" },
  { w: 92, kern: 12, d: "M0 0H25L46 34L67 0H92L58.5 50L92 100H67L46 66L25 100H0L33.5 50Z" },
];
/** The letters as one path, cap height 100, left edge at 0. */
export const WORD = (() => {
  let x = 0; const parts: string[] = [];
  for (const l of LETTERS) { x += l.kern; parts.push(`<path transform="translate(${+x.toFixed(2)} 0)" d="${l.d}"/>`); x += l.w; }
  return { width: x, paths: parts.join("") };
})();

/** Lockup geometry in a 40-high box: the mark, then the letters sitting on the mark's baseline at two thirds of its height. */
export const LOCKUP = (() => {
  const base = 36.5, cap = 32.9 * 0.66, k = cap / 100, x = 36.4 + cap * 0.36;
  return { k, x, y: base - cap, width: +(x + WORD.width * k + 3.6).toFixed(2) };
})();

/** The full logo (mark and letters) as an SVG string. Letters take `ink`. */
export function logoSvg(height: number, ink: string, id = "apex-logo-svg-cut"): string {
  const w = (LOCKUP.width / 40) * height;
  return `<svg width="${+w.toFixed(1)}" height="${height}" viewBox="0 0 ${LOCKUP.width} 40" fill="none" role="img" aria-label="APEX">${markSvg(40, id).replace(/^<svg[^>]*>|<\/svg>$/g, "")}<g transform="translate(${LOCKUP.x} ${LOCKUP.y}) scale(${LOCKUP.k})" fill="${ink}" fill-rule="evenodd">${WORD.paths}</g></svg>`;
}

/** Draws the full logo on a canvas: (x, y) is the top-left, `height` the mark's box height. Returns the width. */
export function drawApexLogo(c: CanvasRenderingContext2D, x: number, y: number, height: number, ink: string): number {
  drawApexMark(c, x, y, height);
  const u = height / 40;
  c.save();
  c.translate(x + LOCKUP.x * u, y + LOCKUP.y * u);
  c.scale(LOCKUP.k * u, LOCKUP.k * u);
  c.fillStyle = ink;
  let lx = 0;
  for (const l of LETTERS) { lx += l.kern; c.save(); c.translate(lx, 0); c.fill(new Path2D(l.d), "evenodd"); c.restore(); lx += l.w; }
  c.restore();
  return (LOCKUP.width / 40) * height;
}
