/* Privacy: the agreements each person gives before using APEX, what deleting an account means, and the
   draft privacy policy and terms. Health information is "special category" data under UK GDPR, so clients
   give a separate, explicit agreement for it, never bundled with the terms.
   Live: user_consents, export_my_data() and delete_my_account()
   (supabase/migrations/20261105090000_privacy.sql). Pure, so it is unit tested. */

/** Bump when the terms or privacy policy change in a way people need to agree to again. */
export const LEGAL_VERSION = "2026-11-03";

export type ConsentKind = "terms" | "adult" | "health" | "coach_duty";
export type PrivacyRole = "coach" | "client";

export interface ConsentRecord {
  kind: ConsentKind;
  version: string;
  givenAt: string;
  withdrawnAt: string | null;
}

export const CONSENT_TEXT: Record<ConsentKind, { title: string; body: string }> = {
  terms: { title: "Terms and privacy", body: "I agree to the terms of use and I've read the privacy policy." },
  adult: { title: "Age", body: "I'm 18 or over." },
  health: {
    title: "My health information",
    body: "I agree that APEX stores my health information (workouts, body measurements, progress photos, check-ins, readiness, nutrition and my health questionnaire) and shares it with my coach, so my coach can coach me. I can withdraw this at any time.",
  },
  coach_duty: {
    title: "Looking after client information",
    body: "I'll only add people who have agreed to be coached by me, keep their information confidential, and use it only to coach them.",
  },
};

export function requiredConsents(role: PrivacyRole): ConsentKind[] {
  return role === "client" ? ["terms", "adult", "health"] : ["terms", "adult", "coach_duty"];
}

/** The agreements this person still has to give for the current version, in the order to show them. */
export function missingConsents(role: PrivacyRole, given: ConsentRecord[], version = LEGAL_VERSION): ConsentKind[] {
  return requiredConsents(role).filter((k) => !given.some((g) => g.kind === k && g.version === version && !g.withdrawnAt));
}

/** True when this person agreed to the health information before and has since withdrawn it. */
export const healthWithdrawn = (given: ConsentRecord[]): boolean =>
  given.some((g) => g.kind === "health" && g.withdrawnAt) && !given.some((g) => g.kind === "health" && !g.withdrawnAt);

export interface ConsentRow {
  user_id: string;
  kind: ConsentKind;
  version: string;
  given_at: string;
  withdrawn_at: string | null;
}

export const fromConsentRow = (r: ConsentRow): ConsentRecord => ({ kind: r.kind, version: r.version, givenAt: r.given_at, withdrawnAt: r.withdrawn_at });

/* ---------- Deleting an account ---------- */

export const DELETE_WORD = "DELETE";
export const deleteConfirmed = (typed: string): boolean => typed.trim().toUpperCase() === DELETE_WORD;

/** What goes, in plain words, before someone confirms. */
export function deletionEffects(role: PrivacyRole, coachName: string): string[] {
  return role === "client"
    ? [
        "Your account and sign-in",
        "Your workouts, sessions and personal bests",
        "Check-ins, measurements and progress photos",
        "Form check videos, habits, nutrition, goals and bookings",
        `Your messages with ${coachName || "your coach"}`,
      ]
    : [
        "Your account and sign-in",
        "The programmes, templates, plans and notes you made",
        "Your messages with clients, your resources, challenges and calendar",
        "Your clients keep their own accounts and logged history, but lose the programmes you wrote for them",
      ];
}

export const exportFileName = (name: string, day: string): string =>
  `apex-my-data-${(name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account")}-${day}.json`;

/* ---------- Draft legal pages ---------- */

/** The business details the legal pages need. Empty means "not filled in yet". */
export interface LegalDetails {
  business: string;
  email: string;
  address: string;
}

export const LEGAL_DETAILS: LegalDetails = { business: "", email: "", address: "" };

const PLACEHOLDER: Record<keyof LegalDetails, string> = {
  business: "[business name]",
  email: "[contact email]",
  address: "[postal address]",
};

/** The details still missing, so the page can say it is a draft. */
export const missingLegalDetails = (d: LegalDetails = LEGAL_DETAILS): (keyof LegalDetails)[] =>
  (Object.keys(PLACEHOLDER) as (keyof LegalDetails)[]).filter((k) => !d[k].trim());

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

const fill = (text: string, d: LegalDetails): string =>
  text.replace(/\{(business|email|address)\}/g, (_, k: keyof LegalDetails) => d[k].trim() || PLACEHOLDER[k]);

const PRIVACY: LegalSection[] = [
  {
    heading: "Who we are",
    paragraphs: [
      "APEX Coaching OS is run by {business}, {address}. You can contact us about privacy at {email}.",
      "For the information you add to coach or be coached, your coach decides why and how it is used, and APEX stores it for them. For your account itself, and for running and securing the app, we are responsible.",
    ],
  },
  {
    heading: "What we collect",
    paragraphs: [
      "Account: your name, email address and whether you are a coach or a client.",
      "Training: programmes, workouts, sets, weights, personal bests, cardio sessions and maps of your routes.",
      "Health information: body measurements, progress photos, check-ins (sleep, stress, energy, hunger), readiness, nutrition, habits, form check videos and your health questionnaire, including any injuries or conditions you tell your coach about.",
      "Messages, bookings, goals and challenge entries.",
      "If you connect a wearable or another app (for example Strava), the activities and recovery data you choose to share from it.",
      "Payments, when they are switched on, are handled by Stripe. We never see or store your full card number.",
    ],
  },
  {
    heading: "Why we use it, and our legal basis",
    paragraphs: [
      "To provide the coaching service you signed up for (contract).",
      "Health information is special category data. We only store it and share it with your coach because you have given your explicit consent, which you can withdraw at any time.",
      "To keep the app secure, fix problems and prevent misuse (legitimate interests).",
      "To keep records the law requires, such as payment records (legal obligation).",
      "We do not sell your data, we do not use it for advertising, and suggestions marked AI suggestion are only ever shown to your coach to accept or reject.",
    ],
  },
  {
    heading: "Who can see it",
    paragraphs: [
      "Your coach sees what you log and share in the app. Other clients only see what you choose to share, such as your first name and initial on a challenge leaderboard.",
      "Notes and tags your coach writes about you are private to your coach. You can still ask us for a copy.",
      "We use trusted providers to run APEX: Supabase (database, sign-in and file storage, in London), Vercel (hosting the app), our email provider (sign-in emails), a map provider (map images for your routes) and Stripe (payments). They only process data on our instructions.",
    ],
  },
  {
    heading: "How long we keep it",
    paragraphs: [
      "We keep your information while you have an account. When you delete your account, it is removed straight away from the live app, and from backups within 30 days.",
      "Payment records are kept for six years, as UK tax law requires.",
    ],
  },
  {
    heading: "Your rights",
    paragraphs: [
      "You can see, download, correct or delete your information. Download your data and delete your account at any time from the Privacy and account screen in the app.",
      "You can withdraw your consent for health information at any time. We then stop using it, which means coaching in APEX stops until you agree again or delete your account.",
      "You can also object to how we use your data or ask us to limit it. Contact {email}, and we will reply within one month.",
      "If you are unhappy with how we handle your data, you can complain to the Information Commissioner's Office (ico.org.uk, 0303 123 1113).",
    ],
  },
  {
    heading: "Age",
    paragraphs: ["APEX is for people aged 18 and over."],
  },
  {
    heading: "Changes",
    paragraphs: ["If we change this policy in a way that matters, we will ask you to agree again in the app."],
  },
];

const TERMS: LegalSection[] = [
  {
    heading: "About these terms",
    paragraphs: [
      "These terms are between you and {business}, which runs APEX Coaching OS. By creating an account you agree to them.",
    ],
  },
  {
    heading: "Who can use APEX",
    paragraphs: [
      "You must be 18 or over. Coaches must hold the qualifications and insurance needed to coach the people they work with.",
      "Keep your sign-in to yourself and tell us at {email} if you think someone else has used your account.",
    ],
  },
  {
    heading: "Training and health",
    paragraphs: [
      "APEX is a tool that helps coaches and clients work together. It is not medical advice. Check with a doctor before starting a new exercise or nutrition plan, especially if you have an injury or a health condition.",
      "Stop exercising and get help if you feel pain, dizziness or chest discomfort. You train at your own risk, within what the law allows.",
      "Suggestions marked AI suggestion are drafts for your coach. Only your coach decides what goes into your programme.",
    ],
  },
  {
    heading: "Coaches",
    paragraphs: [
      "Coaches are responsible for the programmes, advice and messages they give, and for only adding clients who agreed to be coached.",
      "Coaches must keep client information confidential and use it only to coach those clients.",
    ],
  },
  {
    heading: "Payments",
    paragraphs: [
      "When paid plans are switched on, prices are shown before you pay. Subscriptions renew until you cancel, and you can cancel at any time from the app. Cancelling stops the next payment.",
      "Your rights under UK consumer law are not affected.",
    ],
  },
  {
    heading: "Your content",
    paragraphs: [
      "What you add stays yours. You let us store and show it to the people you share it with, only to run APEX.",
      "Don't upload anything unlawful, or anything you don't have the right to share.",
    ],
  },
  {
    heading: "Closing an account",
    paragraphs: [
      "You can delete your account at any time from the app. We may suspend an account that breaks these terms, and we will tell you why.",
    ],
  },
  {
    heading: "Our responsibility",
    paragraphs: [
      "We work hard to keep APEX running and your data safe, but we can't promise it will never be unavailable. We are not responsible for losses we could not reasonably foresee.",
      "Nothing in these terms limits liability for death or personal injury caused by negligence, or anything else the law does not allow us to limit.",
    ],
  },
  {
    heading: "Law",
    paragraphs: ["These terms are governed by the law of England and Wales. Questions: {email}."],
  },
];

export function privacyPolicy(d: LegalDetails = LEGAL_DETAILS): LegalSection[] {
  return PRIVACY.map((s) => ({ heading: s.heading, paragraphs: s.paragraphs.map((p) => fill(p, d)) }));
}

export function termsOfUse(d: LegalDetails = LEGAL_DETAILS): LegalSection[] {
  return TERMS.map((s) => ({ heading: s.heading, paragraphs: s.paragraphs.map((p) => fill(p, d)) }));
}

/** "5 November 2026" for the version line on the legal pages. */
export const legalDateLabel = (version = LEGAL_VERSION): string =>
  new Date(`${version}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
