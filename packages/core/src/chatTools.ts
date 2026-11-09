/* Chat tools: the coach's saved replies (with a {name} placeholder) and the rules for voice notes.
   Pure, so it is unit tested. */

export interface SavedReply { id: string; title: string; body: string }

export const MAX_REPLIES = 50;
export const REPLY_TITLE_MAX = 40;
export const REPLY_BODY_MAX = 1000;

/** Starter replies a coach can add in one tap. Original wording, UK English. */
export const REPLY_IDEAS: Omit<SavedReply, "id">[] = [
  { title: "Great session", body: "Great work today, {name}. That's exactly the effort we want. Rest up and go again next session." },
  { title: "Check-in thanks", body: "Thanks for your check-in, {name}. I've read it and I'll adjust next week where it helps. Any questions, just shout." },
  { title: "Missed a session", body: "No stress about missing a session, {name}. Life happens. Pick up with the next one in your plan and don't try to double up." },
  { title: "Form video please", body: "Could you film your next working set from the side, {name}? Send it in Form checks and I'll take a look." },
  { title: "Sleep and recovery", body: "Your recovery matters as much as the training, {name}. Aim for a regular bedtime this week and let me know how you feel." },
  { title: "Protein reminder", body: "Quick one, {name}: try to get some protein in every meal this week. It makes hitting your target much easier." },
];

/** Fills {name} with the client's first name ("there" when unknown). */
export function fillReply(body: string, firstName: string): string {
  return body.replace(/\{name\}/gi, firstName.trim() || "there");
}

/** What's wrong with a saved reply, or null when it's fine. */
export function replyProblem(r: { title: string; body: string }): string | null {
  if (!r.title.trim()) return "Give it a short name";
  if (r.title.trim().length > REPLY_TITLE_MAX) return `Keep the name under ${REPLY_TITLE_MAX} characters`;
  if (!r.body.trim()) return "Write the message";
  if (r.body.trim().length > REPLY_BODY_MAX) return `Keep the message under ${REPLY_BODY_MAX} characters`;
  return null;
}

/** Replies whose name or text contains every word typed, in order of name match first. */
export function searchReplies(list: SavedReply[], q: string): SavedReply[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  const hits = list.filter((r) => words.every((w) => `${r.title} ${r.body}`.toLowerCase().includes(w)));
  return hits.sort((a, b) => Number(words.every((w) => b.title.toLowerCase().includes(w))) - Number(words.every((w) => a.title.toLowerCase().includes(w))));
}

/** Voice notes: up to two minutes. */
export const VOICE_MAX_SECONDS = 120;
/** Shorter than this is almost always a mis-tap. */
export const VOICE_MIN_SECONDS = 1;

/** "0:07", "1:30". */
export function voiceClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The text stored with a voice note, so notifications, exports and older app versions still read sensibly. */
export function voiceBody(seconds: number): string {
  return `Voice note (${voiceClock(seconds)})`;
}

/** The recording formats phones and browsers make, best first. The first one the browser supports is used. */
export const VOICE_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/aac"];

/** File extension for a recorded type ("audio/webm;codecs=opus" → "webm"). */
export function voiceExt(type: string): string {
  const base = type.split(";")[0]!.trim();
  return base === "audio/mp4" ? "m4a" : base === "audio/aac" ? "aac" : base === "audio/ogg" ? "ogg" : "webm";
}

/** Where a voice note lives in storage: under the client's folder, so both sides of the chat can read it. */
export function voicePath(clientId: string, id: string, type: string): string {
  return `${clientId}/${id}.${voiceExt(type)}`;
}
