/* Quick answers: the coach writes answers to the questions clients ask again and again. When a client types a question,
   the closest of the coach's own answers shows straight away; if none fits, it goes to the coach as a message.
   Rule-based word matching (no AI service), so every answer a client sees was written by their coach. Pure, unit tested. */

export interface CoachAnswer { id: string; question: string; answer: string }

export const ANSWER_STARTERS: Omit<CoachAnswer, "id">[] = [
  { question: "Can I move a session to another day?", answer: "Yes. Do the sessions in order and move them to any day that suits you this week, but try not to do two hard days in a row." },
  { question: "What if I miss a session?", answer: "Just pick up with the next one in your plan. Don't try to double up to catch up." },
  { question: "How heavy should I go?", answer: "Pick a weight where the last two reps are hard but your form stays clean. The RPE number on each exercise tells you how hard it should feel." },
  { question: "Can I train if I'm sore?", answer: "Mild soreness is fine, so warm up well and it usually eases. If it's sharp pain, joint pain or gets worse as you go, stop and message me." },
  { question: "What should I eat before training?", answer: "A normal meal two to three hours before, or a small snack with some carbs an hour before, such as a banana or toast." },
  { question: "When do I send my check-in?", answer: "On your check-in day each week. You'll see a reminder on Today. Photos are optional but help me see progress." },
];

const STOP = new Set("a an and are be can could do does for how i if in is it me my of on or should the to what when where which will with you your am was this that".split(" "));
const stem = (w: string) => {
  const v = w.length > 4 ? w.replace(/(ing|ed)$/, "") : w;
  return v.length > 3 && v.endsWith("s") && !v.endsWith("ss") ? v.slice(0, -1) : v;
};
export function words(text: string): string[] {
  return [...new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem))];
}

/** The coach's answers that fit the question, best first. Needs at least one shared meaningful word and a fair overlap. */
export function matchAnswers(question: string, answers: CoachAnswer[], max = 3): CoachAnswer[] {
  const q = words(question);
  if (!q.length) return [];
  return answers
    .map((a) => {
      const qa = words(a.question);
      const body = new Set(words(a.answer));
      const inQuestion = q.filter((w) => qa.includes(w)).length;
      const inAnswer = q.filter((w) => !qa.includes(w) && body.has(w)).length;
      const score = (inQuestion * 2 + inAnswer) / (q.length * 2);
      return { a, score, inQuestion };
    })
    .filter((x) => x.inQuestion > 0 && x.score >= 0.25)
    .sort((x, y) => y.score - x.score)
    .slice(0, max)
    .map((x) => x.a);
}

export function answerProblem(a: { question: string; answer: string }): string | null {
  if (a.question.trim().length < 4) return "Write the question";
  if (a.question.trim().length > 160) return "Keep the question under 160 characters";
  if (a.answer.trim().length < 4) return "Write your answer";
  if (a.answer.trim().length > 1500) return "Keep the answer under 1,500 characters";
  return null;
}
