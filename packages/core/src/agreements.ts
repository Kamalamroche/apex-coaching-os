/* Contracts and waivers: the coach writes them once, clients sign by typing their name when they join,
   and new wording asks everyone again. A signature keeps a copy of what was signed. Pure, so it is unit tested.
   The starter wording is a plain-English starting point, not legal advice. */

export interface Agreement { id: string; title: string; body: string; required: boolean; version: number; active: boolean; updatedAt: string }
export interface Signature { id: string; agreementId: string | null; clientId: string; version: number; title: string; body: string; typedName: string; signedAt: string }

export const AGREEMENT_TITLE_MAX = 80;
export const AGREEMENT_BODY_MAX = 8000;

export const AGREEMENT_STARTERS: { title: string; body: string }[] = [
  {
    title: "Coaching agreement",
    body: "What you get: a training plan written for you, check-in feedback each week, and replies to your messages, usually within one working day.\n\nWhat I ask: train as planned where you can, send your check-in, and tell me straight away about pain, injury, illness or anything that changes how you can train.\n\nFees are paid monthly in advance. You can stop at any time with 14 days' notice. Plans and materials are for your own use and can't be shared or sold.",
  },
  {
    title: "Health and exercise waiver",
    body: "I confirm I have answered the health questions honestly and will update my coach if anything changes.\n\nI understand exercise carries some risk of injury. I will stop and tell my coach if I feel pain, dizziness or chest discomfort, and I will check with a doctor before training if I have a medical condition, am pregnant, or am unsure whether exercise is safe for me.\n\nI take part at my own risk and will train within my own limits.",
  },
  {
    title: "Cancellation policy",
    body: "Please give at least 24 hours' notice to move or cancel a 1:1 session. Sessions cancelled with less notice, or missed without notice, count as used.\n\nIf I need to cancel, your session is credited back in full. Session packs expire on the date shown in the app.",
  },
];

/** What's wrong with an agreement before saving, or null. */
export function agreementProblem(a: { title: string; body: string }): string | null {
  const t = a.title.trim();
  const b = a.body.trim();
  if (t.length < 2) return "Give it a title";
  if (t.length > AGREEMENT_TITLE_MAX) return `Keep the title under ${AGREEMENT_TITLE_MAX} characters`;
  if (b.length < 20) return "Write out what the client is agreeing to";
  if (b.length > AGREEMENT_BODY_MAX) return `Keep it under ${AGREEMENT_BODY_MAX} characters`;
  return null;
}

/** The client's signature for this exact version of an agreement, if any. */
export function signatureFor(a: Agreement, sigs: Signature[], clientId: string): Signature | null {
  return sigs.find((s) => s.agreementId === a.id && s.clientId === clientId && s.version === a.version) ?? null;
}

/** Active agreements this client still has to sign (current version), required ones first. */
export function toSign(agreements: Agreement[], sigs: Signature[], clientId: string): Agreement[] {
  return agreements
    .filter((a) => a.active && !signatureFor(a, sigs, clientId))
    .sort((x, y) => Number(y.required) - Number(x.required) || x.title.localeCompare(y.title));
}

/** Is the typed name a real attempt at the client's name? Two letters or more, and shares a word with their name when we know it. */
export function nameProblem(typed: string, fullName: string): string | null {
  const t = typed.trim().replace(/\s+/g, " ");
  if (t.length < 2 || !/[a-z]/i.test(t)) return "Type your full name to sign";
  if (t.length > 80) return "That name is too long";
  const known = fullName.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (known.length && !t.toLowerCase().split(/\s+/).some((w) => known.includes(w))) return `Type your name as it is on your account (${fullName})`;
  return null;
}

/** Per agreement, who has signed the current version and who hasn't. */
export function signingStatus(a: Agreement, sigs: Signature[], clients: { id: string; name: string }[]): { signed: { id: string; name: string; at: string; old: boolean }[]; waiting: { id: string; name: string; old: boolean }[] } {
  const signed: { id: string; name: string; at: string; old: boolean }[] = [];
  const waiting: { id: string; name: string; old: boolean }[] = [];
  for (const c of clients) {
    const now = signatureFor(a, sigs, c.id);
    const before = sigs.some((s) => s.agreementId === a.id && s.clientId === c.id && s.version < a.version);
    if (now) signed.push({ id: c.id, name: c.name, at: now.signedAt, old: false });
    else waiting.push({ id: c.id, name: c.name, old: before });
  }
  return { signed, waiting };
}

export function sampleAgreements(now: Date): { agreements: Agreement[]; signatures: Signature[] } {
  const at = (d: number) => new Date(now.getTime() - d * 864e5).toISOString();
  const agreements = AGREEMENT_STARTERS.slice(0, 2).map((s, i): Agreement => ({ id: `ag-${i + 1}`, ...s, required: true, version: 1, active: true, updatedAt: at(30) }));
  return { agreements, signatures: [] };
}
