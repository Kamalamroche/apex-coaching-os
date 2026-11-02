import { fitWithin, type PhotoUpload, type Pose } from "@apex/core";

/** Full photos are kept at most this many pixels on the long side (about 300 KB as JPEG). */
const FULL_PX = 1600;
const PREVIEW_PX = 360;

/**
 * Turns a picked or freshly taken photo into a JPEG ready to save, plus a small preview.
 * Shrinking on the phone keeps uploads quick on mobile data and the storage bill small.
 */
export async function preparePhoto(file: File, pose: Pose): Promise<PhotoUpload> {
  const img = await load(file);
  try {
    const full = draw(img.el, FULL_PX);
    const blob = await new Promise<Blob>((resolve, reject) => full.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo"))), "image/jpeg", 0.85));
    const preview = draw(img.el, PREVIEW_PX).toDataURL("image/jpeg", 0.7);
    return { pose, file: blob, preview };
  } finally {
    img.done();
  }
}

function load(file: File): Promise<{ el: HTMLImageElement; done: () => void }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve({ el, done: () => URL.revokeObjectURL(url) });
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a photo this browser can open. Try a JPEG or PNG.")); };
    el.src = url;
  });
}

function draw(img: HTMLImageElement, max: number): HTMLCanvasElement {
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
  return canvas;
}
