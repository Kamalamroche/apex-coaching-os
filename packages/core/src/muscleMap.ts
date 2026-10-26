/* Which regions of the body map light up for an exercise.
   The first muscle in an exercise's list is its primary muscle; the rest are supporting. */

export type BodyRegion =
  | "neck" | "traps" | "delts" | "rearDelts" | "chest" | "biceps" | "triceps" | "forearms"
  | "serratus" | "abs" | "obliques" | "upperBack" | "lats" | "lowerBack" | "hipFlexors"
  | "glutes" | "gluteMed" | "adductors" | "quads" | "hamstrings" | "calves" | "tibialis";

export type RegionRole = "primary" | "supporting";

const REGIONS: Record<string, BodyRegion[]> = {
  Neck: ["neck"], Traps: ["traps"], "Lower traps": ["upperBack"],
  Delts: ["delts", "rearDelts"], Shoulders: ["delts", "rearDelts"], "Front delts": ["delts"], "Side delts": ["delts", "rearDelts"],
  "Rear delts": ["rearDelts"], "Rotator cuff": ["rearDelts"],
  Chest: ["chest"], "Upper chest": ["chest"], Serratus: ["serratus"],
  Biceps: ["biceps"], Triceps: ["triceps"], Forearms: ["forearms"],
  Abs: ["abs"], "Transverse abdominis": ["abs"], Obliques: ["obliques"], Core: ["abs", "obliques"],
  "Upper back": ["upperBack"], Rhomboids: ["upperBack"], Lats: ["lats"], Back: ["upperBack", "lats", "lowerBack"], Spine: ["lowerBack", "upperBack"],
  "Hip flexors": ["hipFlexors"], Hips: ["hipFlexors", "gluteMed"],
  Glutes: ["glutes"], "Glute medius": ["gluteMed"], Adductors: ["adductors"],
  Quads: ["quads"], Hamstrings: ["hamstrings"], Calves: ["calves"], Tibialis: ["tibialis"], Ankles: ["calves", "tibialis"],
};

export const regionsForMuscle = (muscle: string): BodyRegion[] => REGIONS[muscle] ?? [];

/** Region → role for the body map. A region that is primary is never also shown as supporting. */
export function muscleHighlights(muscles: string[]): Partial<Record<BodyRegion, RegionRole>> {
  const out: Partial<Record<BodyRegion, RegionRole>> = {};
  muscles.forEach((m, i) => {
    for (const r of regionsForMuscle(m)) if (!out[r]) out[r] = i === 0 ? "primary" : "supporting";
  });
  return out;
}
