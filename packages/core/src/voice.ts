/* Voice to workout: turns what a coach says after a session ("squat four by six at eighty kilos,
   then RDL three sets of ten") into the one-exercise-per-line text that parseProgramText reads.
   The coach still checks every line and match before anything is added. */

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** "one hundred and twenty two point five" → "122.5"; leaves other words alone. */
export function numberWordsToDigits(text: string): string {
  const words = text.split(/(\s+|-)/);
  const out: string[] = [];
  let value: number | null = null;
  let decimal: string | null = null;
  let pendingSpace = "";
  const flush = () => {
    if (value !== null) out.push(`${value}${decimal !== null ? `.${decimal}` : ""}`);
    value = null;
    decimal = null;
  };
  for (const raw of words) {
    if (/^\s+$|^-$/.test(raw)) { if (value === null) out.push(raw); else pendingSpace = raw; continue; }
    const w = raw.toLowerCase().replace(/[.,!?]$/, "");
    const trail = raw.slice(w.length);
    if (decimal !== null && w in UNITS) { decimal += String(UNITS[w]); pendingSpace = ""; continue; }
    if (w in UNITS || w in TENS) {
      const n = UNITS[w] ?? TENS[w] ?? 0;
      value = value === null ? n : value % 10 === 0 && value % 100 !== 0 && n < 10 ? value + n : value >= 100 && value % 100 === 0 ? value + n : Number(`${value}${n}`);
      pendingSpace = "";
      if (trail) { flush(); out.push(trail); }
      continue;
    }
    if (value !== null && w === "hundred") { value *= 100; pendingSpace = ""; continue; }
    if (value !== null && value >= 100 && w === "and") { pendingSpace = ""; continue; }
    if (value !== null && w === "point") { decimal = ""; pendingSpace = ""; continue; }
    if (value !== null) { flush(); out.push(pendingSpace); }
    pendingSpace = "";
    out.push(raw);
  }
  flush();
  return out.join("");
}

/** A spoken session → one exercise per line, in the shorthand coaches type. */
export function spokenToProgramText(transcript: string): string {
  return numberWordsToDigits(transcript)
    .replace(/\b(?:and then|then|next|followed by|after that)\b/gi, "\n")
    .replace(/[.;]\s*/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/(\d)\s*(?:by|times|x)\s*(\d)/gi, "$1 x $2")
        .replace(/\bat\s+(\d)/gi, "@ $1")
        .replace(/\b(?:kilograms?|kilos?|kgs?)\b/gi, "kg")
        .replace(/\bR\s*P\s*E\b/g, "RPE")
        .replace(/\b(\d+)\s*(?:seconds?|secs?)\b/gi, "$1s")
        .replace(/\s+/g, " ")
        .replace(/^[\s,]*(?:and\s+)?/i, "")
        .replace(/[\s,]+$/, "")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}
