import { useRef, useState, type PointerEvent } from "react";
import { Icons } from "./icons";

/** Swipe-to-start control. Drag the knob to the end to start; a tap, Enter or Space also starts it,
    so it works with a mouse, a keyboard and a screen reader. `solid` is for use on a plain card instead of a photo. */
export function SwipeStart({ label, onStart, disabled, solid }: { label: string; onStart: () => void; disabled?: boolean; solid?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; max: number; moved: boolean } | null>(null);
  const [dx, setDx] = useState(0);

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || !ref.current) return;
    drag.current = { x: e.clientX, max: ref.current.clientWidth - 58, moved: false };
    ref.current.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const x = Math.max(0, Math.min(d.max, e.clientX - d.x));
    if (x > 6) d.moved = true;
    setDx(x);
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved && dx < d.max * 0.8) { setDx(0); return; }
    setDx(d.max);
    setTimeout(onStart, 160);
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`swipe ${solid ? "solid" : ""}`}
      disabled={disabled}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => { drag.current = null; setDx(0); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStart(); } }}
      aria-label={label}
    >
      <span className="fill" style={{ width: dx ? dx + 56 : 0, transition: drag.current ? "none" : "width .2s" }} />
      <span className="knob" style={{ transform: `translateX(${dx}px)`, transition: drag.current ? "none" : "transform .2s" }}><Icons.arrow strokeWidth={2.2} /></span>
      <span className="txt" style={{ opacity: dx > 40 ? 0.3 : 1 }}>{label}<Icons.swipe /></span>
    </button>
  );
}
