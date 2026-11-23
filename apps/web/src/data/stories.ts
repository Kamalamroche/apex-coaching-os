import { HERO_IMAGES, availableKeys, sampleProgrammes, samplePublicStories, storyProblem, type HeroImage, type PublicStory, type Story, type StoryKey, type StoryNumbers, type StoryStatus } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/* Growth tools: client success stories, the free starter plan and the monthly income goal.
   Live: Supabase (20261201090000_growth_stories.sql). Demo: this browser, shared by the coach app, the client app and the public page. */

export const STORIES_SQL = "20261201090000_growth_stories.sql";
export const STORIES_NEED_UPDATE = `Stories, the starter plan and the income goal need a database update first: run ${STORIES_SQL} in Supabase.`;
const missing = (e: { code?: string } | null) => !!e && ["42P01", "PGRST205", "PGRST202", "42703", "PGRST204", "42883"].includes(e.code ?? "");
const fail = (e: { code?: string; message: string }) => (missing(e) ? new Error(STORIES_NEED_UPDATE) : new Error(e.message));

export interface StarterChoice { id: string; title: string; weeks: number }
export interface PublicStarter { id: string; title: string; tagline: string; weeks: number; cover: string | null }

/** Coach side. */
export interface StoriesApi {
  live: boolean;
  stories(): Promise<Story[]>;
  /** The client's real numbers since they started. */
  numbers(clientId: string): Promise<StoryNumbers>;
  ask(clientId: string, headline: string, shown: StoryKey[]): Promise<void>;
  remove(id: string): Promise<void>;
  /** Free, live programmes the coach can offer, and the one picked. */
  starter(): Promise<{ picked: string | null; choices: StarterChoice[] }>;
  setStarter(id: string | null): Promise<void>;
  incomeGoal(): Promise<number | null>;
  setIncomeGoal(pence: number | null): Promise<void>;
}

/** Client side: stories waiting for a yes or no. */
export interface ClientStoriesApi {
  waiting(): Promise<Story[]>;
  answer(id: string, approve: boolean, quote: string, showName: boolean): Promise<void>;
}

interface StoryRow { id: string; client_id: string; headline: string; numbers: StoryNumbers; shown: StoryKey[]; quote: string; show_name: boolean; status: StoryStatus; created_at: string; answered_at: string | null; profiles?: { full_name: string } | null }
const fromRow = (r: StoryRow): Story => ({
  id: r.id, clientId: r.client_id, clientName: r.profiles?.full_name ?? "Client", headline: r.headline, numbers: r.numbers ?? {}, shown: r.shown ?? [],
  quote: r.quote ?? "", showName: !!r.show_name, status: r.status, createdAt: r.created_at, answeredAt: r.answered_at,
});
const COLS = "id, client_id, headline, numbers, shown, quote, show_name, status, created_at, answered_at";

export function liveStories(db: SupabaseClient, coachId: string): StoriesApi {
  return {
    live: true,
    async stories() {
      const { data, error } = await db.from("success_stories").select(`${COLS}, profiles!success_stories_client_id_fkey(full_name)`).eq("coach_id", coachId).order("created_at", { ascending: false }).limit(100);
      if (error) throw fail(error);
      return ((data ?? []) as unknown as StoryRow[]).map(fromRow);
    },
    async numbers(clientId) {
      const { data, error } = await db.rpc("client_story_numbers", { p_client: clientId });
      if (error) throw fail(error);
      return (data ?? {}) as StoryNumbers;
    },
    async ask(clientId, headline, shown) {
      const { error } = await db.rpc("create_success_story", { p_client: clientId, p_headline: headline.trim(), p_shown: shown });
      if (error) throw fail(error);
    },
    async remove(id) {
      const { error } = await db.from("success_stories").delete().eq("id", id);
      if (error) throw fail(error);
    },
    async starter() {
      const [page, list] = await Promise.all([
        db.from("coach_pages").select("starter_id").eq("coach_id", coachId).maybeSingle(),
        db.from("programme_listings").select("id, title, weeks, status, price_pence").eq("coach_id", coachId).eq("status", "live").eq("price_pence", 0).order("created_at", { ascending: false }),
      ]);
      if (page.error) throw fail(page.error);
      if (list.error) throw fail(list.error);
      return { picked: (page.data as { starter_id: string | null } | null)?.starter_id ?? null, choices: ((list.data ?? []) as StarterChoice[]).map(({ id, title, weeks }) => ({ id, title, weeks })) };
    },
    async setStarter(id) {
      const { error } = await db.from("coach_pages").update({ starter_id: id }).eq("coach_id", coachId);
      if (error) throw fail(error);
    },
    async incomeGoal() {
      const { data, error } = await db.from("coach_pages").select("income_goal_pence").eq("coach_id", coachId).maybeSingle();
      if (error) throw fail(error);
      return (data as { income_goal_pence: number | null } | null)?.income_goal_pence ?? null;
    },
    async setIncomeGoal(pence) {
      const { data, error } = await db.from("coach_pages").update({ income_goal_pence: pence }).eq("coach_id", coachId).select("coach_id");
      if (error) throw fail(error);
      if (!data?.length) throw new Error("Set up your page first (Business → Your page and leads), then your goal can be saved.");
    },
  };
}

export function liveClientStories(db: SupabaseClient, me: string): ClientStoriesApi {
  return {
    async waiting() {
      const { data, error } = await db.from("success_stories").select(COLS).eq("client_id", me).eq("status", "asked").order("created_at", { ascending: false });
      if (error) return []; // Never block the client app before the SQL has run.
      return ((data ?? []) as StoryRow[]).map(fromRow);
    },
    async answer(id, approve, quote, showName) {
      const { error } = await db.rpc("answer_success_story", { p_id: id, p_approve: approve, p_quote: quote, p_show_name: showName });
      if (error) throw fail(error);
    },
  };
}

export const coverSrc = (cover: string | null) => (cover && cover in HERO_IMAGES ? HERO_IMAGES[cover as HeroImage].src : null);

export async function livePublicStories(db: SupabaseClient, slug: string): Promise<PublicStory[]> {
  const { data, error } = await db.rpc("public_coach_stories", { p_slug: slug });
  return error ? [] : ((data ?? []) as PublicStory[]);
}
export async function livePublicStarter(db: SupabaseClient, slug: string): Promise<PublicStarter | null> {
  const { data, error } = await db.rpc("public_coach_starter", { p_slug: slug });
  const r = !error && Array.isArray(data) ? (data[0] as PublicStarter | undefined) : undefined;
  return r ? { ...r, cover: coverSrc(r.cover) } : null;
}
export async function liveRequestStarter(db: SupabaseClient, slug: string, d: { name: string; email: string; goal: string }): Promise<void> {
  const { error } = await db.rpc("request_starter", { p_slug: slug, p_name: d.name, p_email: d.email, p_goal: d.goal });
  if (error) throw fail(error);
}

// ── Demo ─────────────────────────────────────────────────────────────────────

const KEY = "apex-stories-v1";
interface DemoState { stories: Story[]; starter: string | null; goal: number | null; asked: string[] }
const DEMO_NUMBERS: Record<string, StoryNumbers> = {
  "demo-priya": { weeks: 10, workouts: 27, bests: 5, lift: { name: "Romanian deadlift", from: 40, to: 57.5 }, weight: { from: 68, to: 66.5 } },
};
const numbersFor = (id: string): StoryNumbers => DEMO_NUMBERS[id] ?? { weeks: 9, workouts: 24, bests: 3, lift: { name: "Deadlift", from: 80, to: 102.5 } };

const readDemo = (): DemoState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch { /* sample */ }
  const at = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
  const [a, b] = samplePublicStories();
  return {
    stories: [
      { id: "st-1", clientId: "c-aisha", clientName: "Aisha Khan", headline: a!.headline, numbers: a!.numbers, shown: ["lift", "workouts", "weeks"], quote: a!.quote, showName: true, status: "approved", createdAt: at(11), answeredAt: at(9) },
      { id: "st-2", clientId: "c-marcus", clientName: "Marcus Bell", headline: b!.headline, numbers: b!.numbers, shown: ["workouts", "weeks", "bests"], quote: "", showName: false, status: "approved", createdAt: at(32), answeredAt: at(30) },
    ],
    starter: "demo-prog-2", goal: 400000, asked: [],
  };
};
const writeDemo = (s: DemoState) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* this visit only */ } };

export function demoStories(names: Record<string, string>): StoriesApi {
  return {
    live: false,
    async stories() { return readDemo().stories; },
    async numbers(clientId) { return numbersFor(clientId); },
    async ask(clientId, headline, shown) {
      const n = numbersFor(clientId);
      const problem = storyProblem(headline, shown, n);
      if (problem) throw new Error(problem);
      const s = readDemo();
      if (s.stories.some((x) => x.clientId === clientId && x.status === "asked")) throw new Error("You already asked this client. Wait for their answer.");
      const keep = shown.filter((k) => availableKeys(n).includes(k));
      const story: Story = { id: `st-${Date.now()}`, clientId, clientName: names[clientId] ?? "Client", headline: headline.trim(), numbers: n, shown: keep, quote: "", showName: false, status: "asked", createdAt: new Date().toISOString(), answeredAt: null };
      writeDemo({ ...s, stories: [story, ...s.stories] });
    },
    async remove(id) { const s = readDemo(); writeDemo({ ...s, stories: s.stories.filter((x) => x.id !== id) }); },
    async starter() {
      const choices = sampleProgrammes().listings.filter((l) => l.status === "live" && l.pricePence === 0).map(({ id, title, weeks }) => ({ id, title, weeks }));
      return { picked: readDemo().starter, choices };
    },
    async setStarter(id) { writeDemo({ ...readDemo(), starter: id }); },
    async incomeGoal() { return readDemo().goal; },
    async setIncomeGoal(pence) { writeDemo({ ...readDemo(), goal: pence }); },
  };
}

/** In the demo the client is "demo-priya" (Priya); stories asked of anyone else stay with the coach. */
export function demoClientStories(me = "demo-priya"): ClientStoriesApi {
  return {
    async waiting() { return readDemo().stories.filter((x) => x.clientId === me && x.status === "asked"); },
    async answer(id, approve, quote, showName) {
      const s = readDemo();
      writeDemo({ ...s, stories: s.stories.map((x) => (x.id !== id ? x : { ...x, status: approve ? "approved" : "declined", quote: approve ? quote.trim().slice(0, 300) : "", showName: approve && showName, answeredAt: new Date().toISOString() })) });
    },
  };
}

export function demoPublicStories(): PublicStory[] {
  return readDemo().stories.filter((x) => x.status === "approved").slice(0, 6).map((x) => ({
    headline: x.headline, quote: x.quote, name: x.showName ? x.clientName.split(" ")[0] + (x.clientName.split(" ")[1] ? ` ${x.clientName.split(" ")[1]![0]}.` : "") : null,
    numbers: Object.fromEntries(x.shown.filter((k) => k in x.numbers).map((k) => [k, x.numbers[k]])) as StoryNumbers, at: x.answeredAt ?? x.createdAt,
  }));
}
export function demoPublicStarter(): PublicStarter | null {
  const id = readDemo().starter;
  const l = sampleProgrammes().listings.find((x) => x.id === id && x.status === "live" && x.pricePence === 0);
  return l ? { id: l.id, title: l.title, tagline: l.tagline, weeks: l.weeks, cover: coverSrc(l.cover) } : null;
}
export async function demoRequestStarter(d: { name: string; email: string }): Promise<void> {
  if (!d.email.trim()) throw new Error("Add an email so the plan can reach you.");
  const s = readDemo();
  const email = d.email.trim().toLowerCase();
  if (s.asked.includes(email)) throw new Error("You have already asked. Look out for your invite.");
  writeDemo({ ...s, asked: [...s.asked, email] });
}
