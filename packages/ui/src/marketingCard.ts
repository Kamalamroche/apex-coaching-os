import type { ProofLine } from "@apex/core";
import { CARD_W, cardHeight, type CardFormat } from "./storyCard";
import { drawApexLogo } from "./brandMark";

/* Coach marketing posts: proof in numbers, a client's review, places left and the current offer.
   Same quiet style as the client share cards (thin serif numbers, small spaced capitals, one orange accent,
   the APEX mark, the coach's name), in two looks: Night (deep near-black) and Daylight (warm paper). */

/** Studio: the night look over one of the APEX studio photos (pass `photo`). */
export type MarketingCardTheme = "night" | "day" | "studio";

export type MarketingCardData =
  | { kind: "proof"; days: number; lines: ProofLine[] }
  | { kind: "review"; body: string; stars: number; name: string | null }
  | { kind: "spots"; left: number; month: string }
  | { kind: "offer"; title: string; text: string; ends: string }
  /** A client's success story: real numbers the client approved, their words, their name only if they allowed it. */
  | { kind: "result"; headline: string; lines: { value: string; label: string }[]; quote: string; name: string | null };

export interface MarketingCardDraw {
  card: MarketingCardData;
  format: CardFormat;
  theme: MarketingCardTheme;
  coach: string;
  /** "apex.coach/c/kamal" */
  site: string;
  /** The studio photo for the Studio look. */
  photo?: CanvasImageSource | null;
  /** Where to frame the photo, 0 (top) to 1 (bottom). */
  photoFocus?: number;
}

const THEMES = {
  night: { bg: "#0D0F13", bg2: "#151922", text: "#F5F5F3", text2: "#AAAFB9", text3: "#717783", line: "rgba(255,255,255,.12)", act: "#FF6A1A", blue: "#5A73D6" },
  day: { bg: "#F3F2EF", bg2: "#EAE8E4", text: "#121418", text2: "#4E525B", text3: "#80848C", line: "rgba(18,20,24,.12)", act: "#E85A0C", blue: "#3A54B4" },
  studio: { bg: "#0D0F13", bg2: "#151922", text: "#F5F5F3", text2: "#C4C7CE", text3: "#8A8F99", line: "rgba(255,255,255,.16)", act: "#FF6A1A", blue: "#5A73D6" },
};
const SANS = "Archivo, system-ui, sans-serif";
const SERIF = "'Libre Bodoni', 'Bodoni 72', Didot, Georgia, serif";
const PAD = 96;

type Ctx = CanvasRenderingContext2D;
type Theme = (typeof THEMES)["night"];

function font(c: Ctx, f: string, spacing = 0) {
  c.font = f;
  const x = c as Ctx & { letterSpacing?: string };
  if ("letterSpacing" in x) x.letterSpacing = `${spacing}px`;
}

/** Words wrapped to lines no wider than `max`. */
function wrap(c: Ctx, text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (c.measureText(next).width > max && line) { out.push(line); line = w; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** The largest serif size (down to `min`) at which `text` fits in `maxLines` lines. */
function fitWrap(c: Ctx, text: string, size: number, min: number, maxLines: number, weight = 400): { size: number; lines: string[] } {
  for (let z = size; z >= min; z -= 2) {
    font(c, `${weight} ${z}px ${SERIF}`);
    const lines = wrap(c, text, CARD_W - PAD * 2);
    if (lines.length <= maxLines) return { size: z, lines };
  }
  font(c, `${weight} ${min}px ${SERIF}`);
  const lines = wrap(c, text, CARD_W - PAD * 2);
  const cut = lines.slice(0, maxLines);
  if (lines.length > maxLines) cut[maxLines - 1] = `${cut[maxLines - 1]!.replace(/[,.;:]?$/, "")}…`;
  return { size: min, lines: cut };
}

/** The photo across the top of the card, fading into the background where the words sit. Returns where the words can start. */
function photoBand(c: Ctx, t: Theme, h: number, photo: CanvasImageSource, focus: number, bandH: number): void {
  const iw = (photo as HTMLImageElement).naturalWidth || (photo as HTMLCanvasElement).width || CARD_W;
  const ih = (photo as HTMLImageElement).naturalHeight || (photo as HTMLCanvasElement).height || bandH;
  const scale = Math.max(CARD_W / iw, bandH / ih);
  const dw = iw * scale, dh = ih * scale;
  const dy = -(dh - bandH) * focus;
  c.drawImage(photo, (CARD_W - dw) / 2, dy, dw, dh);
  const g = c.createLinearGradient(0, 0, 0, bandH);
  g.addColorStop(0, "rgba(13,15,19,.72)");
  g.addColorStop(0.22, "rgba(13,15,19,.05)");
  g.addColorStop(0.62, "rgba(13,15,19,.35)");
  g.addColorStop(1, t.bg);
  c.fillStyle = g;
  c.fillRect(0, 0, CARD_W, bandH);
  c.fillStyle = t.bg;
  c.fillRect(0, bandH - 1, CARD_W, h - bandH + 1);
}

function frame(c: Ctx, t: Theme, h: number, corner: string, coach: string, site: string, photo?: { img: CanvasImageSource; focus: number; band: number }) {
  if (photo) photoBand(c, t, h, photo.img, photo.focus, photo.band);
  else {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, t.bg2);
    g.addColorStop(1, t.bg);
    c.fillStyle = g;
    c.fillRect(0, 0, CARD_W, h);
  }
  const top = h > 1500 ? 160 : 120;
  font(c, `900 40px ${SANS}`, 5);
  c.textAlign = "left";
  c.fillStyle = t.text;
  drawApexLogo(c, PAD, top - 46 * 0.9125, 46, t.text);
  font(c, `500 24px ${SANS}`, 5);
  c.fillStyle = photo ? t.text : t.text3;
  c.textAlign = "right";
  c.fillText(corner.toUpperCase(), CARD_W - PAD, top - 4);
  const foot = h - (h > 1500 ? 150 : 104);
  c.fillStyle = t.line;
  c.fillRect(PAD, foot - 56, CARD_W - PAD * 2, 2);
  font(c, `500 28px ${SANS}`, 1);
  c.fillStyle = t.text2;
  c.textAlign = "left";
  c.fillText(`Coached by ${coach}`, PAD, foot);
  font(c, `400 24px ${SANS}`, 1);
  c.fillStyle = t.text3;
  c.textAlign = "right";
  c.fillText(site, CARD_W - PAD, foot);
  c.textAlign = "left";
}

function eyebrow(c: Ctx, t: Theme, s: string, y: number) {
  c.fillStyle = t.act;
  c.fillRect(PAD, y - 34, 48, 4);
  font(c, `600 26px ${SANS}`, 8);
  c.fillStyle = t.text2;
  c.fillText(s.toUpperCase(), PAD, y + 24);
}

function star(c: Ctx, cx: number, cy: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

export function drawMarketingCard(canvas: HTMLCanvasElement, p: MarketingCardDraw) {
  const h = cardHeight(p.format);
  canvas.width = CARD_W;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) return;
  const t = THEMES[p.theme];
  const tall = p.format === "story";
  const card = p.card;
  const corner = card.kind === "proof" ? `Last ${card.days} days` : card.kind === "review" ? "Client review" : card.kind === "spots" ? card.month : card.kind === "result" ? "Client result" : "Limited offer";
  // Studio: the photo fills the top half and fades into the dark where the words sit.
  // A client's words take some of the photo's room, so they're never cut.
  const wordy = card.kind === "result" && !!card.quote.trim();
  const band = p.theme === "studio" && p.photo ? Math.round(h * (tall ? (wordy ? 0.44 : 0.5) : wordy ? 0.38 : 0.48)) : 0;
  frame(c, t, h, corner, p.coach, p.site, band ? { img: p.photo!, focus: p.photoFocus ?? 0.4, band } : undefined);
  // A tall result without a photo starts lower, so the words sit nearer the middle.
  const body = { top: band ? band - (tall ? 40 : 70) : tall ? (card.kind === "result" ? 560 : 420) : 300, bottom: h - (tall ? 260 : 200) };

  if (card.kind === "result") {
    drawResult(c, t, card, body, tall);
    return;
  }

  if (card.kind === "proof") {
    eyebrow(c, t, "My clients, real numbers", body.top);
    const lines = card.lines.slice(0, tall ? 4 : 3);
    const gap = (body.bottom - body.top - 120) / Math.max(1, lines.length);
    lines.forEach((l, i) => {
      const y = body.top + 120 + gap * i + Math.min(gap * 0.62, 190);
      const size = Math.min(tall ? 200 : 170, gap * 0.78);
      font(c, `400 ${size}px ${SERIF}`, -size * 0.02);
      c.fillStyle = t.text;
      c.fillText(l.value, PAD, y);
      const w = c.measureText(l.value).width;
      font(c, `300 ${Math.round(size * 0.22)}px ${SANS}`);
      c.fillStyle = t.text2;
      c.fillText(l.unit, PAD + w + 22, y - size * 0.36);
      c.fillStyle = t.text3;
      c.fillText(l.label, PAD + w + 22, y);
    });
    return;
  }

  if (card.kind === "review") {
    font(c, `400 ${tall ? 300 : 240}px ${SERIF}`);
    c.fillStyle = t.act;
    c.fillText("“", PAD - 12, body.top + (tall ? 170 : 130));
    const fit = fitWrap(c, card.body, tall ? 64 : 56, 34, tall ? 11 : 8);
    font(c, `400 ${fit.size}px ${SERIF}`);
    c.fillStyle = t.text;
    const lh = fit.size * 1.32;
    let y = body.top + (tall ? 260 : 200);
    for (const line of fit.lines) { c.fillText(line, PAD, y); y += lh; }
    y += 30;
    c.fillStyle = t.act;
    for (let i = 0; i < 5; i++) { c.globalAlpha = i < card.stars ? 1 : 0.25; star(c, PAD + 22 + i * 56, y, 22); }
    c.globalAlpha = 1;
    font(c, `500 30px ${SANS}`, 1);
    c.fillStyle = t.text2;
    c.fillText(card.name ? `— ${card.name}` : "— A client", PAD, y + 80);
    return;
  }

  if (card.kind === "spots") {
    eyebrow(c, t, card.left ? "Now taking new clients" : "Waiting list open", body.top);
    const mid = (body.top + body.bottom) / 2 + 80;
    const big = card.left ? String(card.left) : "Full";
    const size = tall ? 420 : 340;
    font(c, `400 ${card.left ? size : size * 0.6}px ${SERIF}`, -8);
    c.fillStyle = t.text;
    c.fillText(big, PAD - 10, mid);
    font(c, `300 ${tall ? 64 : 56}px ${SANS}`);
    c.fillStyle = t.text2;
    c.fillText(card.left ? `${card.left === 1 ? "place" : "places"} left in ${card.month}` : `for ${card.month}`, PAD, mid + (tall ? 110 : 96));
    font(c, `400 34px ${SANS}`);
    c.fillStyle = t.text3;
    c.fillText(card.left ? "I keep my client list small. Ask for a place." : "Ask to join the waiting list.", PAD, mid + (tall ? 190 : 166));
    return;
  }

  eyebrow(c, t, card.title, body.top);
  const fit = fitWrap(c, card.text, tall ? 96 : 84, 44, tall ? 7 : 5);
  font(c, `400 ${fit.size}px ${SERIF}`);
  c.fillStyle = t.text;
  const lh = fit.size * 1.22;
  let y = body.top + 150 + fit.size;
  for (const line of fit.lines) { c.fillText(line, PAD, y); y += lh; }
  y += 50;
  font(c, `600 30px ${SANS}`, 4);
  const label = card.ends.toUpperCase();
  const w = c.measureText(label).width;
  c.strokeStyle = t.act;
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(PAD, y - 46, w + 56, 68, 34);
  c.stroke();
  c.fillStyle = t.act;
  c.fillText(label, PAD + 28, y);
}

/** Bold sans lines that fit `width`, at the biggest size from `size` down to `min`, in `maxLines` lines. */
function fitSans(c: Ctx, text: string, size: number, min: number, maxLines: number, width: number, weight = 900, upper = true): { size: number; lines: string[] } {
  const s = upper ? text.toUpperCase() : text;
  for (let z = size; z >= min; z -= 2) {
    font(c, `${weight} ${z}px ${SANS}`, upper ? -z * 0.01 : 0);
    const lines = wrap(c, s, width);
    if (lines.length <= maxLines) return { size: z, lines };
  }
  font(c, `${weight} ${min}px ${SANS}`, upper ? -min * 0.01 : 0);
  const lines = wrap(c, s, width);
  const cut = lines.slice(0, maxLines);
  if (lines.length > maxLines) cut[maxLines - 1] = `${cut[maxLines - 1]!.replace(/[,.;:]?$/, "")}…`;
  return { size: min, lines: cut };
}

/** A client result in the house style: heavy sans headline, big numbers (orange first, blue markers), the client's words, all agreed. */
function drawResult(c: Ctx, t: Theme, card: Extract<MarketingCardData, { kind: "result" }>, body: { top: number; bottom: number }, tall: boolean) {
  const W = CARD_W - PAD * 2;
  eyebrow(c, t, "Real result", body.top);
  let y = body.top + 64;
  const head = fitSans(c, card.headline, tall ? (card.quote.trim() ? 96 : 112) : card.quote.trim() ? 72 : 84, 48, tall ? 3 : 2, W);
  font(c, `900 ${head.size}px ${SANS}`, -head.size * 0.01);
  c.fillStyle = t.text;
  const hl = head.size * 0.98;
  for (const line of head.lines) { y += hl; c.fillText(line, PAD, y); }

  const nums = card.lines.slice(0, 3);
  if (nums.length) {
    y += tall ? 70 : 46;
    const colW = W / nums.length;
    let size = tall ? 132 : 112;
    for (; size > 52; size -= 4) {
      font(c, `900 ${size}px ${SANS}`, -size * 0.02);
      if (nums.every((n) => c.measureText(n.value).width <= colW - 36)) break;
    }
    const vy = y + 24 + size * 0.8;
    let lowest = vy;
    nums.forEach((n, i) => {
      const x = PAD + colW * i;
      c.fillStyle = i === 0 ? t.act : t.blue;
      c.fillRect(x, y, 44, 6);
      font(c, `900 ${size}px ${SANS}`, -size * 0.02);
      c.fillStyle = i === 0 ? t.act : t.text;
      c.fillText(n.value, x, vy);
      font(c, `500 ${tall ? 30 : 27}px ${SANS}`, 0.3);
      c.fillStyle = t.text2;
      const lines = wrap(c, n.label, colW - 30).slice(0, 2);
      lines.forEach((l, j) => { const ly = vy + 48 + j * (tall ? 38 : 34); c.fillText(l, x, ly); lowest = Math.max(lowest, ly); });
    });
    y = lowest;
  }

  const quote = card.quote.trim();
  const nameLine = card.name ? `${card.name}` : "A client";
  const permY = body.bottom + (tall ? 24 : 6);
  const topGap = tall ? 76 : 46;
  const nameGap = tall ? 54 : 40;
  const limit = permY - (tall ? 50 : 34);
  const qx = PAD + 40;
  const qw = W - 40;
  let fit: { size: number; lines: string[] } | null = null;
  if (quote) {
    for (let z = tall ? 46 : 38; z >= 28 && !fit; z -= 2) {
      const max = Math.floor((limit - y - topGap - nameGap) / (z * 1.32));
      if (max < 1) continue;
      font(c, `500 ${z}px ${SANS}`);
      const all = wrap(c, `“${quote}”`, qw);
      if (all.length <= max) fit = { size: z, lines: all };
    }
    if (!fit) {
      const z = 28;
      const max = Math.floor((limit - y - topGap - nameGap) / (z * 1.32));
      if (max >= 1) {
        font(c, `500 ${z}px ${SANS}`);
        const cut = wrap(c, `“${quote}”`, qw).slice(0, max);
        cut[max - 1] = `${cut[max - 1]!.replace(/[,.;:”]?$/, "")}…”`;
        fit = { size: z, lines: cut };
      }
    }
  }
  if (fit) {
    y += topGap;
    const lh = fit.size * 1.32;
    const top = y;
    font(c, `500 ${fit.size}px ${SANS}`);
    c.fillStyle = t.text;
    for (const line of fit.lines) { y += lh; c.fillText(line, qx, y); }
    c.fillStyle = t.act;
    c.fillRect(PAD, top + lh * 0.3, 6, y - top);
    y += nameGap;
    font(c, `700 26px ${SANS}`, 4);
    c.fillStyle = t.blue;
    c.fillText(nameLine.toUpperCase(), qx, y);
  } else if (card.name && y + 80 < limit) {
    y += tall ? 80 : 60;
    font(c, `700 26px ${SANS}`, 4);
    c.fillStyle = t.blue;
    c.fillText(nameLine.toUpperCase(), PAD, y);
  }
  font(c, `600 22px ${SANS}`, 4);
  c.fillStyle = t.text3;
  c.fillText("REAL NUMBERS FROM APEX · SHARED WITH PERMISSION", PAD, permY);
}
