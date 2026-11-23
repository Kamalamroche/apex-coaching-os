import { useLayoutEffect, useRef } from "react";

/**
 * Scroll handling for a screen that swaps between a list and a detail view in place
 * (a client list and a client's profile, say). Opening a detail view starts at the top,
 * and going back to the list returns to where the coach was in it, rather than leaving
 * the page wherever the last view happened to be scrolled.
 * `view` is null for the list, or any key for the open detail view.
 */
export function useViewScroll(view: string | number | null | undefined) {
  const listY = useRef(0);
  const last = useRef(view ?? null);
  useLayoutEffect(() => {
    const now = view ?? null;
    if (now === last.current) return;
    last.current = now;
    if (now === null) window.scrollTo(0, listY.current);
    else window.scrollTo(0, 0);
  }, [view]);
  // Remember the list position while the list is showing.
  useLayoutEffect(() => {
    if ((view ?? null) !== null) return;
    const save = () => { listY.current = window.scrollY; };
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [view]);
}
