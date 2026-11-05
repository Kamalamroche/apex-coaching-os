/* Saving and sharing a card the client made. Images are made on the phone and only go where the client sends them. */

export const siteName = () => (typeof location !== "undefined" && location.host) || "apex-coaching-os-web.vercel.app";

const toBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((res) => {
  try { canvas.toBlob(res, "image/png"); } catch { res(null); }
});

function download(b: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/**
 * Shares one or more card images with the phone's share sheet (Instagram, TikTok, WhatsApp…), or saves them where
 * sharing files isn't supported, copying the caption. Returns a line to show the client.
 */
export async function shareCards(canvases: HTMLCanvasElement[], name: string, caption: string): Promise<string> {
  const blobs = (await Promise.all(canvases.map(toBlob))).filter((b): b is Blob => !!b);
  if (!blobs.length) return "Couldn't make the image. Try again.";
  const files = blobs.map((b, i) => new File([b], `${name}${blobs.length > 1 ? `-${i + 1}` : ""}.png`, { type: "image/png" }));
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, text: caption });
      return "Shared. Nice work.";
    } catch {
      return "";
    }
  }
  files.forEach((f) => download(f, f.name));
  try {
    await navigator.clipboard.writeText(caption);
    return files.length > 1 ? "Images saved and caption copied. Post them anywhere." : "Image saved and caption copied. Post it anywhere.";
  } catch {
    return files.length > 1 ? "Images saved. Post them anywhere." : "Image saved. Post it anywhere.";
  }
}

/** Loads a photo so it can be drawn on a canvas and still be saved (signed storage links allow this). */
export function loadPhoto(url: string | null): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    if (!url) return res(null);
    const img = new Image();
    if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

/** Plays a card in: calls draw with t from 0 to 1 over `ms`, then once more at 1. Returns a stop function. */
export function playIn(draw: (t: number) => void, ms = 1100): () => void {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced) { draw(1); return () => {}; }
  let raf = 0;
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / ms);
    draw(t);
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
