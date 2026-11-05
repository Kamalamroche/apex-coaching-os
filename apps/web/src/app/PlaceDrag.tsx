import { BAND_SIZE, CARD_W, cardHeight, photoBandBox, type CardFormat } from "@apex/ui";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

const clampSize = (n: number) => Math.round(Math.min(BAND_SIZE.max, Math.max(BAND_SIZE.min, n)) * 100) / 100;

/**
 * A see-through handle over the numbers on a photo card. The client drags it up or down to put the numbers
 * anywhere on the picture (bottom, middle, just under the logo) and pinches it to make them bigger or smaller.
 * Arrow keys move it, + and − resize it.
 */
export function PlaceDrag({ canvas, format, place, onPlace, size, onSize, watch }: {
  canvas: RefObject<HTMLCanvasElement>;
  format: CardFormat;
  place: number;
  onPlace: (p: number) => void;
  size: number;
  onSize: (s: number) => void;
  /** Anything that swaps the canvas element (e.g. the slide index), so the handle re-measures. */
  watch?: unknown;
}) {
  const [geo, setGeo] = useState<{ left: number; top: number; scale: number } | null>(null);
  const drag = useRef<{ y: number; place: number } | null>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; size: number } | null>(null);
  const [active, setActive] = useState(false);
  const h = cardHeight(format);
  const box = photoBandBox(format, size);
  const range = box.maxTop - box.minTop;

  useLayoutEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const measure = () => {
      // The canvas may be letterboxed (object-fit: contain): find where the picture really is.
      const w = cv.clientWidth, ht = cv.clientHeight;
      const scale = Math.min(w / CARD_W, ht / h);
      setGeo({ left: cv.offsetLeft + (w - CARD_W * scale) / 2, top: cv.offsetTop + (ht - h * scale) / 2, scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [canvas, h, watch]);

  if (!geo) return null;
  function end(id: number) {
    pts.current.delete(id);
    pinch.current = null;
    drag.current = null;
    if (!pts.current.size) setActive(false);
  }
  const top = geo.top + (box.minTop + range * place) * geo.scale;
  const set = (p: number) => onPlace(Math.round(Math.min(1, Math.max(0, p)) * 1000) / 1000);
  const spread = () => {
    const [a, b] = [...pts.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  return (
    <div
      className={`pd ${active ? "on" : ""}`}
      role="slider"
      tabIndex={0}
      aria-label="Where the numbers sit on your photo"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(place * 100)}
      aria-valuetext={place > 0.9 ? "Bottom" : place < 0.1 ? "Top" : "Middle"}
      style={{ left: geo.left, top, width: CARD_W * geo.scale, height: box.height * geo.scale }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.current.size === 2) { drag.current = null; pinch.current = { d: spread(), size }; }
        else drag.current = { y: e.clientY, place };
        setActive(true);
      }}
      onPointerMove={(e) => {
        if (!pts.current.has(e.pointerId)) return;
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch.current && pinch.current.d > 0) onSize(clampSize(pinch.current.size * (spread() / pinch.current.d)));
        else if (drag.current && range > 0) set(drag.current.place + (e.clientY - drag.current.y) / geo.scale / range);
      }}
      onPointerUp={(e) => { e.stopPropagation(); end(e.pointerId); }}
      onPointerCancel={(e) => end(e.pointerId)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); set(place - 0.05); }
        if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); set(place + 0.05); }
        if (e.key === "+" || e.key === "=") { e.preventDefault(); onSize(clampSize(size + 0.1)); }
        if (e.key === "-") { e.preventDefault(); onSize(clampSize(size - 0.1)); }
      }}
    >
      <span className="pd-chip" aria-hidden="true">Drag to move · pinch to resize</span>
    </div>
  );
}

/** A small "Size" slider for the numbers on a photo card, for anyone who'd rather not pinch. */
export function SizeSlider({ size, onSize, dark = false }: { size: number; onSize: (s: number) => void; dark?: boolean }) {
  return (
    <label className={`pd-size ${dark ? "dark" : ""}`}>
      <span>Size</span>
      <span className="pd-a sm" aria-hidden="true">A</span>
      <input type="range" min={BAND_SIZE.min} max={BAND_SIZE.max} step={0.05} value={size} onChange={(e) => onSize(clampSize(Number(e.target.value)))} aria-label="Size of the numbers on your photo" />
      <span className="pd-a lg" aria-hidden="true">A</span>
    </label>
  );
}
