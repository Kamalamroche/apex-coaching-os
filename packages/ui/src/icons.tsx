import {
  Activity, ArrowLeftRight, BicepsFlexed, Brain, CalendarDays, ChartColumn, Check, Dumbbell, FileText, Flame, GripVertical, Heart, LayoutList, Menu,
  MessageSquare, Moon, NotebookPen, Play, Plus, TrendingUp, Trophy, Users, UtensilsCrossed, Weight, X, Zap, type LucideIcon,
} from "lucide-react";
import type { ReactElement, SVGProps } from "react";

/* One icon family across the app: Lucide (ISC licence), drawn at a 1.75 stroke for a lighter, more refined line.
   Each icon takes normal SVG props, so size it with width/height or CSS. The logo and the demo figure are our own. */
type Icon = (p: SVGProps<SVGSVGElement>) => ReactElement;
const lucide = (C: LucideIcon): Icon => (p) => <C strokeWidth={1.75} absoluteStrokeWidth={false} {...(p as object)} />;

export const Icons = {
  brief: lucide(Activity),
  clients: lucide(Users),
  build: lucide(LayoutList),
  food: lucide(UtensilsCrossed),
  money: lucide(ChartColumn),
  today: lucide(CalendarDays),
  train: lucide(Dumbbell),
  progress: lucide(TrendingUp),
  chat: lucide(MessageSquare),
  more: lucide(Menu),
  play: (p) => <Play width={20} height={20} fill="currentColor" strokeWidth={1.5} {...(p as object)} />,
  plates: lucide(Weight),
  trophy: lucide(Trophy),
  grip: lucide(GripVertical),
  file: lucide(FileText),
  plus: lucide(Plus),
  check: lucide(Check),
  close: lucide(X),
  flame: lucide(Flame),
  heart: lucide(Heart),
  note: lucide(NotebookPen),
  swap: lucide(ArrowLeftRight),
  logo: (p) => <svg width={30} height={30} viewBox="0 0 40 40" fill="none" {...p}><path d="M20 4 37 34H3Z" stroke="var(--act)" strokeWidth={3.5} strokeLinejoin="round" /><path d="M20 16l7 12H13Z" fill="var(--blue)" /></svg>,
  figure: (p) => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" {...p}><circle cx="32" cy="12" r="5" /><path d="M32 18v18M32 24l-12 6M32 24l12 6M32 36l-8 18M32 36l8 18" /></svg>,
  sleep: lucide(Moon),
  energy: lucide(Zap),
  soreness: lucide(BicepsFlexed),
  stress: lucide(Brain),
} satisfies Record<string, Icon>;

export type IconName = keyof typeof Icons;
