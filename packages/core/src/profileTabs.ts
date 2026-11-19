/* Client profile: 13 tabs grouped into five, so the coach picks a group first and the group's tabs second.
   Pure: works on whatever tabs a profile has (the demo and live profiles differ slightly). */

export const PROFILE_GROUPS = [
  { id: "overview", label: "Overview", tabs: ["Overview", "Health"] },
  { id: "training", label: "Training", tabs: ["Programme", "In person", "Report"] },
  { id: "checkins", label: "Check-ins", tabs: ["Check-ins", "Form checks", "Assessment"] },
  { id: "lifestyle", label: "Lifestyle", tabs: ["Habits", "Nutrition", "Recovery"] },
  { id: "about", label: "About", tabs: ["About", "Goals", "Notes"] },
] as const;

export interface TabGroup<T extends string> { id: string; label: string; tabs: T[] }

/** The groups that have at least one of `tabs`, in group order. A tab in no group gets a group of its own at the end. */
export function groupProfileTabs<T extends string>(tabs: readonly T[]): TabGroup<T>[] {
  const out: TabGroup<T>[] = [];
  const seen = new Set<string>();
  for (const g of PROFILE_GROUPS) {
    const mine = (g.tabs as readonly string[]).filter((t) => tabs.includes(t as T)) as T[];
    mine.forEach((t) => seen.add(t));
    if (mine.length) out.push({ id: g.id, label: g.label, tabs: mine });
  }
  for (const t of tabs) if (!seen.has(t)) out.push({ id: t, label: t, tabs: [t] });
  return out;
}

/** The group a tab sits in. */
export function groupOfTab<T extends string>(groups: TabGroup<T>[], tab: T): TabGroup<T> | undefined {
  return groups.find((g) => g.tabs.includes(tab));
}
