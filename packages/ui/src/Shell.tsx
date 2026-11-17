import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Icons, type IconName } from "./icons";
import { ThemeButton } from "./ThemeButton";
import { useT } from "./prefs";

export interface TabDef<T extends string> {
  id: T;
  icon: IconName;
  label: string;
  dot?: boolean;
}

interface ShellProps<T extends string> {
  side: "Coach" | "Client";
  switchHref: string;
  tabs: TabDef<T>[];
  tab: T;
  setTab: (t: T) => void;
  wide?: boolean;
  /** Extra buttons in the top bar, e.g. Sign out. */
  actions?: ReactNode;
  children: ReactNode;
}

/** App frame: top bar with logo and theme, content, floating tab bar (the open tab shows its name, the rest are icons). */
export function Shell<T extends string>({ side, switchHref, tabs, tab, setTab, wide, actions, children }: ShellProps<T>) {
  const nav = useRef<HTMLElement>(null);
  const tr = useT();
  const pill = useRef<HTMLSpanElement>(null);
  // The dark pill behind the open tab slides to the tab you pick and stretches to its width.
  useLayoutEffect(() => {
    const n = nav.current;
    const p = pill.current;
    if (!n || !p) return;
    const place = () => {
      const on = n.querySelector<HTMLElement>(".tab.on");
      if (!on) return;
      p.style.translate = `${on.offsetLeft}px 0`;
      p.style.width = `${on.offsetWidth}px`;
    };
    place();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    n.querySelectorAll(".tab").forEach((t) => ro?.observe(t));
    // Let the first placement land without sliding in from the left.
    requestAnimationFrame(() => p.classList.add("ready"));
    return () => ro?.disconnect();
  }, [tab, tabs.length]);
  return (
    <div className={`shell ${wide ? "wide" : ""}`}>
      <div className="top">
        <a className="iconbtn" href={switchHref} aria-label="Switch app" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>{tr("← Switch")}</a>
        <div className="wordmark" style={{ gap: 7 }}>
          <Icons.logo width={22} height={22} />
          <b style={{ fontSize: 19 }}>APEX</b>
        </div>
        <div style={{ display: "flex", gap: 6 }}>{actions}<ThemeButton /></div>
      </div>
      <main className="main">{children}</main>
      <nav ref={nav} className="tabs" aria-label={`${side} navigation`}>
        <span ref={pill} className="tab-pill" aria-hidden="true" />
        {tabs.map((t) => {
          const Icon = Icons[t.icon];
          return (
            <button key={t.id} className={`tab ${tab === t.id ? "on" : ""}`} onClick={() => { setTab(t.id); window.scrollTo(0, 0); }} aria-current={tab === t.id ? "page" : undefined} aria-label={tr(t.label)} title={tr(t.label)}>
              <i className="ic"><Icon /></i>
              <span>{tr(t.label)}</span>
              {t.dot && <i className="dot" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
