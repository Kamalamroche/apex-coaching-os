/* Client feature switches: the coach chooses which parts of the app each client sees, so a client who only
   needs training isn't shown nutrition, challenges and the rest. Everything is on until the coach turns it off.
   Stored as the list of keys the coach has hidden, so a new feature shows up for everyone by default. */

export const CLIENT_FEATURES = [
  { key: "habits", label: "Habits", note: "Daily habits on Today and in More" },
  { key: "nutrition", label: "Nutrition", note: "Food logging, targets and meal plans" },
  { key: "goals", label: "Goals", note: "Their goals and badges" },
  { key: "form", label: "Form checks", note: "Filming a set for you to check" },
  { key: "mood", label: "Daily mood", note: "The “How are you feeling?” card on Today" },
  { key: "rings", label: "Rings and levels", note: "Daily rings, streaks and levels on Today" },
  { key: "community", label: "Team and community", note: "Your team, high fives and the leaderboard" },
  { key: "challenges", label: "Challenges", note: "Joining your challenges" },
  { key: "programmes", label: "Ready-made programmes", note: "Starting one of your ready-made plans themselves" },
  { key: "book", label: "Booking", note: "Booking calls and sessions with you" },
  { key: "classes", label: "Group classes", note: "Booking a place in your classes" },
  { key: "invite", label: "Invite and review", note: "Inviting a friend and reviewing you" },
] as const;

export type ClientFeature = (typeof CLIENT_FEATURES)[number]["key"];

const KEYS = new Set<string>(CLIENT_FEATURES.map((f) => f.key));

/** Keeps only known keys, once each, in list order. Anything else (old or mistyped) is dropped. */
export function cleanHidden(list: readonly unknown[] | null | undefined): ClientFeature[] {
  const set = new Set((list ?? []).filter((k): k is string => typeof k === "string" && KEYS.has(k)));
  return CLIENT_FEATURES.map((f) => f.key).filter((k) => set.has(k));
}

/** True unless the coach has hidden it. */
export function featureOn(hidden: readonly string[], key: ClientFeature): boolean {
  return !hidden.includes(key);
}

/** Turns one feature on or off. */
export function toggleFeature(hidden: readonly string[], key: ClientFeature): ClientFeature[] {
  return cleanHidden(hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]);
}

/** A short line for the coach: "Everything on" or "3 of 12 hidden". */
export function featuresSummary(hidden: readonly string[]): string {
  const n = cleanHidden(hidden).length;
  return n === 0 ? "Everything on" : `${n} of ${CLIENT_FEATURES.length} hidden`;
}
