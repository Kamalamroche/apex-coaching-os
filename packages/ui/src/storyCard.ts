import { distanceText, shownUnit, signedUnit, toShown, weightFromKg, type BodyChange, type CardioWeek, type PersonalBest, type StorySlide } from "@apex/core";
import { getPrefs } from "./prefs";

/* Cards are drawn in the person's units: the slide's kg and cm are converted on the way in. */
const units = () => getPrefs().units;
const WU = () => units().weight;
const toW = (kg: number) => weightFromKg(kg, units().weight, 2);
const shownChange = (ch: BodyChange): BodyChange => {
  const u = units();
  return { ...ch, delta: toShown(ch.delta, ch.unit, u, 2), first: toShown(ch.first, ch.unit, u, 2), last: toShown(ch.last, ch.unit, u, 2), unit: shownUnit(ch.unit, u) };
};
function shownSlide(s: StorySlide): StorySlide {
  switch (s.kind) {
    case "lifted": return { ...s, kg: toW(s.kg), vsLastWeekKg: s.vsLastWeekKg === null ? null : toW(s.vsLastWeekKg) };
    case "best": return { ...s, best: { ...s.best, kg: toW(s.best.kg), previousKg: toW(s.best.previousKg) } };
    case "body": return { ...s, change: shownChange(s.change) };
    default: return s;
  }
}

/* The weekly story and the progress cards, drawn on a canvas so they can be saved and posted.
   One quiet style for all of them: a deep near-black field, thin large numbers, small spaced capitals, one orange
   accent, the APEX mark and the coach's name. Every draw takes `t` from 0 to 1 so the app can play it in. */

export type CardFormat = "story" | "post";
export const CARD_W = 1080;
export const cardHeight = (f: CardFormat) => (f === "story" ? 1920 : 1350);

const C = {
  bg: "#0D0F13", bg2: "#151922", text: "#F5F5F3", text2: "#AAAFB9", text3: "#717783", line: "rgba(255,255,255,.12)",
  act: "#FF6A1A", good: "#22C55E", data: "#38BDF8",
  font: "Archivo, system-ui, sans-serif",
  serif: "'Libre Bodoni', 'Bodoni 72', Didot, Georgia, serif",
};

type Ctx = CanvasRenderingContext2D;
type Img = CanvasImageSource & { width: number; height: number };

export async function loadStoryFonts(): Promise<void> {
  try {
    await Promise.all(["200 300px Archivo", "300 120px Archivo", "500 40px Archivo", "600 40px Archivo", "900 40px Archivo", "400 120px 'Libre Bodoni'", "500 120px 'Libre Bodoni'"].map((f) => document.fonts.load(f)));
  } catch { /* draw with fallbacks */ }
}

const ease = (k: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
/** Progress of a part that starts at `at` and takes `len` of the timeline. */
const part = (t: number, at: number, len = 0.45) => ease((t - at) / len);

function setFont(c: Ctx, weight: number, size: number, spacing = 0) {
  // Big light numbers and titles are set in the Roman-capital serif, like the app's photo titles.
  const serif = weight <= 300 && size >= 56;
  c.font = serif ? `${weight === 200 ? 400 : 500} ${size}px ${C.serif}` : `${weight} ${size}px ${C.font}`;
  const x = c as Ctx & { letterSpacing?: string };
  if ("letterSpacing" in x) x.letterSpacing = `${spacing}px`;
}

/** Text that rises a little and fades in as `k` goes 0 → 1. */
function text(c: Ctx, s: string, x: number, y: number, k: number, colour: string, align: CanvasTextAlign = "left") {
  c.save();
  c.globalAlpha = k;
  c.fillStyle = colour;
  c.textAlign = align;
  c.fillText(s, x, y + (1 - k) * 24);
  c.restore();
}

function fitSize(c: Ctx, s: string, weight: number, size: number, maxW: number, spacing = 0): number {
  let z = size;
  setFont(c, weight, z, spacing);
  while (z > 20 && c.measureText(s).width > maxW) setFont(c, weight, --z, spacing);
  return z;
}

function field(c: Ctx, h: number) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, C.bg2);
  g.addColorStop(1, C.bg);
  c.fillStyle = g;
  c.fillRect(0, 0, CARD_W, h);
}

function mark(c: Ctx, x: number, y: number, size: number, align: "left" | "center" = "left") {
  setFont(c, 900, size, size * 0.12);
  const w = c.measureText("APEX").width;
  const dot = c.measureText(".").width;
  const left = align === "left" ? x : x - (w + dot) / 2;
  c.textAlign = "left";
  c.fillStyle = C.text;
  c.fillText("APEX", left, y);
  c.fillStyle = C.act;
  c.fillText(".", left + w, y);
}

const PAD = 88;

function frame(c: Ctx, h: number, corner: string, coach: string | null, site: string, foot = true) {
  field(c, h);
  const top = h > 1500 ? 150 : 112;
  if (foot) mark(c, PAD, top, 40);
  setFont(c, 500, 24, 5);
  c.fillStyle = C.text3;
  c.textAlign = "right";
  c.fillText(corner.toUpperCase(), CARD_W - PAD, top - 4);
  if (!foot) return;
  const footY = h - (h > 1500 ? 140 : 96);
  c.fillStyle = C.line;
  c.fillRect(PAD, footY - 56, CARD_W - PAD * 2, 2);
  setFont(c, 500, 28, 1);
  c.fillStyle = C.text2;
  c.textAlign = "left";
  c.fillText(coach ? `Coached by ${coach}` : "Trained with APEX", PAD, footY);
  setFont(c, 400, 24, 1);
  c.fillStyle = C.text3;
  c.textAlign = "right";
  c.fillText(site, CARD_W - PAD, footY);
}

/** "12.4 km" → ["12.4", "km"]. */
function splitDistance(r: CardioWeek): [string, string] {
  const d = distanceText(r.metres, r.sport, units().distance);
  const i = d.lastIndexOf(" ");
  return [d.slice(0, i), d.slice(i + 1)];
}

/** "+3.2 km on last week", or null with nothing to compare. */
function vsText(r: CardioWeek): string | null {
  if (!r.lastWeekMetres) return null;
  const diff = r.metres - r.lastWeekMetres;
  if (Math.abs(diff) < 50) return "Same as last week";
  return `${diff > 0 ? "+" : "−"}${distanceText(Math.abs(diff), r.sport, units().distance)} on last week`;
}

/** A large thin number with its unit, centred block at baseline y. Returns the bottom of the block. */
function bigNumber(c: Ctx, value: string, unit: string, y: number, size: number, k: number, align: "left" | "center" = "left") {
  const z = fitSize(c, value, 200, size, CARD_W - PAD * 2 - 200, -size * 0.03);
  const w = c.measureText(value).width;
  setFont(c, 300, z * 0.24, 0);
  const uw = unit ? c.measureText(unit).width + 18 : 0;
  const x = align === "left" ? PAD : (CARD_W - w - uw) / 2;
  setFont(c, 200, z, -z * 0.03);
  text(c, value, x, y, k, C.text);
  if (unit) {
    setFont(c, 300, z * 0.24, 0);
    text(c, unit, x + w + 18, y, k, C.text2);
  }
}

function eyebrow(c: Ctx, s: string, y: number, k: number, align: "left" | "center" = "left") {
  setFont(c, 600, 26, 8);
  c.save();
  c.globalAlpha = k;
  c.fillStyle = C.act;
  if (align === "left") c.fillRect(PAD, y - 34 + (1 - k) * 24, 48, 4);
  c.restore();
  text(c, s.toUpperCase(), align === "left" ? PAD : CARD_W / 2, y + 24, k, C.text2, align);
}

function line(c: Ctx, s: string, y: number, k: number, colour = C.text2, size = 40, weight = 400) {
  setFont(c, weight, size, 0);
  const z = fitSize(c, s, weight, size, CARD_W - PAD * 2);
  setFont(c, weight, z, 0);
  text(c, s, PAD, y, k, colour);
}

const num = (n: number) => Math.round(n).toLocaleString("en-GB");
const kgText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));
const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

export interface StoryDraw {
  slide: StorySlide;
  format: CardFormat;
  /** 0 → 1 while the slide plays in; 1 for the saved image. */
  t: number;
  week: string;
  coach: string | null;
  site: string;
  /** The client's own picture. With one, the picture fills the card and the numbers sit small at the bottom. */
  photo?: Img | null;
  /** Where the numbers sit on a photo, 0 = just under the logo, 1 = the bottom (default). The client drags them. */
  place?: number;
  /** How big the numbers are on a photo, see BAND_SIZE. */
  size?: number;
}

export function drawStorySlide(canvas: HTMLCanvasElement, p: StoryDraw) {
  const h = cardHeight(p.format);
  canvas.width = CARD_W;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) return;
  const s = shownSlide(p.slide);
  const t = p.t;
  if (p.photo && p.photo.width) {
    photoCard(c, h, p.photo, slideBand(s, p.week), p.coach, p.site, t, p.place, p.size);
    return;
  }
  frame(c, h, s.kind === "end" ? "" : p.week, p.coach, p.site, s.kind !== "end");
  const story = p.format === "story";
  const mid = story ? h * 0.47 : h * 0.5;
  const big = story ? 300 : 250;

  switch (s.kind) {
    case "cover": {
      eyebrow(c, s.soFar ? "Your week so far" : "Your week", mid - 300, part(t, 0));
      setFont(c, 300, story ? 104 : 88, story ? 8 : 6);
      text(c, p.week.toUpperCase(), PAD, mid - 120, part(t, 0.08), C.text);
      // Seven days: a filled dot for each day trained.
      const names = ["M", "T", "W", "T", "F", "S", "S"];
      const gap = (CARD_W - PAD * 2) / 7;
      s.days.forEach((on, i) => {
        const k = part(t, 0.2 + i * 0.05, 0.35);
        const cx = PAD + gap * i + gap / 2;
        const cy = mid + 40;
        c.save();
        c.globalAlpha = k;
        c.beginPath();
        c.arc(cx, cy, 30 * (0.6 + 0.4 * k), 0, Math.PI * 2);
        if (on) { c.fillStyle = C.act; c.fill(); }
        else { c.strokeStyle = C.line; c.lineWidth = 3; c.stroke(); }
        c.restore();
        setFont(c, 500, 24, 2);
        text(c, names[i]!, cx, cy + 82, k, on ? C.text : C.text3, "center");
      });
      line(c, `${s.workouts} workout${s.workouts === 1 ? "" : "s"} · ${hm(s.minutes)}`, mid + 240, part(t, 0.5), C.text, 44, 500);
      break;
    }
    case "lifted": {
      eyebrow(c, "Lifted this week", mid - 280, part(t, 0));
      bigNumber(c, num(s.kg * ease(t / 0.8)), WU(), mid, big, part(t, 0.05));
      if (s.fun) line(c, `That's ${s.fun}.`, mid + 110, part(t, 0.45));
      if (s.vsLastWeekKg) line(c, `${s.vsLastWeekKg > 0 ? "+" : "−"}${num(Math.abs(s.vsLastWeekKg))} ${WU()} on last week`, mid + 180, part(t, 0.55), s.vsLastWeekKg > 0 ? C.good : C.text3, 34, 500);
      break;
    }
    case "best": {
      eyebrow(c, "Personal best", mid - 300, part(t, 0));
      line(c, s.best.exercise, mid - 200, part(t, 0.08), C.text, 60, 600);
      bigNumber(c, kgText(s.best.previousKg + (s.best.kg - s.best.previousKg) * ease((t - 0.15) / 0.6)), WU(), mid + 100, big, part(t, 0.12));
      line(c, `Up from ${kgText(s.best.previousKg)} ${WU()}${s.others > 0 ? ` · ${s.others} more best${s.others > 1 ? "s" : ""} this week` : ""}`, mid + 200, part(t, 0.5));
      break;
    }
    case "habits": {
      const pct = Math.round((s.done / s.due) * 100);
      eyebrow(c, "Habits", mid - 360, part(t, 0));
      // A thin ring that fills to the share of habits done, the number inside it.
      const r = story ? 250 : 200;
      const cx = CARD_W / 2;
      const cy = mid + (story ? 20 : 30);
      c.lineCap = "round";
      c.lineWidth = 12;
      c.strokeStyle = C.line;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = C.good;
      c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (pct / 100) * ease(t / 0.9)); c.stroke();
      bigNumber(c, String(Math.round(pct * ease(t / 0.8))), "%", cy + (story ? 70 : 56), story ? 220 : 180, part(t, 0.1), "center");
      setFont(c, 400, 40, 0);
      text(c, `${s.done} of ${s.due} ticked off`, cx, cy + r + 110, part(t, 0.5), C.text2, "center");
      break;
    }
    case "streak": {
      eyebrow(c, "Streak", mid - 300, part(t, 0));
      bigNumber(c, String(s.weeks), s.weeks === 1 ? "week" : "weeks", mid, big, part(t, 0.05));
      line(c, "in a row with at least one workout.", mid + 110, part(t, 0.45));
      const n = Math.min(12, s.weeks);
      const bw = (CARD_W - PAD * 2 - 11 * 14) / 12;
      for (let i = 0; i < n; i++) {
        const k = part(t, 0.3 + i * 0.04, 0.3);
        c.fillStyle = i === n - 1 ? C.act : C.text3;
        c.globalAlpha = k;
        c.fillRect(PAD + i * (bw + 14), mid + 200 + (1 - k) * 30, bw, 12);
        c.globalAlpha = 1;
      }
      break;
    }
    case "body": {
      eyebrow(c, s.change.label, mid - 280, part(t, 0));
      bigNumber(c, signedUnit(s.change.delta * ease(t / 0.8), "").trim(), s.change.unit, mid, big, part(t, 0.05));
      line(c, `Since ${new Date(s.change.since).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`, mid + 110, part(t, 0.45));
      break;
    }
    case "cardio": {
      const top = s.rows[0]!;
      eyebrow(c, "Distance this week", mid - 300, part(t, 0));
      const [v, u] = splitDistance(top);
      bigNumber(c, v, `${u} ${top.label.toLowerCase()}`, mid - 40, big, part(t, 0.05));
      const vs = vsText(top);
      if (vs) line(c, vs, mid + 50, part(t, 0.4), top.metres >= top.lastWeekMetres ? C.good : C.text3, 34, 500);
      line(c, `${top.sessions} session${top.sessions === 1 ? "" : "s"} · ${hm(top.minutes)}`, mid + (vs ? 110 : 50), part(t, 0.45), C.text2, 34, 400);
      // The other sports as quiet rows: name and detail on the left, distance on the right.
      s.rows.slice(1).forEach((r, i) => {
        const y = mid + 290 + i * 150;
        const k = part(t, 0.5 + i * 0.08, 0.35);
        c.save(); c.globalAlpha = k; c.fillStyle = C.line; c.fillRect(PAD, y - 70, CARD_W - PAD * 2, 2); c.restore();
        setFont(c, 500, 42, 0);
        text(c, r.label, PAD, y, k, C.text);
        setFont(c, 200, 72, -1);
        text(c, distanceText(r.metres, r.sport, units().distance), CARD_W - PAD, y + 14, k, C.text, "right");
        const d = vsText(r);
        setFont(c, 400, 30, 0);
        text(c, `${r.sessions} session${r.sessions === 1 ? "" : "s"} · ${hm(r.minutes)}`, PAD, y + 46, k, C.text2);
        if (d) text(c, d, CARD_W - PAD, y + 62, k, r.metres >= r.lastWeekMetres ? C.good : C.text3, "right");
      });
      break;
    }
    case "milestone": {
      eyebrow(c, `Milestone · ${s.title}`, mid - 300, part(t, 0));
      bigNumber(c, s.value, s.unit, mid, big, part(t, 0.05));
      line(c, s.sub, mid + 110, part(t, 0.45));
      // A small summit mark: three rising steps that draw in, the last one orange.
      for (let i = 0; i < 3; i++) {
        const k = part(t, 0.35 + i * 0.08, 0.3);
        c.globalAlpha = k;
        c.fillStyle = i === 2 ? C.act : C.text3;
        const w = 64, gap = 14, hh = 24 + i * 26;
        c.fillRect(PAD + i * (w + gap), mid + 260 - hh * k, w, hh * k);
      }
      c.globalAlpha = 1;
      break;
    }
    case "end": {
      const k = part(t, 0, 0.6);
      c.save();
      c.globalAlpha = k;
      mark(c, CARD_W / 2, mid - 20, story ? 150 : 120, "center");
      c.restore();
      setFont(c, 500, 40, 0);
      text(c, p.coach ? `Coached by ${p.coach}` : "Your training, in one place", CARD_W / 2, mid + 90, part(t, 0.3), C.text2, "center");
      setFont(c, 500, 30, 4);
      text(c, `TRAIN WITH ME · ${p.site.toUpperCase()}`, CARD_W / 2, mid + 170, part(t, 0.45), C.act, "center");
      break;
    }
  }
}

/** Draws `img` to cover the box. With `hideFace` the top of the photo is left out so the face is off the card. */
function cover(c: Ctx, img: Img, x: number, y: number, w: number, h: number, hideFace: boolean) {
  const sy0 = hideFace ? img.height * 0.24 : 0;
  const sh0 = img.height - sy0;
  const s = Math.max(w / img.width, h / sh0);
  const sw = w / s, sh = h / s;
  const sx = (img.width - sw) / 2;
  const sy = sy0 + (hideFace ? 0 : (sh0 - sh) * 0.25);
  c.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundClip(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
  c.clip();
}

export interface BeforeAfterDraw {
  format: CardFormat;
  before: Img | null;
  after: Img | null;
  beforeDate: string;
  afterDate: string;
  weeks: number;
  /** Lines the client chose to show, e.g. "−4.2 cm waist". Empty by default. */
  numbers: string[];
  hideFace: boolean;
  coach: string | null;
  site: string;
  t: number;
}

export function drawBeforeAfter(canvas: HTMLCanvasElement, p: BeforeAfterDraw) {
  const h = cardHeight(p.format);
  canvas.width = CARD_W;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) return;
  frame(c, h, `${p.weeks} weeks`, p.coach, p.site);
  const story = p.format === "story";
  const top = story ? 300 : 236;
  const ph = story ? 1120 : 730;
  const gap = 20;
  const pw = (CARD_W - PAD * 2 - gap) / 2;
  const shots: [Img | null, string, string][] = [[p.before, "Before", p.beforeDate], [p.after, "After", p.afterDate]];
  shots.forEach(([img, label, date], i) => {
    const k = part(p.t, i * 0.15, 0.6);
    const x = PAD + i * (pw + gap);
    c.save();
    c.globalAlpha = k;
    roundClip(c, x, top + (1 - k) * 30, pw, ph, 28);
    c.fillStyle = C.bg2;
    c.fillRect(x, top, pw, ph);
    if (img && img.width) cover(c, img, x, top + (1 - k) * 30, pw, ph, p.hideFace);
    c.restore();
    setFont(c, 600, 24, 6);
    text(c, label.toUpperCase(), x, top + ph + 58, k, i ? C.text : C.text2);
    setFont(c, 400, 28, 0);
    text(c, date, x, top + ph + 100, k, C.text3);
  });
  setFont(c, 300, story ? 64 : 56, 5);
  text(c, `${p.weeks} week${p.weeks === 1 ? "" : "s"} of work`.toUpperCase(), PAD, top - (story ? 48 : 36), part(p.t, 0.1), C.text);
  if (p.numbers.length) {
    setFont(c, 500, 34, 0);
    text(c, p.numbers.join("   ·   "), PAD, top + ph + (story ? 190 : 150), part(p.t, 0.45), C.good);
  }
}

export interface MeasureDraw {
  format: CardFormat;
  photo?: Img | null;
  place?: number;
  size?: number;
  change: BodyChange;
  series: { at: string; value: number }[];
  /** Show the actual values as well as the change. Off by default. */
  showValues: boolean;
  coach: string | null;
  site: string;
  t: number;
}

export function drawMeasureCard(canvas: HTMLCanvasElement, given: MeasureDraw) {
  const metric = given.change.unit;
  const p: MeasureDraw = { ...given, change: shownChange(given.change), series: given.series.map((q) => ({ ...q, value: toShown(q.value, metric, units(), 2) })) };
  const h = cardHeight(p.format);
  canvas.width = CARD_W;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) return;
  const since0 = new Date(p.change.since).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (p.photo && p.photo.width) {
    photoCard(c, h, p.photo, {
      eyebrow: p.change.label, value: signedUnit(p.change.delta, "").trim(), unit: p.change.unit,
      sub: p.showValues ? `${kgText(p.change.first)} → ${kgText(p.change.last)} ${p.change.unit} since ${since0}` : `Since ${since0}`,
      spark: p.series.map((q) => q.value),
    }, p.coach, p.site, p.t, p.place, p.size);
    return;
  }
  frame(c, h, "Progress", p.coach, p.site);
  const story = p.format === "story";
  const mid = story ? h * 0.38 : h * 0.4;
  eyebrow(c, p.change.label, mid - 260, part(p.t, 0));
  bigNumber(c, signedUnit(p.change.delta * ease(p.t / 0.8), "").trim(), p.change.unit, mid, story ? 300 : 250, part(p.t, 0.05));
  const since = new Date(p.change.since).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  line(c, p.showValues ? `${kgText(p.change.first)} → ${kgText(p.change.last)} ${p.change.unit} since ${since}` : `Since ${since}.`, mid + 100, part(p.t, 0.4));
  // The trend as one thin line that draws itself, the latest point marked.
  const pts = p.series;
  if (pts.length >= 2) {
    const x0 = PAD, x1 = CARD_W - PAD, y0 = mid + 220, y1 = story ? h - 420 : h - 300;
    const t0 = Date.parse(pts[0]!.at), t1 = Date.parse(pts.at(-1)!.at) || t0 + 1;
    const vs = pts.map((q) => q.value);
    const lo = Math.min(...vs), hi = Math.max(...vs) || lo + 1;
    const X = (at: string) => x0 + ((Date.parse(at) - t0) / Math.max(1, t1 - t0)) * (x1 - x0);
    const Y = (v: number) => y1 - ((v - lo) / Math.max(0.001, hi - lo)) * (y1 - y0);
    const k = ease((p.t - 0.2) / 0.7);
    c.save();
    c.beginPath();
    c.rect(x0 - 20, y0 - 40, (x1 - x0 + 40) * k, y1 - y0 + 80);
    c.clip();
    c.strokeStyle = C.good;
    c.lineWidth = 6;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.beginPath();
    pts.forEach((q, i) => (i ? c.lineTo(X(q.at), Y(q.value)) : c.moveTo(X(q.at), Y(q.value))));
    c.stroke();
    c.restore();
    const lastPt = pts.at(-1)!;
    c.globalAlpha = part(p.t, 0.85, 0.15);
    c.fillStyle = C.good;
    c.beginPath(); c.arc(X(lastPt.at), Y(lastPt.value), 14, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }
}

export interface BestDraw {
  format: CardFormat;
  photo?: Img | null;
  place?: number;
  size?: number;
  best: PersonalBest;
  date: string;
  coach: string | null;
  site: string;
  t: number;
}

export function drawBestCard(canvas: HTMLCanvasElement, p: BestDraw) {
  drawStorySlide(canvas, { slide: { kind: "best", best: p.best, others: 0 }, format: p.format, t: p.t, week: p.date, coach: p.coach, site: p.site, photo: p.photo ?? null, place: p.place, size: p.size });
}

/* ---------- Photo cards: the client's picture fills the card, the logo stays on top, the numbers take the bottom ~15% ---------- */

interface Band {
  eyebrow: string;
  value: string;
  unit: string;
  sub: string;
  /** Seven days trained / not, drawn as small dots beside the number. */
  days?: boolean[];
  /** A share 0–1 drawn as a small ring beside the number. */
  ring?: number;
  /** Values drawn as a small line beside the number. */
  spark?: number[];
}

function slideBand(s: StorySlide, week: string): Band {
  switch (s.kind) {
    case "cover": return { eyebrow: `${s.soFar ? "My week so far" : "My week"} · ${week}`, value: String(s.workouts), unit: s.workouts === 1 ? "workout" : "workouts", sub: hm(s.minutes), days: s.days };
    case "lifted": return { eyebrow: `Lifted · ${week}`, value: num(s.kg), unit: WU(), sub: s.fun ? `That's ${s.fun}` : `${s.sets} sets` };
    case "best": return { eyebrow: `Personal best · ${s.best.exercise}`, value: kgText(s.best.kg), unit: WU(), sub: `Up from ${kgText(s.best.previousKg)} ${WU()}` };
    case "habits": return { eyebrow: `Habits · ${week}`, value: String(Math.round((s.done / s.due) * 100)), unit: "%", sub: `${s.done} of ${s.due} ticked off`, ring: s.done / s.due };
    case "streak": return { eyebrow: "Streak", value: String(s.weeks), unit: s.weeks === 1 ? "week" : "weeks", sub: "in a row with at least one workout" };
    case "body": return { eyebrow: s.change.label, value: signedUnit(s.change.delta, "").trim(), unit: s.change.unit, sub: `Since ${new Date(s.change.since).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` };
    case "milestone": return { eyebrow: `Milestone · ${s.title}`, value: s.value, unit: s.unit, sub: s.sub };
    case "cardio": {
      const top = s.rows[0]!;
      const [v, u] = splitDistance(top);
      const others = s.rows.slice(1).map((r) => `${r.label} ${distanceText(r.metres, r.sport, units().distance)}`).join(" · ");
      return { eyebrow: `Distance · ${week}`, value: v, unit: `${u} ${top.label.toLowerCase()}`, sub: others || vsText(top) || `${top.sessions} session${top.sessions === 1 ? "" : "s"}` };
    }
    case "end": return { eyebrow: "Train with me", value: "APEX", unit: "", sub: "" };
  }
}

/**
 * The numbers block on a photo card, in card pixels: its height, and the highest and lowest its top can go
 * (`place` 0 and 1). The screens use it to turn a drag into a `place`.
 */
export function photoBandBox(format: CardFormat, size = 1): { height: number; minTop: number; maxTop: number } {
  const h = cardHeight(format);
  const story = format === "story";
  const foot = h - (story ? 64 : 48);
  const top = foot - (story ? 44 + 40 + 48 + 100 : 38 + 32 + 42 + 86) - 40;
  const height = (h - top) * bandSize(size);
  return { height, minTop: story ? 220 : 180, maxTop: h - height };
}

/** How big the numbers are on a photo card, from 0.7 (small) to 1.5 (large); 1 is the default. */
export const BAND_SIZE = { min: 0.7, max: 1.5 } as const;
const bandSize = (s: number) => (Number.isFinite(s) ? Math.min(BAND_SIZE.max, Math.max(BAND_SIZE.min, s)) : 1);

function photoCard(c: Ctx, h: number, img: Img, b: Band, coach: string | null, site: string, t: number, place = 1, size = 1) {
  cover(c, img, 0, 0, CARD_W, h, false);
  const story = h > 1500;
  const k = (at: number) => part(t, at, 0.5);
  const sz = bandSize(size);
  const box = photoBandBox(story ? "story" : "post", sz);
  const home = photoBandBox(story ? "story" : "post", 1).maxTop;
  const p01 = Number.isFinite(place) ? Math.min(1, Math.max(0, place)) : 1;
  const dy = (box.minTop + (box.maxTop - box.minTop) * p01) - box.maxTop;
  // Shade only where words sit: a light veil under the logo, a deeper one under the numbers.
  let g = c.createLinearGradient(0, 0, 0, 260);
  g.addColorStop(0, "rgba(13,15,19,.5)");
  g.addColorStop(1, "rgba(13,15,19,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, CARD_W, 260);
  const bandTop = box.maxTop + dy;
  const bandBottom = bandTop + box.height;
  const atBottom = p01 > 0.98;
  g = c.createLinearGradient(0, bandTop - 140, 0, atBottom ? h : bandBottom + 120);
  g.addColorStop(0, "rgba(13,15,19,0)");
  if (atBottom) {
    g.addColorStop(0.45, "rgba(13,15,19,.62)");
    g.addColorStop(1, "rgba(13,15,19,.9)");
  } else {
    // Floating: a soft band that fades out above and below the numbers.
    g.addColorStop(0.3, "rgba(13,15,19,.6)");
    g.addColorStop(0.75, "rgba(13,15,19,.6)");
    g.addColorStop(1, "rgba(13,15,19,0)");
  }
  c.fillStyle = g;
  c.fillRect(0, bandTop - 140, CARD_W, (atBottom ? h : bandBottom + 120) - bandTop + 140);

  const P = 64;
  mark(c, P, story ? 120 : 96, 44);
  c.save();
  // The block is laid out at its home (bottom, size 1), then moved and scaled from its top-left corner.
  c.translate(P, bandTop);
  c.scale(sz, sz);
  c.translate(-P, -home);
  const R = P + (CARD_W - P * 2) / sz;

  const foot = h - (story ? 64 : 48);
  const rule = foot - (story ? 44 : 38);
  const subY = rule - (story ? 40 : 32);
  const valY = subY - (story ? 48 : 42);
  const eyeY = valY - (story ? 100 : 86);
  const vs = story ? 104 : 90;

  if (b.value === "APEX" && !b.unit) {
    // Closing card: the coach and where to find them, nothing else.
    setFont(c, 600, 24, 6);
    text(c, b.eyebrow.toUpperCase(), P, eyeY + 40, k(0), C.act);
    setFont(c, 300, story ? 64 : 56, 5);
    text(c, (coach ? `Coached by ${coach}` : "Train with APEX").toUpperCase(), P, valY, k(0.1), C.text);
  } else {
    c.save();
    c.globalAlpha = k(0);
    c.fillStyle = C.act;
    c.fillRect(P, eyeY + 4, 36, 4);
    c.restore();
    const ew = fitSize(c, b.eyebrow.toUpperCase(), 600, 22, R - P - 60, 5);
    setFont(c, 600, ew, 5);
    text(c, b.eyebrow.toUpperCase(), P + 52, eyeY + 12, k(0), C.text);
    setFont(c, 200, vs, -vs * 0.03);
    const vw = c.measureText(b.value).width;
    text(c, b.value, P, valY, k(0.08), C.text);
    if (b.unit) {
      setFont(c, 300, vs * 0.3, 0);
      text(c, b.unit, P + vw + 14, valY, k(0.08), C.text2);
    }
    setFont(c, 400, story ? 30 : 26, 0);
    text(c, b.sub, P, subY, k(0.18), C.text2);
    // A small graphic on the right of the number.
    const gx = R;
    const gy = valY - vs * 0.36;
    const kk = k(0.2);
    c.save();
    c.globalAlpha = kk;
    if (b.days) {
      const r = 11, step = 36;
      b.days.forEach((on, i) => {
        const cx = gx - (6 - i) * step - r;
        c.beginPath();
        c.arc(cx, gy, r, 0, Math.PI * 2);
        if (on) { c.fillStyle = C.act; c.fill(); } else { c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 2; c.stroke(); }
      });
    } else if (b.ring !== undefined) {
      const r = vs * 0.38;
      c.lineWidth = 8;
      c.lineCap = "round";
      c.strokeStyle = "rgba(255,255,255,.22)";
      c.beginPath(); c.arc(gx - r, gy, r, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = C.good;
      c.beginPath(); c.arc(gx - r, gy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.ring * ease(t / 0.9)); c.stroke();
    } else if (b.spark && b.spark.length >= 2) {
      const w = 260, hh = vs * 0.6;
      const lo = Math.min(...b.spark), hi = Math.max(...b.spark);
      const X = (i: number) => gx - w + (i / (b.spark!.length - 1)) * w;
      const Y = (v: number) => gy + hh / 2 - ((v - lo) / Math.max(0.001, hi - lo)) * hh;
      c.strokeStyle = C.good;
      c.lineWidth = 5;
      c.lineJoin = "round";
      c.lineCap = "round";
      c.beginPath();
      b.spark.forEach((v, i) => (i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v))));
      c.stroke();
    }
    c.restore();
  }
  c.fillStyle = "rgba(255,255,255,.18)";
  c.fillRect(P, rule, R - P, 2);
  setFont(c, 500, story ? 24 : 22, 1);
  text(c, coach ? `Coached by ${coach}` : "Trained with APEX", P, foot, 1, C.text2);
  setFont(c, 400, story ? 22 : 20, 1);
  text(c, site, R, foot, 1, C.text3, "right");
  c.restore();
}
