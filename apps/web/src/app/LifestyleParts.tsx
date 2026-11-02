import type { HabitKind, LifestyleState } from "@apex/core";
import { Icons } from "@apex/ui";

const ICON: Record<HabitKind, keyof typeof Icons> = { water: "water", steps: "run", sleep: "sleep", protein: "protein", veg: "veg", mobility: "mobility", custom: "check" };

export const HabitIcon = ({ kind }: { kind: HabitKind }) => {
  const I = Icons[ICON[kind]];
  return <span className="hb-ico" aria-hidden><I /></span>;
};

/** Weekdays a habit runs on, in words. */
export function daysText(days: number[]): string {
  if (days.length === 7) return "Every day";
  const s = [...days].sort().join();
  if (s === "0,1,2,3,4") return "Weekdays";
  if (s === "5,6") return "Weekends";
  return [...days].sort().map((d) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d]).join(", ");
}

/** Why habits, nutrition or the questionnaire can't show, if they can't. Null when all is well. */
export function LifestyleStatus({ state }: { state: LifestyleState }) {
  if (state.status === "loading") return <div className="card small">Loading…</div>;
  if (state.status === "needs-update") return <div className="card small">This needs a quick database update before it can save. Run the habits and nutrition SQL in Supabase, then reload.</div>;
  if (state.status === "error") return <div className="card small" style={{ borderColor: "var(--crit)" }}>Couldn't load this: {state.error}</div>;
  return null;
}
