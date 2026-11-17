/* Custom check-in questions: the coach adds their own questions to the weekly check-in, the client answers them
   with the rest of the form. Each answer keeps a copy of its question, so editing the form later never changes
   what an old check-in says. Live: coach_check_in_forms and check_ins.answers
   (supabase/migrations/20261116100000_check_in_questions.sql). Pure, so it is unit tested. */

export type QuestionKind = "text" | "scale" | "yesno";

export interface CheckInQuestion {
  id: string;
  text: string;
  kind: QuestionKind;
}

export interface CheckInAnswer {
  id: string;
  /** The question as it was asked. */
  question: string;
  kind: QuestionKind;
  /** Text for "text", 1 to 5 for "scale", true or false for "yesno". */
  value: string | number | boolean;
}

export const QUESTION_KINDS: { kind: QuestionKind; title: string; hint: string }[] = [
  { kind: "text", title: "Written answer", hint: "A few words or sentences" },
  { kind: "scale", title: "1 to 5", hint: "Tap a number" },
  { kind: "yesno", title: "Yes or no", hint: "One tap" },
];

export const MAX_QUESTIONS = 12;
export const MAX_QUESTION_LENGTH = 200;
export const MAX_ANSWER_LENGTH = 2000;

/** Ideas the coach can add with one tap. Our own wording. */
export const QUESTION_IDEAS: Omit<CheckInQuestion, "id">[] = [
  { text: "Did you hit your step goal most days?", kind: "yesno" },
  { text: "How confident do you feel about next week?", kind: "scale" },
  { text: "Any pain or niggles? Where?", kind: "text" },
  { text: "How many days did you follow your meal plan?", kind: "text" },
  { text: "How well did you recover between sessions?", kind: "scale" },
  { text: "Did you drink enough water most days?", kind: "yesno" },
  { text: "Anything you'd like changed in your plan?", kind: "text" },
  { text: "What's one thing you'll do better next week?", kind: "text" },
];

/** Shown in the demo, so the feature has something in it. */
export const SAMPLE_QUESTIONS: CheckInQuestion[] = [
  { id: "q-steps", text: "Did you hit your step goal most days?", kind: "yesno" },
  { id: "q-confidence", text: "How confident do you feel about next week?", kind: "scale" },
  { id: "q-change", text: "Anything you'd like changed in your plan?", kind: "text" },
];

export const newQuestion = (text = "", kind: QuestionKind = "text", id = `q-${Math.random().toString(36).slice(2, 10)}`): CheckInQuestion => ({ id, text, kind });

/** The questions as the coach typed them, or the reason they can't be saved. Blank ones are dropped first. */
export function cleanQuestions(qs: CheckInQuestion[]): CheckInQuestion[] {
  return qs.map((q) => ({ ...q, text: q.text.replace(/\s+/g, " ").trim() })).filter((q) => q.text);
}

export function questionsProblem(qs: CheckInQuestion[]): string | null {
  const list = cleanQuestions(qs);
  if (list.length > MAX_QUESTIONS) return `Up to ${MAX_QUESTIONS} questions, so the check-in stays quick.`;
  if (list.some((q) => q.text.length > MAX_QUESTION_LENGTH)) return `Keep each question under ${MAX_QUESTION_LENGTH} characters.`;
  if (list.some((q) => !QUESTION_KINDS.some((k) => k.kind === q.kind))) return "Pick an answer type for each question.";
  const seen = new Set<string>();
  for (const q of list) {
    const k = q.text.toLowerCase();
    if (seen.has(k)) return `"${q.text}" is in the list twice.`;
    seen.add(k);
  }
  return null;
}

export type AnswerValues = Record<string, string | number | boolean | null | undefined>;

/** What the client answered, ready to save. Unanswered questions are left out (every question is optional). */
export function answersFor(questions: CheckInQuestion[], values: AnswerValues): CheckInAnswer[] {
  const out: CheckInAnswer[] = [];
  for (const q of questions) {
    const v = values[q.id];
    if (q.kind === "text" && typeof v === "string" && v.trim()) out.push({ id: q.id, question: q.text, kind: q.kind, value: v.trim().slice(0, MAX_ANSWER_LENGTH) });
    if (q.kind === "scale" && typeof v === "number" && v >= 1 && v <= 5) out.push({ id: q.id, question: q.text, kind: q.kind, value: Math.round(v) });
    if (q.kind === "yesno" && typeof v === "boolean") out.push({ id: q.id, question: q.text, kind: q.kind, value: v });
  }
  return out;
}

/** An answer as words, for the coach's view. */
export function answerText(a: CheckInAnswer): string {
  if (a.kind === "yesno") return a.value ? "Yes" : "No";
  if (a.kind === "scale") return `${a.value} out of 5`;
  return String(a.value);
}

/** Answers read back from the database: anything malformed is skipped rather than breaking the check-in. */
export function readAnswers(raw: unknown): CheckInAnswer[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is CheckInAnswer =>
    !!a && typeof a === "object" && typeof (a as CheckInAnswer).question === "string" && ["text", "scale", "yesno"].includes((a as CheckInAnswer).kind) && ["string", "number", "boolean"].includes(typeof (a as CheckInAnswer).value));
}

export function readQuestions(raw: unknown): CheckInQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((q): q is CheckInQuestion =>
    !!q && typeof q === "object" && typeof (q as CheckInQuestion).id === "string" && typeof (q as CheckInQuestion).text === "string" && ["text", "scale", "yesno"].includes((q as CheckInQuestion).kind));
}
