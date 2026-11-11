/* Exercise comments: during a workout the client leaves a quick comment or voice note on one exercise
   ("left knee clicked on set 3", "too light"). It goes to the coach straight away in the message thread,
   tagged with the exercise and set, and is listed again in the session summary. No new tables: the messages
   and the session summary carry it. Pure, so it is unit tested. */

export interface ExerciseComment {
  exerciseId: number;
  exercise: string;
  /** 1-based set the client was on, or null for the exercise as a whole. */
  set: number | null;
  text: string;
  /** Sent as a voice note rather than typed. */
  voice?: boolean;
}

export const COMMENT_MAX = 300;
/** Quick picks so a comment takes one tap between sets. */
export const COMMENT_IDEAS = ["Felt easy", "Too heavy", "Felt it in the wrong place", "Something hurt", "Not sure about my form", "Loved this one"];

const MARK = "💬";
const VOICE_MARK = "🎙";

/** Why the comment can't be sent, or null. */
export function commentProblem(text: string): string | null {
  const t = text.trim();
  if (t.length < 2) return "Write a few words, or record a voice note.";
  if (t.length > COMMENT_MAX) return `Keep it to ${COMMENT_MAX} characters.`;
  return null;
}

const where = (c: Pick<ExerciseComment, "exercise" | "set">) => `${c.exercise}${c.set ? ` · set ${c.set}` : ""}`;

/** The message the coach receives: "💬 Back Squat · set 3: Left knee clicked". */
export const commentMessage = (c: Pick<ExerciseComment, "exercise" | "set" | "text">): string => `${MARK} ${where(c)}: ${c.text.trim()}`;
/** Sent just before a voice note, so the coach knows what it's about. */
export const voiceCommentMessage = (c: Pick<ExerciseComment, "exercise" | "set">): string => `${VOICE_MARK} Voice note on ${where(c)}`;

/** Reads a comment message back, so the thread can show the exercise as a tag. Null for any other message. */
export function readComment(text: string): { exercise: string; set: number | null; body: string; voice: boolean } | null {
  const typed = /^💬 (.+?)(?: · set (\d+))?: ([\s\S]+)$/u.exec(text);
  if (typed) return { exercise: typed[1]!, set: typed[2] ? Number(typed[2]) : null, body: typed[3]!.trim(), voice: false };
  const spoken = /^🎙 Voice note on (.+?)(?: · set (\d+))?$/u.exec(text);
  if (spoken) return { exercise: spoken[1]!, set: spoken[2] ? Number(spoken[2]) : null, body: "", voice: true };
  return null;
}

/** Lines for the end-of-session message: `💬 Back Squat (set 3): "Left knee clicked"`. */
export const commentLines = (list: ExerciseComment[]): string[] =>
  list.map((c) => `${MARK} ${c.exercise}${c.set ? ` (set ${c.set})` : ""}: ${c.voice ? "voice note" : `"${c.text.trim()}"`}`);

/** Comments grouped by exercise, in the order they were made. */
export function commentsByExercise(list: ExerciseComment[]): { exercise: string; comments: ExerciseComment[] }[] {
  const out: { exercise: string; comments: ExerciseComment[] }[] = [];
  for (const c of list) {
    const g = out.find((x) => x.exercise === c.exercise);
    if (g) g.comments.push(c);
    else out.push({ exercise: c.exercise, comments: [c] });
  }
  return out;
}
