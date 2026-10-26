/* Turns a row of the APEX Movement Library sheet into an Exercise.
   The sheet only has name, category, equipment and focus, and its equipment
   column says "Bodyweight" for many loaded lifts, so pattern, body area,
   muscles and corrected equipment are worked out from the name here.
   Used by scripts/build-movement-library.ts; kept pure so it can be tested. */

import type { BodyArea, Exercise, MovementPattern, TrainingType } from "./types";

export interface SheetRow {
  no: number;
  category: string;
  name: string;
  equipment: string;
  focus: string;
}

/** Sheet rows that are already in the library under ids 1-15 (sheet name → id). */
export const STARTER_SHEET_NAMES: Record<string, number> = {
  "Barbell Back Squat": 1, "Romanian Deadlift": 2, "Incline Barbell Bench Press": 3, "Pull-Up": 4,
  "Barbell Overhead Press": 5, "Barbell Row": 6, "Lateral Raise": 7, "Goblet Squat": 9,
  "Dumbbell Bench Press": 11, "Lat Pulldown": 12, "Face Pull": 13, "Plank": 14, "Trap Bar Deadlift": 15,
};

const TYPES: Record<string, TrainingType> = {
  "Major Compound": "Strength", "Minor / Accessory": "Accessory", Power: "Power", Plyometric: "Plyometric",
  "Isometric Strength": "Isometric", "Stability & Balance": "Balance", Mobility: "Mobility", Stretching: "Stretching",
  Yoga: "Yoga", "Core - Front": "Core", "Core - Lateral": "Core", "Core - Rotational / Twisting": "Core",
};

export function trainingType(category: string): TrainingType {
  const t = TYPES[category];
  if (!t) throw new Error(`Unknown sheet category "${category}"`);
  return t;
}

/* ───────────── equipment ───────────── */

const EQUIPMENT_NAMES: Record<string, string> = {
  "Bodyweight / Mat": "Bodyweight", "Yoga Mat": "Yoga mat", "Resistance Band": "Resistance band", "Medicine Ball": "Medicine ball",
  "Stability Ball": "Stability ball", "Bosu Ball": "Bosu ball", "Foam Roller": "Foam roller", "Balance Equipment": "Balance equipment",
  "TRX / Suspension Trainer": "Suspension trainer",
};

/* Sheet rows whose equipment column is wrong or too vague, by exercise name. */
const EQUIPMENT_FIXES: Record<string, string> = {
  "Hammer Curl": "Dumbbell", "Concentration Curl": "Dumbbell", "Preacher Curl": "EZ bar", "Zottman Curl": "Dumbbell",
  "Cross-Body Hammer Curl": "Dumbbell", "Reverse Curl": "EZ bar", "Triceps Pushdown": "Cable", "Overhead Triceps Extension": "Dumbbell",
  "Skull Crusher": "EZ bar", "Close-Grip Bench Press": "Barbell", "Triceps Rope Pushdown": "Cable", "JM Press": "Barbell",
  "Front Raise": "Dumbbell", "Rear Delt Fly": "Dumbbell", "Upright Row": "Barbell", "Face Pull": "Cable",
  "Arnold Press": "Dumbbell", "Cuban Press": "Dumbbell", "Bradford Press": "Barbell", "Scarecrow Raise": "Dumbbell",
  "Wrist Curl": "Dumbbell", "Reverse Wrist Curl": "Dumbbell", "Farmer's Carry Grip Hold": "Dumbbell", "Plate Pinch Hold": "Weight plate",
  "Dead Hang": "Pull-up bar", "Wrist Roller": "Wrist roller", "Reverse Grip Hold": "Barbell", "Fat Grip Hold": "Dumbbell",
  "Towel Pull-Up Hold": "Pull-up bar", "Grip Crush Hold": "Hand gripper", "Standing Calf Raise": "Machine", "Seated Calf Raise": "Machine",
  "Donkey Calf Raise": "Machine", "Calf Press on Leg Sled": "Machine", "Jump Rope Calf Pump": "Jump rope", "Svend Press": "Weight plate",
  "Straight-Arm Pulldown": "Cable", "Leg Extension": "Machine", "Lying Leg Curl": "Machine", "Seated Leg Curl": "Machine",
  "Neck Harness Extension": "Neck harness", "Y-Raise": "Dumbbell", "T-Raise": "Dumbbell", "W-Raise": "Dumbbell",
  "Trap 3 Raise": "Dumbbell", "Serratus Punch": "Dumbbell",
  "Overhead Squat": "Barbell", "Box Squat": "Barbell", "Zercher Squat": "Barbell", "Hack Squat": "Machine",
  "Bulgarian Split Squat": "Dumbbell", "Goblet Squat": "Dumbbell", "Sumo Squat": "Dumbbell", "Pause Squat": "Barbell",
  "Conventional Deadlift": "Barbell", "Sumo Deadlift": "Barbell", "Romanian Deadlift": "Barbell", "Stiff-Leg Deadlift": "Barbell",
  "Trap Bar Deadlift": "Trap bar", "Deficit Deadlift": "Barbell", "Rack Pull": "Barbell", "Single-Leg Romanian Deadlift": "Dumbbell",
  "Snatch-Grip Deadlift": "Barbell", "Block Pull": "Barbell", "Decline Bench Press": "Barbell", "Push Press": "Barbell",
  "Floor Press": "Barbell", "Push Jerk": "Barbell", "Pendlay Row": "Barbell", "T-Bar Row": "Landmine", "Seal Row": "Barbell",
  "Lat Pulldown": "Cable", "Meadows Row": "Landmine", "Power Clean": "Barbell", "Hang Clean": "Barbell", "Clean and Jerk": "Barbell",
  "Snatch": "Barbell", "Split Jerk": "Barbell", "Thruster": "Barbell", "Clean Pull": "Barbell", "Snatch Pull": "Barbell",
  "Muscle Snatch": "Barbell",
  "Hang Power Clean": "Barbell", "Power Snatch": "Barbell", "Clean High Pull": "Barbell", "Snatch High Pull": "Barbell",
  "Push Press from Blocks": "Barbell", "Explosive Trap Bar Jump": "Trap bar", "Standing Rotational Power Throw": "Medicine ball",
  "Battle Rope Double Wave": "Battle rope", "Resisted Sprint Start": "Sled", "Sled Push": "Sled", "Sled Pull": "Sled",
  "Speed Deadlift": "Barbell", "Speed Bench Press": "Barbell", "Trap Bar Jump Shrug": "Trap bar", "Weighted Jump Squat": "Dumbbell",
  "Plyo Push-Up to Box": "Box", "Hex Bar Jump": "Trap bar",
  "Box Jump": "Box", "Single-Leg Box Jump": "Box", "Box Jump Step-Down": "Box", "Squat Jump to Box": "Box", "Box-to-Box Jump": "Box",
  "Lateral Box Jump": "Box", "Jump Rope Double Under": "Jump rope", "Hurdle Hop": "Hurdles", "Cone Hop": "Cones",
  "Isometric Deadlift Pull Against Pins": "Barbell", "Isometric Bench Press Hold": "Barbell", "Isometric Row Hold": "Dumbbell",
  "Isometric Overhead Press Hold": "Barbell", "Isometric Shoulder Press Hold": "Dumbbell", "Isometric Bicep Curl Hold": "Dumbbell",
  "Isometric Triceps Extension Hold": "Dumbbell", "Isometric Leg Extension Hold": "Machine", "Isometric Leg Curl Hold": "Machine",
  "Isometric Farmer Hold": "Dumbbell", "Isometric Front Rack Hold": "Barbell", "Isometric Overhead Carry Hold": "Dumbbell",
  "Isometric Goblet Squat Hold": "Dumbbell", "Isometric Face Pull Hold": "Cable", "Isometric Box Squat Hold": "Barbell",
  "Isometric Deadlift Lockout Hold": "Barbell", "Isometric Bent-Over Row Hold": "Barbell", "Isometric Hip Thrust Hold": "Barbell",
  "Isometric Overhead Squat Hold": "Barbell", "Isometric Deadlift Mid-Shin Hold": "Barbell",
  "Single-Arm Farmer Carry": "Dumbbell", "Suitcase Carry": "Kettlebell", "Overhead Carry": "Dumbbell", "Waiter's Carry": "Kettlebell",
  "Balance Beam Walk": "Balance equipment", "Single-Arm Overhead Carry": "Kettlebell", "Single-Leg Deadlift to Row": "Dumbbell",
  "Half-Kneeling Pallof Press": "Cable",
  "Foam Roll IT Band": "Foam roller",
  "Weighted Plank": "Weight plate", "Ab Wheel Rollout": "Ab wheel", "Weighted Sit-Up": "Weight plate", "Knee Tuck on Slider": "Sliders",
  "Sliding Plank Knee Tuck": "Sliders", "Suspended Ab Fallout": "Suspension trainer", "Single-Arm Suitcase Hold": "Kettlebell",
  "Standing Pallof Press": "Cable", "Kneeling Pallof Press": "Cable", "Battle Rope Rotational Slam": "Battle rope",
  "Standing Rotational Row": "Cable", "Kneeling Rotational Chop": "Cable", "Rotational Bench Press": "Dumbbell",
};

export function equipmentFor(row: Pick<SheetRow, "name" | "equipment">): string {
  return EQUIPMENT_FIXES[row.name] ?? EQUIPMENT_NAMES[row.equipment] ?? row.equipment;
}

/* ───────────── pattern ───────────── */

const has = (name: string, re: RegExp) => re.test(name.toLowerCase());

const HINGE = /deadlift|\brdl\b|good morning|hip thrust|bridge|swing|clean|snatch|rack pull|block pull|pull-through|nordic|hamstring curl|high pull|jump shrug/;
const SQUAT = /squat|lunge|step-up|step-down|split|wall sit|pistol|thruster|leg press/;
const PULL = /\brow\b|pull-up|chin-up|pulldown|face pull|pull-apart/;
const PUSH = /press|push-up|bench|\bdip\b|jerk|handstand|chest pass|wall push/;

export function patternFor(row: Pick<SheetRow, "name" | "category">): MovementPattern {
  const type = trainingType(row.category);
  const n = row.name;
  if (type === "Mobility" || type === "Stretching" || type === "Yoga") return "Mobility";
  if (has(n, /carry|farmer|waiter/)) return "Carry";
  if (type === "Core" || has(n, /pallof/)) return "Core";
  if (type === "Accessory") return has(n, /bench press|push-up|\bdip\b|jm press/) ? "Push" : "Isolation";
  if (has(n, HINGE)) return "Hinge";
  if (type === "Power" || type === "Plyometric") {
    if (has(n, PUSH)) return "Push";
    if (has(n, PULL)) return "Pull";
    return "Power";
  }
  if (has(n, /jerk/)) return "Push";
  if (has(n, SQUAT)) return "Squat";
  if (has(n, PULL)) return "Pull";
  if (has(n, PUSH)) return "Push";
  return type === "Isometric" ? "Isolation" : "Core";
}

/* ───────────── body area ───────────── */

const AREAS: [RegExp, BodyArea][] = [
  [/leg curl|hamstring|nordic|calf/, "Legs"],
  [/pallof|bird dog|plank|mountain climber|rollout/, "Core"],
  [/clean|snatch|jerk|thruster|burpee|carry|farmer|waiter|sled|battle rope|\bswing\b|bear crawl|crab walk|sun salutation|inchworm|world's greatest/, "Full body"],
  [/curl|tricep|overhead extension|skull|dumbbell kickback|\bdip\b|diamond|wrist|grip|pinch|dead hang|forearm|bicep|jm press|close-grip/, "Arms"],
  [/overhead press|shoulder|lateral raise|front raise|rear delt|arnold|cuban|bradford|scarecrow|y-raise|t-raise|w-raise|external rotation|internal rotation|upright row|serratus|handstand|push press|landmine press|arm circles|dislocate|pass-through|trap 3|dolphin|reverse fly|bottoms-up press/, "Shoulders"],
  [/bench press|incline.*press|chest|\bfly\b|push-up|pec\b|pec |svend|floor press|wall push/, "Chest"],
  [/\brow\b|pull-up|chin-up|pulldown|pullover|pull-apart|shrug|lat stretch|rack pull|block pull|upper back|face pull|neck|levator|scalene|upper trap|spine|spinal|thoracic|cat|cow|cobra|twist|open book|thread the needle|prone press|locust|bow pose|sphinx|camel|wheel|fish|child's|puppy|chakravakasana/, "Back"],
  [/squat|lunge|deadlift|\brdl\b|pull-through|couch|calf|tibialis|leg|glute|hip|quad|adductor|abductor|step|jump|hop|bound|sprint|skip|knee|ankle|piriformis|it band|frog|split|pigeon|butterfly|bridge|clamshell|fire hydrant|kick|warrior|chair|tree|goddess|garland|lizard|toe|straddle|happy baby|figure-4|90\/90|lotus|hero|bound angle|eagle|crescent|cossack|pistol|wall sit|carioca|duck walk|high knees|balance|head-to-knee|forward fold|forward bend/, "Legs"],
];

export function bodyAreaFor(row: Pick<SheetRow, "name" | "category">): BodyArea {
  if (trainingType(row.category) === "Core") return "Core";
  const n = row.name.toLowerCase();
  return AREAS.find(([re]) => re.test(n))?.[1] ?? "Full body";
}

/* ───────────── muscles ───────────── */

const MUSCLES: [RegExp, string[]][] = [
  [/leg curl|hamstring curl|nordic/, ["Hamstrings"]],
  [/close-grip|jm press|skull|tricep|overhead extension|dumbbell kickback|\bdip\b|diamond/, ["Triceps"]],
  [/hammer curl|reverse curl|zottman/, ["Biceps", "Forearms"]],
  [/wrist|forearm|roller/, ["Forearms"]],
  [/curl/, ["Biceps"]],
  [/calf|calves/, ["Calves"]],
  [/tibialis/, ["Tibialis"]],
  [/rear delt|reverse fly|pull-apart/, ["Rear delts", "Upper back"]],
  [/face pull/, ["Rear delts", "Rotator cuff"]],
  [/external rotation|internal rotation/, ["Rotator cuff"]],
  [/y-raise|t-raise|w-raise|trap 3|scarecrow|cuban/, ["Rear delts", "Lower traps"]],
  [/lateral raise/, ["Side delts"]],
  [/front raise/, ["Front delts"]],
  [/shrug|upright row/, ["Traps"]],
  [/serratus/, ["Serratus"]],
  [/neck/, ["Neck"]],
  [/clean|snatch|high pull|jump shrug/, ["Glutes", "Hamstrings", "Traps"]],
  [/overhead press|shoulder press|arnold|bradford|push press|landmine press|bottoms-up press|jerk|handstand/, ["Delts", "Triceps"]],
  [/pullover/, ["Lats", "Chest"]],
  [/\bfly\b|pec|svend/, ["Chest"]],
  [/bench press|incline.*press|push-up|floor press|chest pass|wall push/, ["Chest", "Triceps"]],
  [/pulldown|pull-up|chin-up/, ["Lats", "Biceps"]],
  [/\brow\b/, ["Lats", "Upper back"]],
  [/adductor/, ["Adductors"]],
  [/abductor|clamshell|fire hydrant/, ["Glute medius"]],
  [/leg extension|sissy/, ["Quads"]],
  [/deadlift|\brdl\b|good morning|pull-through|swing|rack pull|block pull/, ["Hamstrings", "Glutes"]],
  [/glute|bridge|hip thrust|kickback|hip extension|frog pump/, ["Glutes", "Hamstrings"]],
  [/thruster/, ["Quads", "Glutes", "Delts"]],
  [/squat|lunge|step-up|step-down|split|leg press|wall sit|pistol/, ["Quads", "Glutes"]],
  [/sled pull/, ["Hamstrings", "Glutes"]],
  [/jump|hop|bound|sprint|skip|sled|depth drop/, ["Quads", "Glutes", "Calves"]],
  [/carry|farmer|waiter|suitcase|grip|pinch|dead hang/, ["Forearms", "Traps"]],
  [/battle rope/, ["Shoulders", "Core"]],
  [/slam|throw|toss/, ["Core", "Lats"]],
];

const PALLOF = ["Obliques", "Transverse abdominis"];

const CORE_MUSCLES: Record<string, string[]> = {
  "Core - Front": ["Abs"], "Core - Lateral": ["Obliques"], "Core - Rotational / Twisting": ["Obliques", "Transverse abdominis"],
};

/* What a stretch or mobility drill mainly opens up. */
const STRETCHED: [RegExp, string[]][] = [
  [/hamstring|toe touch|forward fold|forward bend|head-to-knee|half-split|split/, ["Hamstrings"]],
  [/quad|couch/, ["Quads"]],
  [/hip flexor|low lunge|crescent|lizard/, ["Hip flexors"]],
  [/calf|ankle|shin|dorsiflexion/, ["Calves"]],
  [/adductor|butterfly|straddle|frog|bound angle|wide-angle|cossack|goddess/, ["Adductors"]],
  [/squat/, ["Hips", "Ankles"]],
  [/piriformis|glute|pigeon|figure-4|90\/90|hip/, ["Glutes"]],
  [/chest|pec/, ["Chest"]],
  [/lat stretch|lat\b/, ["Lats"]],
  [/neck|trap|levator|scalene/, ["Neck"]],
  [/wrist|forearm/, ["Forearms"]],
  [/tricep/, ["Triceps"]],
  [/bicep/, ["Biceps"]],
  [/shoulder|rear delt|dislocate|pass-through|arm circles/, ["Shoulders"]],
  [/spine|spinal|thoracic|twist|cat|cow|cobra|open book|thread the needle|windmill/, ["Spine"]],
];

export function musclesFor(row: Pick<SheetRow, "name" | "category">): string[] {
  const type = trainingType(row.category);
  const n = row.name.toLowerCase();
  if (type === "Core") return CORE_MUSCLES[row.category] ?? ["Core"];
  if (n.includes("pallof")) return PALLOF;
  const table = type === "Mobility" || type === "Stretching" || type === "Yoga" ? STRETCHED : MUSCLES;
  return table.find(([re]) => re.test(n))?.[1] ?? [];
}

/* ───────────── aliases ───────────── */

const ALIASES: [RegExp, string[]][] = [
  [/romanian deadlift/, ["rdl"]],
  [/bulgarian split squat/, ["bss"]],
  [/overhead press/, ["ohp"]],
  [/push-up/, ["pushup", "press-up"]],
  [/pull-up/, ["pullup"]],
  [/chin-up/, ["chinup"]],
  [/sit-up/, ["situp"]],
  [/trap bar/, ["hex bar"]],
  [/hex bar/, ["trap bar"]],
  [/toes-to-bar/, ["t2b"]],
  [/skull crusher/, ["lying triceps extension"]],
  [/lateral raise/, ["side raise"]],
  [/downward dog/, ["down dog"]],
  [/world's greatest stretch/, ["wgs"]],
  [/medicine ball/, ["med ball"]],
  [/\bmed ball\b/, ["medicine ball"]],
  [/single-leg/, ["sl"]],
];

export function aliasesFor(name: string): string[] {
  const n = name.toLowerCase();
  const out = new Set<string>();
  for (const [re, words] of ALIASES) if (re.test(n)) words.forEach((w) => out.add(w));
  if (n.includes("dumbbell")) out.add(n.replace("dumbbell", "db"));
  if (n.includes("kettlebell")) out.add(n.replace("kettlebell", "kb"));
  if (n.includes("'")) out.add(n.replace(/'/g, ""));
  return [...out];
}

export function sheetRowToExercise(row: SheetRow, id: number): Exercise {
  return {
    id,
    name: row.name,
    aliases: aliasesFor(row.name),
    pattern: patternFor(row),
    category: bodyAreaFor(row),
    equipment: equipmentFor(row),
    muscles: musclesFor(row),
    cues: [],
    commonMistake: "",
    type: trainingType(row.category),
    focus: row.focus,
  };
}

/** Sheet rows → new exercises, numbered from `firstId` in sheet order, skipping the starter movements. */
export function importSheet(rows: SheetRow[], firstId: number): Exercise[] {
  let id = firstId;
  return rows.filter((r) => !(r.name in STARTER_SHEET_NAMES)).map((r) => sheetRowToExercise(r, id++));
}
