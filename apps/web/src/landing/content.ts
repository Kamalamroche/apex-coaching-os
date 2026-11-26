import type { IconName } from "@apex/ui";

/* All words and pictures for the public website at /. Original APEX copy, UK English.
   Rules: only sell what exists today, no invented customer numbers or reviews (UK advertising rules),
   pictures are real screens from the demo apps (apps/web/public/site, re-shoot when the app UI changes). */

/* Banner video: the APEX light pyramid in red particles (original Higgsfield render, 26 Nov 2026).
   Hosted on the same Higgsfield CDN as the exercise demo clips; the poster frame ships with the site. */
export const HERO_VIDEO = "https://d2ol7oe51mr4n9.cloudfront.net/user_3DPpfwYNBnG9nrFE2TptrXXNck3/4c5306ec-536e-41c2-9581-edcb52062c30.mp4";
/* 720p cut (1.7 MB) for phones. 16 s loop: the logo forms from the pyramid dots, holds, then drifts back. */
export const HERO_VIDEO_SMALL = "https://d2ol7oe51mr4n9.cloudfront.net/user_3DPpfwYNBnG9nrFE2TptrXXNck3/1a634d65-4015-4dde-9ef5-68ee49502356.mp4";
export const HERO_POSTER = "/site/pyramid-poster.webp";
/* Still for reduced motion: the logo frame of the banner. */
export const HERO_STILL = "/site/pyramid-logo.webp";
/* Closing section: the same pyramid and dots without the logo (8 s loop). */
export const END_VIDEO = "https://d2ol7oe51mr4n9.cloudfront.net/user_3DPpfwYNBnG9nrFE2TptrXXNck3/62b77a74-3752-4765-9efc-d62c9a03aac9.mp4";

export type Tour = {
  id: string;
  tab: string;
  icon: IconName;
  title: string;
  body: string;
  points: string[];
  shot: string;
  alt: string;
};

/* Feature cards under "One place for the whole job". */
export const TOUR: Tour[] = [
  {
    id: "brief", tab: "Morning brief", icon: "brief",
    title: "Start every day knowing who needs you.",
    body: "One calm screen ranks your clients by what matters: missed sessions, stalled lifts, unread messages and check-ins waiting for a reply.",
    points: ["Sessions done this week at a glance", "Who needs you today, in order", "A short setup list for new coaches"],
    shot: "/site/coach-brief-dark.webp", alt: "The APEX coach morning brief with active clients, sessions done and who needs attention today",
  },
  {
    id: "build", tab: "Programme builder", icon: "build",
    title: "Write programmes the way you think.",
    body: "Drag from a library of 654 exercises, build supersets and circuits, then reuse your best weeks as templates. Import a PDF or paste your notes to start faster.",
    points: ["Sets, reps, load, RPE and rest per set", "Last session's numbers beside every exercise", "Templates, week tools and PDF import"],
    shot: "/site/coach-builder-dark.webp", alt: "The APEX programme builder with a lower body strength session and the exercise library",
  },
  {
    id: "clients", tab: "Clients", icon: "clients",
    title: "Your whole roster on one table.",
    body: "Training, check-ins, habits, food and how recently you spoke, side by side for every client. Sort by who is slipping and act in a tap.",
    points: ["Health score for every client", "Tags for online, hybrid and in person", "Message or programme several at once"],
    shot: "/site/coach-clients-dark.webp", alt: "The APEX client table with training, check-ins, habits and food for six sample clients",
  },
  {
    id: "food", tab: "Nutrition", icon: "food",
    title: "Nutrition coaching without the spreadsheets.",
    body: "Set targets, write meal plans and see what clients actually eat. Insights point out patterns, and you decide what to change.",
    points: ["Calorie and macro targets", "Meal plans and food logs", "Protein through the day"],
    shot: "/site/coach-nutrition-dark.webp", alt: "The APEX nutrition screen with a client's targets and food logged today",
  },
  {
    id: "money", tab: "Business", icon: "money",
    title: "Run the business side in the same place.",
    body: "Services, session packs, memberships, group classes, contracts and your own public page with enquiries. See money owed before it becomes awkward.",
    points: ["Bookings, packs and memberships", "Contracts and waivers signed in the app", "Your own page for new leads"],
    shot: "/site/coach-business-dark.webp", alt: "The APEX business screen with a monthly income goal and coaching tools",
  },
  {
    id: "client", tab: "Client app", icon: "today",
    title: "An app your clients actually open.",
    body: "It opens on today's session, with cues, timers, habits, check-ins and messages to you. No download needed.",
    points: [],
    shot: "/site/client-today-dark.webp", alt: "The APEX client app opening on today's session",
  },
];

export const CLIENT_SCREENS = [
  { src: "/site/client-today-dark.webp", label: "Today", alt: "Client app opening on today's session, Lower A, with the week above it" },
  { src: "/site/client-train-dark.webp", label: "Training", alt: "Client app showing the current strength block and exercise library" },
  { src: "/site/client-progress-dark.webp", label: "Progress", alt: "Client app showing 13 weeks of progress with weight and waist changes" },
  { src: "/site/client-messages-dark.webp", label: "Messages", alt: "Client app messages with the coach, including a voice note button" },
];

export const CLIENT_POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: "today", title: "Opens on today", body: "No menus to dig through. The session you wrote is the first thing they see." },
  { icon: "train", title: "Guided sessions", body: "Cues, rest timer, plate maths and last time's numbers on every set." },
  { icon: "progress", title: "Progress they can feel", body: "Personal bests, photos, measurements and check-ins in one timeline." },
  { icon: "chat", title: "You, one tap away", body: "Messages, voice notes and form-check videos go straight to you." },
];

/* The four labels every AI output carries in the product. */
export const LABELS = [
  { kind: "Data", body: "What was logged: sets, food, sleep, check-ins." },
  { kind: "Insight", body: "A pattern APEX spots, with the numbers behind it." },
  { kind: "AI suggestion", body: "A proposed change. It waits for you." },
  { kind: "Coach decision", body: "Only what you accept reaches your client." },
];

export const STEPS = [
  { n: "01", title: "Set up your business", body: "Sign in with your email, name your business and add your services and prices." },
  { n: "02", title: "Invite your clients", body: "Send each client a private link. The app runs in their phone's browser and adds to the home screen." },
  { n: "03", title: "Coach from one place", body: "Write programmes, reply to check-ins and see each morning who needs you." },
];

/* Proposed pricing, not live yet: billing arrives with Stripe. */
export const PLANS = [
  { name: "Starter", price: "£0", clients: "Up to 3 clients", note: "Try everything with your first clients." },
  { name: "Coach", price: "£35", clients: "Up to 30 clients", note: "For a full one-to-one diary.", featured: true },
  { name: "Studio", price: "£69", clients: "Up to 100 clients", note: "For busy coaches and small teams." },
  { name: "Team", price: "£119", clients: "Unlimited clients", note: "For gyms and coaching teams." },
];

export const FAQ = [
  { q: "Do my clients need to download an app?", a: "No. The client app runs in the phone's browser and can be added to the home screen like any other app. They tap your invite link and they are in." },
  { q: "Are any features locked behind higher plans?", a: "No. Every plan includes every feature. Plans only differ in how many active clients you coach. Your own branding on the client app is available as an add-on." },
  { q: "Does the AI change my clients' programmes?", a: "Never on its own. AI suggestions are clearly labelled and wait for you. Nothing reaches a client until you accept it." },
  { q: "How do I get started?", a: "Sign in with your email, name your coaching business, then send each client a private invite link. Most coaches run their first session the same afternoon." },
  { q: "Can I try it before I sign up?", a: "Yes. Open the demo to explore the coach and client apps with sample data, no account needed." },
  { q: "Who is behind APEX?", a: "APEX is built by a working personal trainer at HELIX, for coaches who would rather spend their time coaching than on admin." },
];
