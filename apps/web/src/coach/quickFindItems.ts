import { clientItems, type QuickItem } from "@apex/core";

/** Where a quick find pick lands: a tab, and optionally a tool inside it. */
export type Jump = { tab: "brief" | "clients" | "chat" | "build" | "food" | "money"; sub?: string } | { account: true };

type Place = QuickItem & { jump: Jump };

const screen = (id: string, title: string, hint: string, jump: Jump, keywords: string[]): Place => ({ id, kind: "screen", title, hint, jump, keywords });
const action = (id: string, title: string, hint: string, jump: Jump, keywords: string[]): Place => ({ id, kind: "action", title, hint, jump, keywords });

/** Every screen and everyday job in the coach app, in the words a trainer would type. */
export function coachPlaces(opts: { gym: boolean }): Place[] {
  return [
    screen("tab:brief", "Brief", "Your morning list", { tab: "brief" }, ["home", "dashboard", "today", "morning", "needs attention"]),
    screen("tab:clients", "Clients", "Everyone you coach", { tab: "clients" }, ["roster", "list", "table", "people", "athletes"]),
    screen("tab:chat", "Messages", "Chats with clients", { tab: "chat" }, ["inbox", "chat", "dm", "reply"]),
    screen("tab:build", "Builder", "Write the programme", { tab: "build" }, ["program", "programme", "workout", "plan", "exercises"]),
    screen("tab:food", "Nutrition", "Meal plans and food", { tab: "food" }, ["food", "macros", "meal", "recipes", "diet", "calories"]),
    screen("tab:money", "Business", "Income, packs and tools", { tab: "money" }, ["money", "income", "revenue", "fees", "earnings"]),
    screen("brief:calendar", "Calendar", "Brief · bookings", { tab: "brief", sub: "calendar" }, ["bookings", "diary", "schedule", "appointments", "sessions", "availability"]),
    screen("brief:twin", "APEX Twin drafts", "Brief · weekly drafts to review", { tab: "brief", sub: "twin" }, ["twin", "drafts", "weekly", "review", "ai"]),
    screen("chat:auto", "Automatic messages", "Messages · welcome, missed workouts, reminders", { tab: "chat", sub: "auto" }, ["automations", "automatic", "reminders", "welcome", "missed"]),
    screen("chat:answers", "Quick answers", "Messages · saved replies", { tab: "chat", sub: "answers" }, ["faq", "answers", "saved", "replies", "templates"]),
    screen("chat:live", "Live session", "Messages · train together", { tab: "chat", sub: "live" }, ["live", "together", "realtime", "class"]),
    screen("chat:challenges", "Challenges", "Messages · team challenges", { tab: "chat", sub: "challenges" }, ["challenge", "competition", "leaderboard"]),
    screen("chat:team", "Team", "Messages · team board", { tab: "chat", sub: "team" }, ["community", "board", "group", "high fives"]),
    screen("chat:grow", "Train with me page", "Messages · your page and enquiries", { tab: "chat", sub: "grow" }, ["page", "leads", "enquiries", "website", "referrals", "public", "profile"]),
    screen("chat:resources", "Resource library", "Messages · guides and files", { tab: "chat", sub: "resources" }, ["resources", "guides", "pdf", "files", "library", "courses"]),
    screen("money:programmes", "Programmes to sell", "Business · ready-made plans", { tab: "money", sub: "programmes" }, ["shop", "sell", "products", "store"]),
    screen("money:marketing", "Marketing", "Business · posts, offers, QR poster", { tab: "money", sub: "marketing" }, ["posts", "instagram", "poster", "qr", "offers", "social"]),
    screen("money:classes", "Group classes", "Business · limits and waitlist", { tab: "money", sub: "classes" }, ["classes", "group", "waitlist", "bootcamp"]),
    screen("money:agreements", "Contracts and waivers", "Business · clients sign by name", { tab: "money", sub: "agreements" }, ["contract", "waiver", "sign", "agreement", "terms"]),
    ...(opts.gym ? [screen("money:gym", "Gym", "Business · your trainers", { tab: "money", sub: "gym" }, ["gym", "trainers", "staff", "studio"])] : []),
    screen("build:templates", "Templates", "Builder · saved workouts and plans", { tab: "build", sub: "templates" }, ["template", "saved", "library", "reuse"]),
    screen("build:plan", "Plan builder", "Builder · lay out the weeks", { tab: "build", sub: "plan" }, ["block", "weeks", "mesocycle", "periodisation", "periodization"]),
    screen("build:copilot", "Copilot", "Builder · AI suggestions you accept", { tab: "build", sub: "copilot" }, ["ai", "assistant", "suggest", "help"]),
    screen("account", "Account and settings", "Units, language, privacy", { account: true }, ["settings", "units", "kg", "lb", "language", "privacy", "delete", "export", "profile"]),
    action("act:invite", "Invite a client", "Clients · send a join link", { tab: "clients" }, ["add", "new", "join", "link", "onboard"]),
    action("act:paste", "Paste or speak a programme", "Builder · turn notes or a PDF into a workout", { tab: "build", sub: "paste" }, ["import", "pdf", "text", "voice", "notes", "dictate"]),
    action("act:broadcast", "Message everyone", "Messages · one message to all clients", { tab: "chat", sub: "group" }, ["broadcast", "group", "mass", "all clients", "announce"]),
  ];
}

/** What shows before the coach types: the jobs they reach for most. */
export const STARTER_IDS = ["brief:calendar", "act:broadcast", "build:templates", "act:invite", "chat:auto", "act:paste"];

/** Clients plus places, and a lookup from item id to where it lands. */
export function coachQuickFind(clients: { id: string; name: string; hint?: string }[], opts: { gym: boolean }) {
  const places = coachPlaces(opts);
  const people = clientItems(clients);
  const byId = new Map(places.map((p) => [p.id, p.jump] as const));
  const starter = [
    ...STARTER_IDS.map((id) => places.find((p) => p.id === id)).filter((p): p is Place => !!p),
    ...people.filter((p) => p.id.split(":").length === 2).slice(0, 3),
  ];
  // Clients first, so a name wins ties with a screen of the same word.
  return { items: [...people, ...places] as QuickItem[], starter: starter as QuickItem[], jumpFor: (id: string) => byId.get(id) };
}
