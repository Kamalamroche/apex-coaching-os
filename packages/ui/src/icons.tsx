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
  logo: (p) => <svg width={30} height={30} viewBox="0 0 40 40" fill="none" {...p}><path d="M20 4 37 34H3Z" stroke="var(--act)" strokeWidth={3.5} strokeLinejoin="round" /><path d="M20 16l7 12H13Z" fill="var(--blue)" /></svg>,
  figure: (p) => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" {...p}><circle cx="32" cy="12" r="5" /><path d="M32 18v18M32 24l-12 6M32 24l12 6M32 36l-8 18M32 36l8 18" /></svg>,
} satisfies Record<string, Icon>;

export type IconName = keyof typeof Icons;
