import type { ReactNode } from "react";
import { Icons, type IconName } from "./icons";
import { ThemeButton } from "./ThemeButton";

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

/** App frame: top bar with logo and theme, content, bottom tab bar. */
export function Shell<T extends string>({ side, switchHref, tabs, tab, setTab, wide, actions, children }: ShellProps<T>) {
  return (
    <div className={`shell ${wide ? "wide" : ""}`}>
      <div className="top">
        <a className="iconbtn" href={switchHref} aria-label="Switch app" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>← Switch</a>
        <div className="wordmark" style={{ gap: 7 }}>
          <Icons.logo width={22} height={22} />
          <b style={{ fontSize: 19 }}>APEX</b>
        </div>
        <div style={{ display: "flex", gap: 6 }}>{actions}<ThemeButton /></div>
      </div>
      <main className="main">{children}</main>
      <nav className="tabs" aria-label={`${side} navigation`}>
        {tabs.map((t) => {
          const Icon = Icons[t.icon];
          return (
            <button key={t.id} className={`tab ${tab === t.id ? "on" : ""}`} onClick={() => { setTab(t.id); window.scrollTo(0, 0); }} aria-current={tab === t.id ? "page" : undefined}>
              <Icon />
              <span>{t.label}</span>
              {t.dot && <i className="dot" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
