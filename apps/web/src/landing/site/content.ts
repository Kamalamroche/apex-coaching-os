/* Marketing site content. Original APEX copy only. Sell only what exists today; anything not live is marked `soon`.
   Numbers on the site are real product facts (library size, foods, recipes, templates), never invented customer stats. */
import type { IconName } from "@apex/ui";

export type Shot = { kind: "phone" | "desk"; src: string; alt: string };
export type FeatureItem = { icon: IconName; name: string; text: string; soon?: boolean };
export type FeatureGroup = {
  id: string; name: string; kicker: string; title: string; lead: string;
  shot: Shot; extra?: Shot; items: FeatureItem[];
};

const phone = (name: string, alt: string): Shot => ({ kind: "phone", src: `/site/phone-${name}.webp`, alt });
const desk = (name: string, alt: string): Shot => ({ kind: "desk", src: `/site/desk-${name}.webp`, alt });

export const SHOTS = {
  today: phone("today", "The APEX client app opening on today's session, Lower A, with a week strip and swipe to start"),
  rings: phone("rings", "Daily rings for training, movement and fuel with a streak counter"),
  train: phone("train", "The client's program week with planned sessions and a Start button"),
  progress: phone("progress", "Progress screen showing body weight and waist trends since the start"),
  chat: phone("chat", "A chat between the client and her coach"),
  nutrition: phone("nutrition", "Fuel for today: a calorie arc with protein, carbs and fat rings"),
  habits: phone("habits", "Habits with a water tracker filling up through the day"),
  goals: phone("goals", "Goals with progress bars and badges"),
  book: phone("book", "Booking a call with the coach from the client app"),
  readiness: phone("readiness", "Daily readiness check pre-filled from a wearable"),
  more: phone("more", "The client's More menu: booking, team, challenges, resources, goals, nutrition and habits"),
  brief: desk("brief", "The coach's Morning Brief with active clients, completion rate and who needs attention today"),
  builder: desk("builder", "The program builder with the movement library, week tabs, supersets and last-time numbers"),
  business: desk("business", "The business screen with monthly recurring revenue by client"),
} satisfies Record<string, Shot>;

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "training", name: "Training", kicker: "Programming", title: "Programs that coach themselves forward.",
    lead: "Build a block once, reuse it for every client, and let real numbers decide the next step. Your clients get a guided session, not a spreadsheet.",
    shot: SHOTS.builder, extra: SHOTS.train,
    items: [
      { icon: "build", name: "Drag-and-drop builder", text: "Supersets, circuits, per-set targets, RPE and rest, laid out week by week." },
      { icon: "file", name: "Multi-week programs and templates", text: "Save any block as a template. Four starter programs included, from foundations to race prep." },
      { icon: "spark", name: "Paste, speak or import a PDF", text: "Turn your notes, a voice memo or an old PDF into a structured program you can edit." },
      { icon: "figure", name: "637-movement library", text: "Every movement with muscles worked, step-by-step cues and original demo clips." },
      { icon: "play", name: "Guided workout player", text: "Last time's numbers on every set, a rest timer and a plate calculator built in." },
      { icon: "pulse", name: "Plateau alerts", text: "APEX spots a stalled lift and suggests a change. You decide if it goes ahead." },
      { icon: "run", name: "Cardio and race prep", text: "Runs, rides and swims with route maps and splits. HYROX stations and hybrid blocks." },
      { icon: "upload", name: "Bring your history", text: "Import GPX, TCX and FIT files, and move clients in or out with a CSV." },
    ],
  },
  {
    id: "nutrition", name: "Nutrition", kicker: "Fuel", title: "Nutrition coaching without the homework.",
    lead: "Set targets in seconds, give clients a food log they will actually use, and hand out meal plans with a shopping list already written.",
    shot: SHOTS.nutrition,
    items: [
      { icon: "target", name: "Target calculator", text: "Calories and macros from body weight, activity and goal, ready to adjust." },
      { icon: "food", name: "Quick food log", text: "134 everyday foods with sensible portions, recent foods and repeat meals." },
      { icon: "chat", name: "Describe a meal", text: "Clients type what they ate in plain words and APEX turns it into a log entry." },
      { icon: "note", name: "Coach meal plans", text: "Plans built from 14 original recipes, with the macros worked out for you." },
      { icon: "check", name: "Shopping list", text: "A weekly list made from the plan, grouped the way a supermarket is." },
      { icon: "water", name: "Water and streaks", text: "A water tracker that ticks the habit at goal, plus a logging streak." },
    ],
  },
  {
    id: "habits", name: "Habits & check-ins", kicker: "Accountability", title: "See the whole week, not just the workouts.",
    lead: "Habits, check-ins and readiness give you the picture between sessions, so you can step in before a client drifts.",
    shot: SHOTS.habits, extra: SHOTS.readiness,
    items: [
      { icon: "check", name: "Daily habits", text: "Assign habits like steps, sleep or water. Steps and bedtime tick themselves from a watch." },
      { icon: "flame", name: "Rings and streaks", text: "Three daily rings for train, move and fuel that make consistency visible." },
      { icon: "camera", name: "Weekly check-ins", text: "Measurements, progress photos and a few honest questions, on a schedule you set." },
      { icon: "energy", name: "Readiness check", text: "Four taps on sleep, energy, soreness and stress before each session." },
      { icon: "sleep", name: "Recovery from wearables", text: "Sleep and recovery from Whoop, Oura, Fitbit or Polar, compared with the client's own usual." },
      { icon: "form", name: "Video form checks", text: "Clients film a set, you reply with notes on the exact moment that matters." },
      { icon: "note", name: "Onboarding questionnaire", text: "Health, history and goals collected before the first session." },
    ],
  },
  {
    id: "community", name: "Community", kicker: "Engagement", title: "Keep clients coming back for the right reasons.",
    lead: "Progress people can see and share, a team that cheers them on, and a coach who is one message away.",
    shot: SHOTS.goals, extra: SHOTS.chat,
    items: [
      { icon: "chat", name: "Messages", text: "One thread per client, with workout summaries dropped in automatically." },
      { icon: "clients", name: "Group messages and team", text: "Message everyone at once, or run a private team feed with high fives." },
      { icon: "trophy", name: "Challenges", text: "Group challenges with a leaderboard that rewards effort, not just the strongest." },
      { icon: "target", name: "Goals and badges", text: "Goals that update themselves from logged data, and badges for the habits that matter." },
      { icon: "spark", name: "Levels and milestones", text: "Clients level up with consistency, with milestones worth celebrating." },
      { icon: "share", name: "Share cards", text: "Workout and weekly story cards clients can post to show their progress." },
    ],
  },
  {
    id: "business", name: "Business", kicker: "Run the business", title: "Less admin. More coaching.",
    lead: "Bookings, automatic messages and client records live in the same place as the training, so nothing slips.",
    shot: SHOTS.business, extra: SHOTS.book,
    items: [
      { icon: "clock", name: "Booking calendar", text: "Set your hours. Clients book calls or sessions themselves." },
      { icon: "bell", name: "Automatic messages", text: "Welcome messages, missed-workout nudges and check-in reminders, in your words." },
      { icon: "note", name: "Private notes and tags", text: "Injuries, preferences and context, only ever seen by you." },
      { icon: "globe", name: "Your public coach page", text: "A link to share on social media where new clients can ask to train with you." },
      { icon: "file", name: "Resource library", text: "Guides, videos and links for your clients in one tidy place." },
      { icon: "money", name: "Business dashboard", text: "Monthly recurring revenue, per-client income and next payout." },
      { icon: "link", name: "Client payments", text: "Plans and checkout for clients, paid straight to you.", soon: true },
      { icon: "mail", name: "Email alerts", text: "New messages reach clients by email when they are away from the app." },
    ],
  },
  {
    id: "insight", name: "Insight & AI", kicker: "Coach decides", title: "AI that waits for your OK.",
    lead: "APEX does the noticing. You do the coaching. Every suggestion is labelled and nothing reaches a client until you accept it.",
    shot: SHOTS.brief,
    items: [
      { icon: "brief", name: "Morning Brief", text: "Missed sessions, stalled lifts and unread messages, ranked by urgency every morning." },
      { icon: "mail", name: "APEX Twin", text: "Weekly message drafts in your voice. Approve, edit or reject each one." },
      { icon: "spark", name: "Program Copilot", text: "Ask for a change to a program and review the edit before it is saved." },
      { icon: "info", name: "Clear labels everywhere", text: "Data, Insight, AI suggestion or Coach decision, so everyone knows what they are looking at." },
    ],
  },
];

export const CLIENT_APP = {
  title: "An app clients open every day.",
  lead: "No download, no password to forget. Clients tap your invite and the app opens on today's session, ready to train.",
  points: [
    "Works on any phone and adds to the home screen",
    "Swipe to start, guided sets, rest timer",
    "Rings, streaks, goals and progress photos",
    "Light and dark, with your name on every screen",
  ],
};

export const LABELS = [
  { name: "Data", text: "Exactly what was logged or measured.", tone: "data" },
  { name: "Insight", text: "A pattern APEX found in that data.", tone: "blue" },
  { name: "AI suggestion", text: "A proposed change, waiting for you.", tone: "ai" },
  { name: "Coach decision", text: "What you chose. The only thing clients see.", tone: "act" },
] as const;

export type Audience = {
  id: string; name: string; photo: string; title: string; problem: string; points: string[]; links: string[];
};

export const AUDIENCES: Audience[] = [
  {
    id: "online", name: "Online coaches", photo: "/hero/coach.webp", title: "Coach a full roster from your phone.",
    problem: "Online clients drift when the only contact is a PDF and the odd message.",
    points: ["Programs that run themselves week to week", "Check-ins and form videos in one inbox", "A Morning Brief that tells you who needs you"],
    links: ["training", "habits", "insight"],
  },
  {
    id: "in-person", name: "Personal trainers", photo: "/hero/hinge.webp", title: "Make the hours between sessions count.",
    problem: "You see clients twice a week. The other five days decide the result.",
    points: ["Homework sessions with last time's numbers", "Habits and nutrition between sessions", "Booking and reminders without the back-and-forth"],
    links: ["training", "nutrition", "business"],
  },
  {
    id: "hybrid", name: "Hybrid and HYROX coaches", photo: "/hero/sled.webp", title: "Strength and engine in one plan.",
    problem: "Hybrid athletes live in three apps: one for lifting, one for runs, one for recovery.",
    points: ["HYROX stations and hybrid race-prep blocks", "Runs, rides and swims with maps and splits", "Recovery data next to the training load"],
    links: ["training", "habits"],
  },
  {
    id: "studios", name: "Studios and small gyms", photo: "/hero/team.webp", title: "One standard across every coach.",
    problem: "Members get a different experience depending on who is on shift.",
    points: ["Shared templates and a shared movement library", "Group challenges and a team feed", "Messages to everyone in one go"],
    links: ["community", "business"],
  },
  {
    id: "nutrition", name: "Nutrition coaches", photo: "/hero/meal.webp", title: "Food coaching people stick with.",
    problem: "Food logs are tedious, so clients stop logging just when it matters.",
    points: ["Targets in seconds, adjusted when life changes", "Describe-a-meal logging and repeat meals", "Meal plans with recipes and a shopping list"],
    links: ["nutrition", "habits"],
  },
];

/** Real product numbers only. */
export const FACTS = [
  { value: 637, label: "movements with cues" },
  { value: 134, label: "foods ready to log" },
  { value: 14, label: "original recipes" },
  { value: 0, label: "features locked behind a plan" },
];

export const INTEGRATIONS = [
  { name: "Strava", text: "Runs, rides and swims" },
  { name: "Whoop", text: "Sleep and recovery" },
  { name: "Oura", text: "Sleep and readiness" },
  { name: "Fitbit", text: "Steps and sleep" },
  { name: "Polar", text: "Training and recovery" },
  { name: "Garmin", text: "Activities and recovery", soon: true },
  { name: "Stripe", text: "Client payments", soon: true },
  { name: "GPX · TCX · FIT", text: "Upload from any watch" },
];

/** A coaching week, step by step, for the "In action" page. */
export const WEEK = [
  { day: "Monday 07:30", title: "Read the Morning Brief", text: "Three clients need you today. One missed two sessions, one stalled on the deadlift, one sent a form check. It takes five minutes to clear.", shot: SHOTS.brief },
  { day: "Monday 09:00", title: "Adjust the program", text: "APEX flags the stalled lift and suggests a deload. You accept it in the builder, and the change lands on the client's next session.", shot: SHOTS.builder },
  { day: "Tuesday 18:10", title: "Your client trains", text: "She opens the app on today's workout, checks in on readiness and swipes to start. Every set shows what she lifted last time.", shot: SHOTS.today },
  { day: "Tuesday 19:05", title: "The summary reaches you", text: "Muscles worked, personal bests and a comparison with last session arrive in your messages as soon as she finishes.", shot: SHOTS.chat },
  { day: "Thursday", title: "Habits and food keep moving", text: "Water, steps and meals tick along between sessions. You see the week at a glance without chasing anyone.", shot: SHOTS.nutrition },
  { day: "Sunday", title: "Check-in and next week", text: "Weight, waist and photos come in. APEX Twin drafts your weekly messages for you to approve, and next week is ready.", shot: SHOTS.progress },
];

export type Plan = { name: string; monthly: number; clients: string; for: string; featured?: boolean };

/* Proposed pricing, not live yet: billing arrives with Stripe. Yearly = two months free. */
export const PLANS: Plan[] = [
  { name: "Starter", monthly: 0, clients: "Up to 3 clients", for: "Try APEX with your first clients." },
  { name: "Coach", monthly: 35, clients: "Up to 30 clients", for: "For a full-time personal trainer.", featured: true },
  { name: "Studio", monthly: 69, clients: "Up to 100 clients", for: "For busy coaches and small teams." },
  { name: "Team", monthly: 119, clients: "Unlimited clients", for: "For studios and gyms." },
];

export const yearlyPerMonth = (monthly: number): number => Math.round(((monthly * 10) / 12) * 100) / 100;

export const PRICING_ROWS = [
  "Program builder, templates and the 637-movement library",
  "Client app with guided workouts",
  "Nutrition targets, food log and meal plans",
  "Habits, check-ins, readiness and recovery",
  "Messages, team, challenges, goals and badges",
  "Booking calendar and automatic messages",
  "Morning Brief, APEX Twin and Program Copilot",
  "Import and export your data at any time",
];

export const FAQ = [
  { q: "Do my clients need to download an app?", a: "No. The client app runs in the phone's browser and can be added to the home screen like any other app. They tap your invite link and they are in." },
  { q: "Are any features locked behind higher plans?", a: "No. Every plan includes every feature. Plans only differ in how many active clients you coach. Your own branding on the client app is available as an add-on." },
  { q: "Does the AI change my clients' programs?", a: "Never on its own. AI suggestions are clearly labelled and wait for you. Nothing reaches a client until you accept it." },
  { q: "How do I get started?", a: "Sign in with your email, name your coaching business, then send each client a private invite link. Most coaches run their first session the same afternoon." },
  { q: "Can I try it before I sign up?", a: "Yes. Open the demo to explore the coach and client apps with sample data, no account needed." },
  { q: "Who is behind APEX?", a: "APEX is built by a working personal trainer at HELIX, for coaches who would rather spend their time coaching than on admin." },
];

export const PRICING_FAQ = [
  { q: "What counts as an active client?", a: "A client with a program or a check-in in the last 30 days. Archived clients are free and keep their history." },
  { q: "What happens if I go over my limit?", a: "Nothing breaks. You get a reminder and two weeks to move up a plan or archive someone." },
  { q: "Can I switch plans or cancel?", a: "Yes, at any time from your account. Monthly plans have no minimum term." },
  { q: "Do you take a cut of my client payments?", a: "No. When client payments open, the money goes straight to your own Stripe account." },
  { q: "Is my data mine?", a: "Yes. Export clients, programs and history as files whenever you like. Data is stored in the UK and Europe." },
];

export type Guide = { id: string; tag: string; title: string; minutes: number; intro: string; steps: string[] };

/** Short original coaching guides for the Resources page. */
export const GUIDES: Guide[] = [
  {
    id: "first-block", tag: "Programming", title: "Write your first 8-week block", minutes: 4,
    intro: "A good block is boring on paper and exciting in results. Keep the structure simple so the progress is easy to see.",
    steps: [
      "Pick two to four main lifts and keep them for all eight weeks. Change accessories, not the anchors.",
      "Start each main lift around RPE 7 so there is room to climb. Add load when every set hits the top of the rep range.",
      "Plan a lighter week 5 or week 8 depending on how the client recovers. Readiness scores will tell you which.",
      "Save the block as a template. Next time you only change what the client needs.",
    ],
  },
  {
    id: "check-in", tag: "Accountability", title: "Run a weekly check-in that people finish", minutes: 3,
    intro: "Check-ins fail when they feel like homework. Ask less, reply faster, and always give one next step.",
    steps: [
      "Keep it to body weight, one measurement, photos every two weeks and three short questions.",
      "Reply within a day. A short, specific reply beats a long one sent on Friday.",
      "End every reply with one clear focus for the week ahead.",
      "Look at trends over four weeks, not single numbers. Water and sleep move the scale more than people think.",
    ],
  },
  {
    id: "onboarding", tag: "Business", title: "Onboard a new client in ten minutes", minutes: 3,
    intro: "The first week sets the tone. Make it feel personal without making it slow.",
    steps: [
      "Send the invite link with a short welcome message in your own words.",
      "Let the questionnaire collect health, history and goals before you speak.",
      "Start with a two-week foundations program so you can learn how they move.",
      "Book the first review call before the first session ends.",
    ],
  },
  {
    id: "pricing", tag: "Business", title: "Price your online coaching with confidence", minutes: 5,
    intro: "Clients pay for the result and for your attention. Price the attention honestly.",
    steps: [
      "Work out how many minutes a week each client really takes, including messages and check-ins.",
      "Set a monthly price that pays you properly for those minutes, then add a margin for planning time.",
      "Offer two options, not five: coaching, and coaching with more contact.",
      "Review prices every six months and keep founding clients on their original rate.",
    ],
  },
  {
    id: "nutrition", tag: "Nutrition", title: "Set nutrition targets clients can hit", minutes: 4,
    intro: "The best target is the one a client hits five days out of seven.",
    steps: [
      "Start from current intake, not an ideal number. Big jumps rarely last.",
      "Lead with protein and a calorie range. Carbs and fat can flex around life.",
      "Give two or three go-to meals rather than a full plan in week one.",
      "Adjust every two weeks using the trend, not one weigh-in.",
    ],
  },
  {
    id: "hybrid", tag: "Programming", title: "Balance strength and running", minutes: 5,
    intro: "Hybrid training works when hard days are hard and easy days are genuinely easy.",
    steps: [
      "Put heavy lower-body work and hard intervals on the same day, or 48 hours apart.",
      "Keep most running easy enough to hold a conversation.",
      "Watch sleep and soreness. If readiness drops two days running, swap intervals for an easy run.",
      "Practise race stations on fresh legs first, then under fatigue in the last four weeks.",
    ],
  },
];

export const GLOSSARY = [
  { term: "RPE", text: "Rate of perceived exertion, 1 to 10. RPE 8 means about two more reps were left in the tank." },
  { term: "e1RM", text: "Estimated one-rep max, worked out from a set of several reps. Useful for tracking strength without testing a true max." },
  { term: "Superset", text: "Two exercises done back to back before resting." },
  { term: "Circuit", text: "Three or more exercises done in a row, often for rounds or time." },
  { term: "Deload", text: "A planned lighter week that lets the body absorb hard training." },
  { term: "Readiness", text: "A quick daily score from sleep, energy, soreness and stress that guides how hard to push." },
];

export const NAV = {
  product: FEATURE_GROUPS.map((g) => ({ href: `/features/#${g.id}`, name: g.name, text: g.kicker })),
  audiences: AUDIENCES.map((a) => ({ href: `/solutions/#${a.id}`, name: a.name })),
  resources: [
    { href: "/resources/#guides", name: "Coach guides", text: "Short, practical how-tos" },
    { href: "/resources/#help", name: "Help centre", text: "Answers to common questions" },
    { href: "/resources/#templates", name: "Program templates", text: "Starter blocks included free" },
    { href: "/resources/#glossary", name: "Glossary", text: "RPE, e1RM and more" },
  ],
};

export const TEMPLATES = [
  { name: "Foundations · full body", weeks: 6, text: "Three full-body sessions a week for new clients and returners." },
  { name: "Upper / lower · strength", weeks: 8, text: "Four days, two upper and two lower, built around the main lifts." },
  { name: "Conditioning circuits", weeks: 4, text: "Short circuits for fitness and fat loss, with minimal kit." },
  { name: "Hybrid race prep", weeks: 8, text: "Strength, running and race stations for HYROX-style events." },
];
