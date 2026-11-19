import { quickFind, type QuickItem } from "@apex/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "./icons";
import "./quickFind.css";

const KIND_LABEL: Record<QuickItem["kind"], string> = { client: "Client", screen: "Go to", action: "Do" };

/**
 * One search box for the whole coach app: type a name, a screen or a job and press Enter.
 * Arrow keys move, Enter opens, Escape closes. On a phone it opens from the top so the keyboard never covers results.
 */
export function QuickFind({ items, starter, onPick, onClose }: { items: QuickItem[]; starter: QuickItem[]; onPick: (item: QuickItem) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => quickFind(q, items, 8, starter), [q, items, starter]);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => setAt(0), [q]);
  const pick = (item: QuickItem | undefined) => { if (item) { onPick(item); onClose(); } };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setAt((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAt((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(results[at]); }
  };
  return (
    <div className="qf-scrim" onClick={onClose}>
      <div className="qf" role="dialog" aria-modal="true" aria-label="Quick find" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="qf-bar">
          <Icons.search width={18} height={18} aria-hidden="true" />
          <input
            ref={input}
            className="qf-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a client, screen or job"
            aria-label="Find a client, screen or job"
            role="combobox"
            aria-expanded="true"
            aria-controls="qf-list"
            aria-activedescendant={results[at] ? `qf-${at}` : undefined}
            enterKeyHint="go"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="qf-close" onClick={onClose} aria-label="Close"><Icons.close width={16} height={16} /></button>
        </div>
        {!q.trim() && <div className="qf-head">Jump to<small>Tip: type a name and a tab, like “Lena check-ins”</small></div>}
        <ul className="qf-list" id="qf-list" role="listbox">
          {results.map((r, i) => (
            <li key={r.id} id={`qf-${i}`} role="option" aria-selected={i === at}>
              <button className={`qf-row ${i === at ? "on" : ""}`} onMouseEnter={() => setAt(i)} onClick={() => pick(r)}>
                <span className={`qf-kind k-${r.kind}`}>{KIND_LABEL[r.kind]}</span>
                <span className="qf-text"><b>{r.title}</b>{r.hint && <small>{r.hint}</small>}</span>
                <Icons.forward className="qf-go" width={16} height={16} aria-hidden="true" />
              </button>
            </li>
          ))}
          {q.trim() && !results.length && <li className="qf-none">Nothing matches “{q.trim()}”. Try a first name or a word like “calendar”.</li>}
        </ul>
        <div className="qf-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span><span className="qf-tip">Open from anywhere with <kbd>/</kbd> or <kbd>⌘K</kbd></span></div>
      </div>
    </div>
  );
}

/** Opens quick find on ⌘K / Ctrl+K anywhere, or "/" when the coach isn't typing in a field. */
export function useQuickFindKeys(open: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
      else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); open(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
}
