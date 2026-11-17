/* Fibre, sugar and salt. Only some foods carry them (scanned packs, foods typed in with them), so totals say how many
   of the day's items they come from. UK reference amounts for adults: fibre 30 g a day, total sugars 90 g, salt 6 g. Pure. */

export interface Micros { fibreG?: number; sugarG?: number; saltG?: number }
export const MICRO_REFERENCE = { fibreG: 30, sugarG: 90, saltG: 6 } as const;

export interface MicroTotals { fibreG: number; sugarG: number; saltG: number; withData: number; items: number }

export function microTotals(items: Micros[]): MicroTotals {
  let fibreG = 0, sugarG = 0, saltG = 0, withData = 0;
  for (const i of items) {
    if (i.fibreG === undefined && i.sugarG === undefined && i.saltG === undefined) continue;
    withData++;
    fibreG += i.fibreG ?? 0;
    sugarG += i.sugarG ?? 0;
    saltG += i.saltG ?? 0;
  }
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return { fibreG: r1(fibreG), sugarG: r1(sugarG), saltG: Math.round(saltG * 100) / 100, withData, items: items.length };
}

/** How a total sits against the reference: fibre is a goal to reach, sugar and salt are limits to stay under. */
export function microStatus(key: keyof typeof MICRO_REFERENCE, value: number): "good" | "low" | "high" {
  const ref = MICRO_REFERENCE[key];
  if (key === "fibreG") return value >= ref ? "good" : "low";
  return value > ref ? "high" : "good";
}

/** Scales a food's micros to a portion, keeping "unknown" as unknown. */
export function scaleMicros(m: Micros, factor: number): Micros {
  const out: Micros = {};
  if (m.fibreG !== undefined) out.fibreG = Math.round(m.fibreG * factor * 10) / 10;
  if (m.sugarG !== undefined) out.sugarG = Math.round(m.sugarG * factor * 10) / 10;
  if (m.saltG !== undefined) out.saltG = Math.round(m.saltG * factor * 100) / 100;
  return out;
}
