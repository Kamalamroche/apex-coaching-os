import { CARD_W, cardHeight, photoBandBox, type CardFormat } from "@apex/ui";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * A see-through handle over the numbers on a photo card. The client drags it up or down to put the numbers
 * anywhere on the picture: at the bottom, in the middle, or just under the logo. Arrow keys work too.
 */
export function PlaceDrag({ canvas, format, place, onPlace, watch }: {
  canvas: RefObject<HTMLCanvasElement>;
  format: CardFormat;
  place: number;
  onPlace: (p: number) => void;
  /** Anything that swaps the canvas element (e.g. the slide index), so the handle re-measures. */
  watch?: unknown;
}) {
  const [geo, setGeo] = useState<{ left: number; top: number; scale: number } | null>(null);
  const drag = useRef<{ y: number; place: number } | null>(null);
  const [active, setActive] = useState(false);
  const h = cardHeight(format);
  const box = photoBandBox(format);
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
  const top = geo.top + (box.minTop + range * place) * geo.scale;
  const set = (p: number) => onPlace(Math.round(Math.min(1, Math.max(0, p)) * 1000) / 1000);
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
        drag.current = { y: e.clientY, place };
        setActive(true);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        set(drag.current.place + (e.clientY - drag.current.y) / geo.scale / range);
      }}
      onPointerUp={(e) => { e.stopPropagation(); drag.current = null; setActive(false); }}
      onPointerCancel={() => { drag.current = null; setActive(false); }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); set(place - 0.05); }
        if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); set(place + 0.05); }
      }}
    >
      <span className="pd-chip" aria-hidden="true">Drag to move</span>
    </div>
  );
}
