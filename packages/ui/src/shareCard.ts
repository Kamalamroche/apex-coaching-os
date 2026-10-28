/* Draws the workout share card onto a 1080 × 1920 canvas (story size), so it can be saved or shared as an image.
   The card always sits on a photo, so it uses the dark Athletic Tech tokens whatever the app theme. */

export const SHARE_W = 1080;
export const SHARE_H = 1920;

const T = {
  bg: "#0A1220", text: "#F4F6FA", text2: "#A9B4C8", text3: "#6F7D96",
  act: "#FF6A1A", data: "#38BDF8", good: "#22C55E", warn: "#F59E0B", warnDeep: "#B45309",
  head: "Archivo, system-ui, sans-serif", num: '"JetBrains Mono", ui-monospace, monospace',
};

export interface ShareCanvasData {
  workoutName: string;
  totalKg: number;
  sets: number;
  minutes: number;
  vsLastKg: number | null;
  lastKg: number | null;
  reward: { title: string; rarity: string; reason: string; xp: number };
  coach: string | null;
}

/** Crown centre and width, in card pixels. */
export interface CrownPlacement { x: number; y: number; size: number }

export interface ShareDraw {
  style: "strip" | "crown" | "sticker";
  data: ShareCanvasData;
  photo: CanvasImageSource & { width: number; height: number } | null;
  crown: CrownPlacement;
  /** Where people can find the app, e.g. "apex-coaching-os-web.vercel.app". */
  site: string;
}

export const DEFAULT_CROWN: CrownPlacement = { x: SHARE_W / 2, y: 150, size: 170 };

/** Loads the card fonts before drawing so the first render isn't in a fallback face. */
export async function loadShareFonts(): Promise<void> {
  try {
    await Promise.all(["900 60px Archivo", "700 30px Archivo", "400 30px Archivo", "700 60px \"JetBrains Mono\""].map((f) => document.fonts.load(f)));
  } catch { /* fonts API missing: draw with fallbacks */ }
}

type Ctx = CanvasRenderingContext2D;
const kg = (n: number) => Math.round(n).toLocaleString("en-GB");

function font(c: Ctx, f: string, spacing = 0, wide = false) {
  c.font = f;
  const x = c as Ctx & { letterSpacing?: string; fontStretch?: string };
  if ("letterSpacing" in x) x.letterSpacing = `${spacing}px`;
  if ("fontStretch" in x) x.fontStretch = wide ? "expanded" : "normal";
}

/** Shrinks the font until the text fits the width. */
function fit(c: Ctx, text: string, size: number, maxW: number, make: (s: number) => void) {
  let s = size;
  make(s);
  while (s > 12 && c.measureText(text).width > maxW) make(--s);
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function background(c: Ctx, photo: ShareDraw["photo"]) {
  if (photo && photo.width) {
    const s = Math.max(SHARE_W / photo.width, SHARE_H / photo.height);
    const w = photo.width * s, h = photo.height * s;
    c.drawImage(photo, (SHARE_W - w) / 2, (SHARE_H - h) / 2, w, h);
    return;
  }
  // No photo yet: a navy field with a soft orange glow.
  c.fillStyle = T.bg;
  c.fillRect(0, 0, SHARE_W, SHARE_H);
  const g = c.createRadialGradient(SHARE_W * 0.7, SHARE_H * 0.3, 40, SHARE_W * 0.7, SHARE_H * 0.3, 900);
  g.addColorStop(0, "rgba(255,106,26,.28)");
  g.addColorStop(1, "rgba(255,106,26,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, SHARE_W, SHARE_H);
}

function fadeBottom(c: Ctx, from: number, solid: number, alpha: number) {
  const g = c.createLinearGradient(0, from, 0, solid);
  g.addColorStop(0, "rgba(10,18,32,0)");
  g.addColorStop(1, `rgba(10,18,32,${alpha})`);
  c.fillStyle = g;
  c.fillRect(0, from, SHARE_W, SHARE_H - from);
  c.fillStyle = `rgba(10,18,32,${alpha})`;
  c.fillRect(0, solid, SHARE_W, SHARE_H - solid);
}

/** "APEX." with the orange full stop. Returns its width. */
function wordmark(c: Ctx, x: number, y: number, size: number, align: "left" | "right" | "center" = "left") {
  font(c, `900 ${size}px ${T.head}`, size * 0.14, true);
  const w = c.measureText("APEX").width, dot = c.measureText(".").width;
  const left = align === "left" ? x : align === "right" ? x - w - dot : x - (w + dot) / 2;
  c.textAlign = "left";
  c.fillStyle = T.text;
  c.fillText("APEX", left, y);
  c.fillStyle = T.act;
  c.fillText(".", left + w, y);
  return w + dot;
}

function crownShape(c: Ctx, { x, y, size }: CrownPlacement) {
  const k = size / 64;
  c.save();
  c.translate(x, y);
  c.rotate(-0.1);
  c.scale(k, k);
  c.translate(-32, -21);
  c.shadowColor = "rgba(245,158,11,.6)";
  c.shadowBlur = 24 / k;
  const g = c.createLinearGradient(0, 0, 0, 40);
  g.addColorStop(0, T.text);
  g.addColorStop(0.35, T.warn);
  g.addColorStop(1, T.warnDeep);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(4, 34); c.lineTo(2, 10); c.lineTo(18, 22); c.lineTo(32, 4); c.lineTo(46, 22); c.lineTo(62, 10); c.lineTo(60, 34);
  c.closePath();
  c.fill();
  roundRect(c, 4, 32, 56, 7, 2);
  c.fill();
  c.shadowBlur = 0;
  c.fillStyle = T.text;
  for (const [cx, cy, r] of [[32, 4, 3], [2, 10, 2.4], [62, 10, 2.4]] as const) {
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

function strip(c: Ctx, d: ShareCanvasData) {
  font(c, `700 27px ${T.head}`, 6);
  c.fillStyle = T.text;
  c.textAlign = "left";
  c.fillText("WORKOUT COMPLETE", 60, 90);

  fadeBottom(c, SHARE_H * 0.64, SHARE_H * 0.82, 0.96);
  const y0 = 1490;
  c.fillStyle = T.act;
  roundRect(c, 60, y0, 132, 9, 4); c.fill();
  c.fillStyle = T.text;
  fit(c, d.workoutName.toUpperCase(), 51, 960, (s) => font(c, `900 ${s}px ${T.head}`, s * 0.04, true));
  c.fillText(d.workoutName.toUpperCase(), 60, y0 + 75);

  const stats: [string, string][] = [[kg(d.totalKg), "KG LIFTED"], [String(d.sets), "SETS"], [String(d.minutes), "MIN"]];
  stats.forEach(([v, l], i) => {
    const x = 60 + i * 330;
    if (i) {
      c.fillStyle = "rgba(255,255,255,.14)";
      c.fillRect(x - 30, y0 + 115, 2, 120);
    }
    c.fillStyle = T.text;
    font(c, `700 66px ${T.num}`);
    c.fillText(v, x, y0 + 180);
    c.fillStyle = T.text2;
    font(c, `700 26px ${T.head}`, 4.5);
    c.fillText(l, x, y0 + 228);
  });

  c.fillStyle = "rgba(255,255,255,.1)";
  c.fillRect(60, y0 + 270, 960, 2);
  font(c, `400 30px ${T.head}`);
  c.fillStyle = T.text2;
  const foot = y0 + 330;
  if (d.coach) {
    c.fillText("Coached by ", 60, foot);
    const w = c.measureText("Coached by ").width;
    font(c, `700 30px ${T.head}`);
    c.fillStyle = T.text;
    c.fillText(d.coach, 60 + w, foot);
  } else c.fillText("Tracked on APEX", 60, foot);
  wordmark(c, 1020, foot, 36, "right");
}

function crownCard(c: Ctx, d: ShareCanvasData, crown: CrownPlacement) {
  const glow = c.createRadialGradient(crown.x, crown.y, 10, crown.x, crown.y, 700);
  glow.addColorStop(0, "rgba(245,158,11,.2)");
  glow.addColorStop(1, "rgba(245,158,11,0)");
  c.fillStyle = glow;
  c.fillRect(0, 0, SHARE_W, SHARE_H);
  fadeBottom(c, SHARE_H * 0.54, SHARE_H * 0.74, 0.97);
  crownShape(c, crown);

  const cx = SHARE_W / 2;
  c.textAlign = "center";
  // Laurel-style ornament: two rules and a diamond.
  c.strokeStyle = T.warn; c.fillStyle = T.warn; c.lineWidth = 3.6;
  c.beginPath(); c.moveTo(cx - 174, 1462); c.lineTo(cx - 54, 1462); c.moveTo(cx + 54, 1462); c.lineTo(cx + 174, 1462); c.stroke();
  c.beginPath(); c.moveTo(cx, 1438); c.lineTo(cx + 9, 1462); c.lineTo(cx, 1486); c.lineTo(cx - 9, 1462); c.closePath(); c.fill();
  for (const s of [-1, 1]) {
    c.beginPath(); c.ellipse(cx + s * 30, 1458, 14, 6, s * -0.5, 0, Math.PI * 2); c.fill();
  }

  const title = d.reward.title.toUpperCase();
  fit(c, title, 51, 940, (s) => font(c, `900 ${s}px ${T.head}`, s * 0.1, true));
  c.fillStyle = T.warn;
  c.fillText(title, cx, 1572);

  const rarity = d.reward.rarity.toUpperCase();
  font(c, `800 25px ${T.head}`, 6);
  const pw = c.measureText(rarity).width + 66;
  c.lineWidth = 3;
  roundRect(c, cx - pw / 2, 1612, pw, 50, 25); c.stroke();
  c.fillText(rarity, cx + 3, 1646);

  font(c, `400 33px ${T.head}`);
  c.fillStyle = T.text;
  fit(c, `${d.reward.reason} · ${kg(d.totalKg)} kg today`, 33, 960, (s) => font(c, `400 ${s}px ${T.head}`));
  c.fillText(`${d.reward.reason} · ${kg(d.totalKg)} kg today`, cx, 1720);

  font(c, `700 39px ${T.num}`);
  c.fillStyle = T.warn;
  c.fillText(`⚡ +${d.reward.xp} XP`, cx, 1788);

  font(c, `400 28px ${T.head}`);
  c.fillStyle = T.text3;
  const left = d.coach ? `Coached by ${d.coach}  ·  ` : "";
  const lw = c.measureText(left).width;
  font(c, `900 30px ${T.head}`, 4.2, true);
  const ww = c.measureText("APEX.").width;
  const start = cx - (lw + ww) / 2;
  if (left) {
    font(c, `400 28px ${T.head}`);
    c.textAlign = "left";
    c.fillText(left, start, 1860);
  }
  wordmark(c, start + lw, 1860, 30);
}

function sticker(c: Ctx, d: ShareCanvasData, photo: ShareDraw["photo"], site: string) {
  // Top row: wordmark and the workout pill.
  wordmark(c, 48, 96, 39);
  const pill = `${d.workoutName.toUpperCase()} · DONE`;
  fit(c, pill, 26, 560, (s) => font(c, `700 ${s}px ${T.head}`, s * 0.2));
  const pw = c.measureText(pill).width + 50;
  c.fillStyle = "rgba(10,18,32,.6)";
  roundRect(c, SHARE_W - 48 - pw, 56, pw, 56, 28); c.fill();
  c.fillStyle = T.text;
  c.textAlign = "left";
  c.fillText(pill, SHARE_W - 48 - pw + 25, 94);

  const hasBars = d.lastKg !== null && d.lastKg > 0;
  const hasBest = d.reward.xp >= 100;
  const x = 42, w = 640;
  const h = 300 + (hasBars ? 118 : 0) + (hasBest ? 76 : 0);
  const y = SHARE_H - 42 - h;

  // Frosted panel: a blurred copy of the photo under a navy tint where the browser supports canvas filters.
  c.save();
  roundRect(c, x, y, w, h, 42);
  c.clip();
  if (photo && photo.width && "filter" in c) {
    c.filter = "blur(28px)";
    background(c, photo);
    c.filter = "none";
  }
  c.fillStyle = "rgba(10,18,32,.72)";
  c.fillRect(x, y, w, h);
  c.restore();
  c.strokeStyle = "rgba(255,255,255,.12)";
  c.lineWidth = 3;
  roundRect(c, x, y, w, h, 42); c.stroke();

  const px = x + 42;
  let cy = y + 66;
  font(c, `700 26px ${T.head}`, 6);
  c.fillStyle = T.text2;
  c.fillText("LIFTED TODAY", px, cy);
  cy += 96;
  font(c, `700 90px ${T.num}`);
  c.fillStyle = T.text;
  c.fillText(kg(d.totalKg), px, cy);
  const nw = c.measureText(kg(d.totalKg)).width;
  font(c, `700 36px ${T.num}`);
  c.fillStyle = T.text2;
  c.fillText("kg", px + nw + 10, cy);

  cy += 54;
  font(c, `700 31px ${T.num}`);
  if (d.vsLastKg === null) {
    c.fillStyle = T.data;
    c.fillText("First session logged", px, cy);
  } else {
    c.fillStyle = d.vsLastKg >= 0 ? T.good : T.warn;
    c.fillText(`${d.vsLastKg >= 0 ? "▲" : "▼"} ${kg(Math.abs(d.vsLastKg))} kg vs last time`, px, cy);
  }

  if (hasBars && d.lastKg !== null) {
    const max = Math.max(d.lastKg, d.totalKg), bw = w - 84 - 120;
    [["Last", d.lastKg, "rgba(169,180,200,.45)"], ["Today", d.totalKg, T.data]].forEach(([label, v, col], i) => {
      const by = cy + 40 + i * 46;
      font(c, `700 24px ${T.head}`, 2);
      c.fillStyle = T.text2;
      c.fillText(String(label).toUpperCase(), px, by + 16);
      c.fillStyle = "rgba(255,255,255,.08)";
      roundRect(c, px + 120, by, bw, 20, 10); c.fill();
      c.fillStyle = String(col);
      roundRect(c, px + 120, by, Math.max(20, (bw * Number(v)) / max), 20, 10); c.fill();
    });
    c.fillStyle = T.act;
    c.beginPath(); c.arc(px + 120 + Math.max(13, (bw * d.totalKg) / max - 10), cy + 96, 13, 0, Math.PI * 2); c.fill();
    cy += 118;
  }

  if (hasBest) {
    cy += 26;
    const t = `🏆 ${d.reward.reason}`;
    fit(c, t, 28, w - 120, (s) => font(c, `700 ${s}px ${T.head}`));
    const tw = c.measureText(t).width + 36;
    c.fillStyle = "rgba(255,106,26,.18)";
    roundRect(c, px, cy, tw, 52, 16); c.fill();
    c.fillStyle = T.act;
    c.fillText(t, px + 18, cy + 36);
    cy += 52;
  }

  cy = y + h - 40;
  font(c, `400 26px ${T.head}`);
  c.fillStyle = T.text2;
  const who = d.coach ? `Coach ${d.coach}` : "Train with me";
  c.fillText(who, px, cy);
  c.textAlign = "right";
  fit(c, site, 26, w - 84 - c.measureText(who).width - 30, (s) => font(c, `700 ${s}px ${T.head}`));
  c.fillStyle = T.text;
  c.fillText(site, x + w - 42, cy);
  c.textAlign = "left";
}

export function drawShareCard(canvas: HTMLCanvasElement, p: ShareDraw) {
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const c = canvas.getContext("2d");
  if (!c) return;
  c.textBaseline = "alphabetic";
  background(c, p.photo);
  if (p.style === "strip") strip(c, p.data);
  else if (p.style === "crown") crownCard(c, p.data, p.crown);
  else sticker(c, p.data, p.photo, p.site);
}
