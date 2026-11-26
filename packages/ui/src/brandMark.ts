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

/* The APEX letters: the app's own heading type (Archivo Black, expanded, as in the header before the logo), turned
   into outlines so they look the same in the app, on canvas images, on the poster and in emails. A normal A.
   Cap height 100; widths are the font's advances plus its .02em letter spacing. */
const SP = 2.9;
const LETTERS: { w: number; d: string; kern: number }[] = [
  { w: 138.66, kern: -1.2, d: "M1.2 100 49.6 0H89.1L137.5 100H99L93 86.8H44L38.2 100ZM54.9 61.9H82.1L75.1 45.1Q74.7 43.9 74 41.9Q73.3 40 72.4 37.5Q71.5 35 70.7 32.6Q69.9 30.1 69.2 28.1H68.2Q67.3 30.5 66.1 33.7Q65 36.9 63.9 40Q62.8 43 61.9 45.1Z" },
  { w: 125.73, kern: SP, d: "M10.8 100V0H91.1Q101 0 108.6 4.4Q116.1 8.9 120.3 16.8Q124.6 24.7 124.6 35Q124.6 45.6 120.3 53.6Q116 61.6 108.4 66Q100.9 70.3 91.1 70.3H46.7V100ZM46.7 45.5H81.1Q86.6 45.5 89.3 42.9Q92 40.3 92 35.2Q92 31.7 90.8 29.4Q89.5 27.2 87.1 26Q84.7 24.9 81.1 24.9H46.7Z" },
  { w: 125, kern: SP, d: "M10.8 100V0H117.6V24.9H46.8V37.8H107.8V61.3H46.8V75.1H118.8V100Z" },
  { w: 139.68, kern: SP, d: "M1.7 100 49.4 48.4 6.1 0H52.5L72.1 23.7H73.3L94.2 0H136.6L93 46.9L140.6 100H94.3L70.5 71.8H69.2L44.5 100Z" },
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
  return { k, x, y: base - cap, width: +(x + WORD.width * k + 1).toFixed(2) };
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
