import type { ReactElement, SVGProps } from "react";

/* 2px geometric icon set. Each icon takes normal SVG props, so size it with width/height. */
type Icon = (p: SVGProps<SVGSVGElement>) => ReactElement;
const line = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" } as const;

export const Icons = {
  brief: (p) => <svg viewBox="0 0 24 24" {...line} strokeLinejoin="round" {...p}><path d="M4 13h4l2-5 4 10 2-5h4" /></svg>,
  clients: (p) => <svg viewBox="0 0 24 24" {...line} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.5 3 5.2" /></svg>,
  build: (p) => <svg viewBox="0 0 24 24" {...line} {...p}><path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12" /></svg>,
  food: (p) => <svg viewBox="0 0 24 24" {...line} {...p}><path d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" /><path d="M12 5V3M9 3h6M12 13l3-3" /></svg>,
  money: (p) => <svg viewBox="0 0 24 24" {...line} {...p}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg>,
  today: (p) => <svg viewBox="0 0 24 24" {...line} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>,
  train: (p) => <svg viewBox="0 0 24 24" {...line} {...p}><path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12" /></svg>,
  progress: (p) => <svg viewBox="0 0 24 24" {...line} strokeLinejoin="round" {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>,
  chat: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" {...p}><path d="M4 5h16v11H9l-5 4z" /></svg>,
  more: (p) => <svg viewBox="0 0 24 24" {...line} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  play: (p) => <svg viewBox="0 0 24 24" fill="currentColor" width={20} height={20} {...p}><path d="M8 5v14l11-7z" /></svg>,
  plates: (p) => <svg viewBox="0 0 24 24" {...line} {...p}><path d="M2 12h20" /><rect x="6" y="5" width="3" height="14" rx="1" /><rect x="15" y="5" width="3" height="14" rx="1" /></svg>,
  trophy: (p) => <svg viewBox="0 0 24 24" {...line} strokeLinejoin="round" {...p}><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8" /></svg>,
  grip: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>,
  file: (p) => <svg viewBox="0 0 24 24" {...line} strokeLinejoin="round" {...p}><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4M9 13h6M9 17h4" /></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" {...line} {...p}><path d="M12 5v14M5 12h14" /></svg>,
  logo: (p) => <svg width={30} height={30} viewBox="0 0 40 40" fill="none" {...p}><path d="M20 4 37 34H3Z" stroke="var(--act)" strokeWidth={3.5} strokeLinejoin="round" /><path d="M20 16l7 12H13Z" fill="var(--blue)" /></svg>,
  run: (p) => <svg viewBox="0 0 24 24" {...line} strokeLinejoin="round" {...p}><circle cx="15" cy="4.5" r="2" /><path d="M10 21l2.5-5.5L10 12l4-4 2.5 3.5H20M6.5 10.5 10 8M12.5 15.5 16 21M4 15h4" /></svg>,
  swim: (p) => <svg viewBox="0 0 24 24" {...line} strokeLinejoin="round" {...p}><circle cx="17" cy="7" r="2" /><path d="M3 12.5l5-3.5 3 3 3-2M2 17c1.7 0 1.7-1.2 3.3-1.2S7 17 8.7 17s1.7-1.2 3.3-1.2 1.7 1.2 3.3 1.2 1.7-1.2 3.3-1.2S20.3 17 22 17M2 21c1.7 0 1.7-1.2 3.3-1.2S7 21 8.7 21s1.7-1.2 3.3-1.2 1.7 1.2 3.3 1.2 1.7-1.2 3.3-1.2S20.3 21 22 21" /></svg>,
  ride: (p) => <svg viewBox="0 0 24 24" {...line} strokeLinejoin="round" {...p}><circle cx="5.5" cy="16.5" r="3.5" /><circle cx="18.5" cy="16.5" r="3.5" /><path d="M5.5 16.5 9 9h6l3.5 7.5M12 16.5 9 9M15 9l-1-3h-2.5" /></svg>,
  row: (p) => <svg viewBox="0 0 24 24" {...line} strokeLinejoin="round" {...p}><path d="M3 18h18M5 18l3-5h8l3 5M12 13V5M9 8h6" /></svg>,
  walk: (p) => <svg viewBox="0 0 24 24" {...line} strokeLinejoin="round" {...p}><circle cx="13" cy="4.5" r="2" /><path d="M10 21l2-6-2-3 1-4 3 3h3M9 21l-1-4M8 12l2-4" /></svg>,
  hike: (p) => <svg viewBox="0 0 24 24" {...line} strokeLinejoin="round" {...p}><path d="M2 20 9 8l4 6 3-4 6 10z" /><path d="M7.5 10.5 9 12l1.5-1.5" /></svg>,
  pulse: (p) => <svg viewBox="0 0 24 24" {...line} strokeLinejoin="round" {...p}><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" /><path d="M7 12h2.5l1.2-2 2 4 1.3-2H17" /></svg>,
  link: (p) => <svg viewBox="0 0 24 24" {...line} strokeLinejoin="round" {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>,
  upload: (p) => <svg viewBox="0 0 24 24" {...line} strokeLinejoin="round" {...p}><path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" /></svg>,
  figure: (p) => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" {...p}><circle cx="32" cy="12" r="5" /><path d="M32 18v18M32 24l-12 6M32 24l12 6M32 36l-8 18M32 36l8 18" /></svg>,
} satisfies Record<string, Icon>;

export type IconName = keyof typeof Icons;
