/* Client success stories: real numbers from a client's training, shared only after the client says yes. Pure. */

export type StoryKey = "weeks" | "workouts" | "bests" | "lift" | "weight";
export const STORY_KEYS: StoryKey[] = ["lift", "bests", "workouts", "weeks", "weight"];

export interface StoryNumbers {
  weeks?: number;
  workouts?: number;
  bests?: number;
  lift?: { name: string; from: number; to: number };
  weight?: { from: number; to: number };
}

export type StoryStatus = "asked" | "approved" | "declined";

export interface Story {
  id: string;
  clientId: string;
  clientName: string;
  headline: string;
  numbers: StoryNumbers;
  shown: StoryKey[];
  quote: string;
  showName: boolean;
  status: StoryStatus;
  createdAt: string;
  answeredAt: string | null;
}

export interface PublicStory { headline: string; quote: string; name: string | null; numbers: StoryNumbers; at: string }

export const STORY_HEADLINE_MAX = 80;
export const STORY_QUOTE_MAX = 300;
export const STORY_STATUS_LABEL: Record<StoryStatus, string> = { asked: "Waiting for the client", approved: "On your page", declined: "Client said no" };

const kg = (n: number) => `${Math.round(n * 10) / 10} kg`;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${kg(Math.abs(n))}`;

/** Which numbers this client actually has. */
export const availableKeys = (n: StoryNumbers): StoryKey[] =>
  STORY_KEYS.filter((k) => (k === "lift" ? !!n.lift : k === "weight" ? !!n.weight : (n[k] ?? 0) > 0));

export interface StoryLine { key: StoryKey; value: string; label: string }

/** Each number as a big value and a short label. */
export function storyLines(n: StoryNumbers, shown: StoryKey[]): StoryLine[] {
  const out: StoryLine[] = [];
  for (const k of STORY_KEYS) {
    if (!shown.includes(k)) continue;
    if (k === "lift" && n.lift) out.push({ key: k, value: signed(n.lift.to - n.lift.from), label: `${n.lift.name}, ${kg(n.lift.from)} to ${kg(n.lift.to)}` });
    else if (k === "weight" && n.weight) out.push({ key: k, value: signed(n.weight.to - n.weight.from), label: "body weight" });
    else if (k === "bests" && n.bests) out.push({ key: k, value: String(n.bests), label: n.bests === 1 ? "personal best" : "personal bests" });
    else if (k === "workouts" && n.workouts) out.push({ key: k, value: String(n.workouts), label: n.workouts === 1 ? "workout done" : "workouts done" });
    else if (k === "weeks" && n.weeks) out.push({ key: k, value: String(n.weeks), label: n.weeks === 1 ? "week together" : "weeks together" });
  }
  return out;
}

/** Headline ideas from the numbers (AI suggestion style, written from rules; the trainer picks or writes their own). */
export function headlineIdeas(n: StoryNumbers, first: string): string[] {
  const ideas: string[] = [];
  if (n.lift) ideas.push(`${first}: ${n.lift.name} up ${kg(n.lift.to - n.lift.from)}`);
  if (n.weeks && n.workouts) ideas.push(`${n.workouts} workouts in ${n.weeks} weeks`);
  if (n.bests && n.bests >= 3) ideas.push(`${n.bests} personal bests and counting`);
  if (n.weight && n.weight.to < n.weight.from) ideas.push(`${first}: ${kg(n.weight.from - n.weight.to)} down, stronger than ever`);
  ideas.push(`${first}'s first ${n.weeks && n.weeks >= 4 ? `${n.weeks} weeks` : "weeks"} with me`);
  return [...new Set(ideas)].map((s) => (s.length > STORY_HEADLINE_MAX ? s.slice(0, STORY_HEADLINE_MAX) : s)).slice(0, 3);
}

export function storyProblem(headline: string, shown: StoryKey[], n: StoryNumbers): string | null {
  if (headline.trim().length < 3) return "Write a short headline.";
  if (headline.trim().length > STORY_HEADLINE_MAX) return `Keep the headline under ${STORY_HEADLINE_MAX} characters.`;
  if (!shown.some((k) => availableKeys(n).includes(k))) return "Pick at least one number to share.";
  return null;
}

/** What the client sees when asked. */
export const askStoryText = (coach: string) =>
  `${coach} would like to share your progress on their page. Only the numbers below, your words if you add them, and your name only if you say so. You can say no.`;

/** A post caption for an approved story (the trainer edits before posting). */
export function successCaption(s: Pick<PublicStory, "headline" | "quote" | "name" | "numbers">, shown: StoryKey[], link: string): string {
  const facts = storyLines(s.numbers, shown).slice(0, 3).map((l) => `${l.value} ${l.label}`).join(" · ");
  const quote = s.quote.trim() ? `\n\n"${s.quote.trim()}"${s.name ? ` ${s.name}` : ""}` : "";
  return `${s.headline}\n${facts}${quote}\n\nShared with their permission. Want a plan written for you? ${link}`;
}

export function samplePublicStories(now = new Date()): PublicStory[] {
  const ago = (d: number) => new Date(now.getTime() - d * 864e5).toISOString();
  return [
    { headline: "Aisha's back squat, up 20 kg", quote: "I never thought I'd squat my body weight. Every session counted.", name: "Aisha K.", numbers: { lift: { name: "Back squat", from: 50, to: 70 }, workouts: 38, weeks: 14 }, at: ago(9) },
    { headline: "36 workouts in 12 weeks", quote: "", name: null, numbers: { workouts: 36, weeks: 12, bests: 7 }, at: ago(30) },
  ];
}
