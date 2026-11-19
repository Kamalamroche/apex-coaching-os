import { groupOfTab, groupProfileTabs } from "@apex/core";
import { useMemo } from "react";

/**
 * Client profile navigation: five groups on top, the open group's tabs underneath (only when it has more than one).
 * `badge` adds a note such as "2 new"; a group shows a dot when any of its tabs has one.
 */
export function ProfileTabs<T extends string>({ tabs, tab, setTab, badge }: { tabs: readonly T[]; tab: T; setTab: (t: T) => void; badge?: (t: T) => string | null }) {
  const groups = useMemo(() => groupProfileTabs(tabs), [tabs]);
  const open = groupOfTab(groups, tab) ?? groups[0];
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="chips" role="tablist" aria-label="Client sections">
        {groups.map((g) => {
          const dot = g.tabs.some((t) => badge?.(t));
          return (
            <button key={g.id} role="tab" aria-selected={open?.id === g.id} className={`chip ${open?.id === g.id ? "on" : ""}`} onClick={() => { if (open?.id !== g.id) setTab(g.tabs[0]!); }}>
              {g.label}{dot && <i className="pt-dot" aria-label="Something new" />}
            </button>
          );
        })}
      </div>
      {open && open.tabs.length > 1 && (
        <div className="seg pt-sub" role="tablist" aria-label={open.label}>
          {open.tabs.map((t) => {
            const b = badge?.(t);
            return <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}{b ? ` · ${b}` : ""}</button>;
          })}
        </div>
      )}
    </div>
  );
}
