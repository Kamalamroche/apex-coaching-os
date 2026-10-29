import type { Exercise } from "../types";

/* Coach-written details for movements from the sheet, which arrived without muscles, steps or tips.
   Keyed by exercise id; merged over the generated library. */
export const EXERCISE_DETAILS: Record<number, Partial<Pick<Exercise, "aliases" | "muscles" | "steps" | "cues" | "commonMistake">>> = {
  164: {
    aliases: ["sled", "prowler", "hyrox sled push", "race station"],
    muscles: ["Quads", "Glutes", "Calves", "Core"],
    steps: ["Hold the sled's uprights with straight or slightly bent arms, body leaning forward at about 45 degrees.", "Brace your core so your body forms one line from head to back heel.", "Drive the floor away with short, powerful steps, pushing through the balls of your feet.", "Keep your hips low and your head neutral until you reach the line."],
    cues: ["Low and long body line", "Short, fast steps", "Push through the balls of the feet"],
    commonMistake: "Standing too upright, so the arms push instead of the legs",
  },
  165: {
    aliases: ["rope sled pull", "hand over hand sled pull", "hyrox sled pull", "race station"],
    muscles: ["Lats", "Upper back", "Biceps", "Hamstrings", "Glutes"],
    steps: ["Stand facing the sled with the rope in front of you, feet planted and knees soft.", "Sit your hips back and brace, keeping your back flat.", "Pull the rope hand over hand, driving each pull with your back and hips, not just your arms.", "Let the rope fall to one side so you don't trip, and keep pulling until the sled crosses the line."],
    cues: ["Sit back into the pull", "Long, strong pulls", "Back flat, hips do the work"],
    commonMistake: "Standing straight-legged and pulling with the arms only",
  },
  17: {
    muscles: ["Biceps", "Forearms"],
    steps: ["Stand tall with a dumbbell in each hand, arms by your sides and palms facing forward.", "Pin your elbows to your sides and brace your core.", "Curl the weights up towards your shoulders without letting your elbows drift forward.", "Squeeze at the top, then lower slowly until your arms are straight."],
    cues: ["Elbows pinned", "No swinging", "Slow on the way down"],
    commonMistake: "Swinging the body to lift the weight",
  },
  83: {
    muscles: ["Glutes", "Hamstrings", "Core"],
    steps: ["Lie on your back with knees bent and feet flat, hip width apart.", "Tuck your chin and brace your core so your lower back stays flat.", "Drive through your heels and lift your hips until your body is straight from shoulders to knees.", "Squeeze your glutes at the top for a second, then lower under control."],
    cues: ["Push through heels", "Ribs down", "Squeeze at the top"],
    commonMistake: "Arching the lower back instead of using the glutes",
  },
  89: {
    muscles: ["Glute medius", "Glutes", "Obliques"],
    steps: ["Lie on your side with knees bent, feet together and your supporting hand flat on the floor directly under your shoulder.", "Press into the floor and lift your hips so your body is a straight line from shoulders to knees.", "Keeping your hips up and your feet together, open your top knee towards the ceiling.", "Pause at the top, then lower the knee slowly without dropping your hips."],
    cues: ["Hand under shoulder", "Hips stay up", "Feet stay together"],
    commonMistake: "Letting the hips sink or rolling them backwards to lift the knee higher",
  },
  109: {
    muscles: ["Quads", "Glutes", "Adductors"],
    steps: ["Stand a stride in front of a bench and rest the top of your back foot on it.", "Hold a dumbbell in each hand and keep your chest tall.", "Lower straight down until your front thigh is about parallel to the floor.", "Keep your front knee tracking over your toes and your front heel down.", "Drive through your front foot to stand back up."],
    cues: ["Straight down, not forward", "Front heel heavy", "Tall chest"],
    commonMistake: "Front knee collapsing inwards",
  },
  112: {
    muscles: ["Glutes", "Hamstrings", "Back", "Quads"],
    steps: ["Stand with the bar over your mid-foot, feet hip width apart.", "Hinge down and grip the bar just outside your legs.", "Drop your hips until your shins touch the bar, chest up and back flat.", "Take a big breath, brace, and push the floor away until you stand tall.", "Lower the bar by pushing your hips back first, keeping it close to your legs."],
    cues: ["Bar over mid-foot", "Brace before you pull", "Push the floor away"],
    commonMistake: "Rounding the lower back off the floor",
  },
  120: {
    muscles: ["Chest", "Triceps", "Front delts"],
    steps: ["Lie on the bench with your eyes under the bar and feet flat on the floor.", "Grip just wider than shoulder width and pull your shoulder blades back and down.", "Lift the bar out and hold it over your shoulders with straight arms.", "Lower under control to your lower chest, elbows about 45 degrees from your body.", "Press the bar back up over your shoulders."],
    cues: ["Shoulder blades squeezed", "Touch the lower chest", "Feet planted"],
    commonMistake: "Bouncing the bar off the chest",
  },
  132: {
    muscles: ["Lats", "Upper back", "Biceps"],
    steps: ["Place one knee and the same hand on a bench, back flat and parallel to the floor.", "Hold a dumbbell in the other hand with your arm straight.", "Row the dumbbell towards your hip, leading with your elbow.", "Pause at the top, then lower slowly to a full stretch."],
    cues: ["Elbow to hip", "Flat back", "Don't twist"],
    commonMistake: "Twisting the torso to lift the weight",
  },
  140: {
    muscles: ["Glutes", "Hamstrings", "Core", "Back"],
    steps: ["Stand with feet a little wider than hip width and the kettlebell slightly in front of you.", "Hinge at the hips, grip the handle and hike the bell back between your legs.", "Snap your hips forward to swing the bell up to chest height.", "Let it fall back, hinge again and repeat in one smooth rhythm."],
    cues: ["Hinge, don't squat", "Snap the hips", "Arms are just ropes"],
    commonMistake: "Lifting the bell with the arms instead of the hips",
  },
  304: {
    muscles: ["Spine", "Core"],
    steps: ["Start on all fours with wrists under shoulders and knees under hips.", "Breathe in as you drop your belly, arch your back, open your chest and lift your head all the way up (cow).", "Breathe out as you round your whole back up to the ceiling, tuck your chin and pull your belly in (cat).", "Flow slowly between the two with your breath."],
    cues: ["Move one vertebra at a time", "Breathe with the movement", "Slow and smooth"],
    commonMistake: "Rushing and only moving the neck",
  },
  536: {
    muscles: ["Back", "Hips"],
    steps: ["Kneel with big toes together and knees about hip width or wider.", "Sit your hips back towards your heels.", "Walk your hands forward and rest your forehead on the mat.", "Relax your shoulders and breathe slowly into your back."],
    cues: ["Hips to heels", "Long arms", "Breathe into your back"],
    commonMistake: "Holding tension in the shoulders",
  },
  534: {
    muscles: ["Hamstrings", "Calves", "Shoulders", "Back"],
    steps: ["Start on all fours with wrists under shoulders and knees under hips.", "Tuck your toes and lift your hips up and back.", "Press the mat away and let your head relax between your arms.", "Lengthen your spine and let your heels reach towards the mat.", "Hold and breathe slowly through your nose."],
    cues: ["Hips high", "Long spine before straight legs", "Spread your fingers wide"],
    commonMistake: "Rounding the back to force the heels down",
  },
};
