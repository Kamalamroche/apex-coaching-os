import { useLayoutEffect, type RefObject } from "react";

/**
 * Scroll reveal for a screen. Sections that start below the fold wait, with their animations paused, until they scroll
 * into view, so rings sweep, charts draw and numbers count while the person is looking at them rather than off screen.
 * Anything already on screen (or above it) plays straight away. Tall wrappers reveal their children one by one.
 * CSS in motion.css: `[data-rv]:not(.rv-in)` pauses; "Reduce motion" switches animation off entirely, so nothing waits.
 */
export function useReveal(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("rv-in");
          io?.unobserve(e.target);
        }
      }, { rootMargin: "0px 0px -6% 0px" })
      : null;
    const seen = new WeakSet<Element>();
    const mark = (el: Element) => {
      if (seen.has(el)) return;
      seen.add(el);
      const r = el.getBoundingClientRect();
      if (!io || r.top < window.innerHeight * 0.94) { el.classList.add("rv-in"); return; }
      el.setAttribute("data-rv", "");
      io.observe(el);
    };
    const scan = () => {
      const tall = window.innerHeight * 1.2;
      for (const el of Array.from(root.children)) {
        // A tall plain wrapper (a list of cards) reveals card by card; cards and photos reveal whole.
        if (el.getBoundingClientRect().height > tall && !el.matches(".card,.hero,.cover")) {
          el.classList.add("rv-in");
          seen.add(el);
          Array.from(el.children).forEach(mark);
        } else mark(el);
      }
    };
    scan();
    // New sections (a tab change, data arriving) are marked before the browser paints them.
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(scan) : null;
    mo?.observe(root, { childList: true, subtree: false });
    return () => { mo?.disconnect(); io?.disconnect(); };
  }, [ref]);
}
