import qrcode from "qrcode-generator";
import { logoSvg } from "@apex/ui";

/* A QR code for the coach's page, and a printable A4 poster for gym, studio and café noticeboards.
   qrcode-generator (MIT, no dependencies) draws the code; everything else is plain HTML printed by the browser. */

/** The QR code as an SVG string, black on white, scalable. */
export function qrSvg(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface PosterText {
  name: string;
  headline: string;
  specialties: string[];
  /** "2 places left in November", or null. */
  spots: string | null;
  /** "First session free", or null. */
  offer: string | null;
  link: string;
}

/** A full HTML page: A4, Daylight paper, Roman-capital name, the offer, the QR code and the short link. */
export function posterHtml(p: PosterText): string {
  const short = p.link.replace(/^https?:\/\//, "");
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${esc(p.name)} · Train with me</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;900&family=Libre+Bodoni:wght@400;500&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#F3F2EF;color:#121418;font-family:Archivo,system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.p{width:210mm;height:297mm;padding:22mm 20mm 18mm;display:flex;flex-direction:column}
.mark{display:flex}.mark svg{height:8mm;width:auto}
.eyebrow{margin-top:24mm;display:flex;align-items:center;gap:4mm;font-weight:600;font-size:10pt;letter-spacing:.32em;text-transform:uppercase;color:#4E525B}
.eyebrow:before{content:"";width:12mm;height:1.2mm;background:#E85A0C}
h1{margin:7mm 0 0;font:500 64pt/0.95 'Libre Bodoni',Didot,Georgia,serif;text-transform:uppercase;letter-spacing:.01em}
.head{margin:7mm 0 0;font:400 20pt/1.3 'Libre Bodoni',Georgia,serif;color:#4E525B;max-width:150mm}
.tags{margin-top:8mm;display:flex;flex-wrap:wrap;gap:3mm}
.tags span{border:1px solid #CDC9C1;border-radius:99px;padding:2.2mm 4.5mm;font-size:10.5pt}
.offer{margin-top:9mm;display:flex;gap:4mm;flex-wrap:wrap}
.offer b{background:#E85A0C;color:#fff;border-radius:99px;padding:2.6mm 5mm;font-size:10pt;letter-spacing:.12em;text-transform:uppercase}
.offer b.quiet{background:none;color:#121418;border:1.5px solid #121418}
.grow{flex:1}
.qr{display:flex;align-items:flex-end;gap:10mm;border-top:1px solid #E1DED8;padding-top:10mm}
.qr svg{width:58mm;height:58mm;background:#fff;padding:2mm;border-radius:3mm}
.qr p{margin:0;font-size:12pt;line-height:1.5;color:#4E525B}
.qr strong{display:block;font:500 26pt/1.1 'Libre Bodoni',Georgia,serif;color:#121418;margin-bottom:3mm}
.qr code{font:600 11pt ui-monospace,monospace;color:#121418}
.foot{margin-top:8mm;font-size:9pt;color:#80848C}
@media screen{body{display:grid;place-items:center;padding:24px;background:#EAE8E4}.p{background:#F3F2EF;box-shadow:0 10px 40px rgba(0,0,0,.15)}}
</style></head><body><div class="p">
<div class="mark">${logoSvg(30, "#121418")}</div>
<div class="eyebrow">Train with me</div>
<h1>${esc(p.name)}</h1>
${p.headline ? `<p class="head">${esc(p.headline)}</p>` : ""}
${p.specialties.length ? `<div class="tags">${p.specialties.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}
${p.offer || p.spots ? `<div class="offer">${p.offer ? `<b>${esc(p.offer)}</b>` : ""}${p.spots ? `<b class="quiet">${esc(p.spots)}</b>` : ""}</div>` : ""}
<div class="grow"></div>
<div class="qr">${qrSvg(p.link)}<p><strong>Scan to ask about training</strong>A plan written for you, sessions guided in the app, and a coach who checks in every week.<br><code>${esc(short)}</code></p></div>
<div class="foot">Made with APEX</div>
</div><script>document.fonts.ready.then(()=>setTimeout(()=>print(),300))</script></body></html>`;
}

/** Opens the poster in a new tab and prints it. Returns false when the browser blocked the tab. */
export function printPoster(p: PosterText): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(posterHtml(p));
  w.document.close();
  return true;
}

/** Saves the QR code as an SVG file (sharp at any print size). */
export function downloadQr(link: string, name: string) {
  const blob = new Blob([qrSvg(link)], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
