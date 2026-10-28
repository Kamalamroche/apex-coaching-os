import type { Exercise } from "../types";

/* Coach-written details for movements from the sheet, which arrived without muscles, steps or tips.
   Keyed by exercise id; merged over the generated library. */
export const EXERCISE_DETAILS: Record<number, Partial<Pick<Exercise, "muscles" | "steps" | "cues" | "commonMistake">>> = {
  16: {
    muscles: ["Biceps", "Forearms"],
    steps: ["Stand tall holding a barbell with an underhand grip, hands about shoulder width apart.", "Let the bar hang at arm's length against your thighs and brace your core.", "Keep your elbows by your sides and curl the bar up towards your shoulders.", "Squeeze at the top, then lower slowly until your arms are straight."],
    cues: ["Elbows stay by your sides", "No hip swing", "Full stretch at the bottom"],
    commonMistake: "Leaning back and swinging the bar up",
  },
  18: {
    muscles: ["Biceps", "Forearms"],
    steps: ["Stand tall with a dumbbell in each hand, palms facing your thighs.", "Pin your elbows to your sides and brace your core.", "Curl both dumbbells up, keeping your palms facing each other the whole time.", "Pause near your shoulders, then lower slowly to straight arms."],
    cues: ["Thumbs up", "Elbows pinned", "Control the way down"],
    commonMistake: "Letting the elbows drift forward to finish the rep",
  },
  26: {
    muscles: ["Triceps"],
    steps: ["Stand facing a high cable pulley holding a straight bar with an overhand grip.", "Tuck your elbows into your sides with your forearms about parallel to the floor.", "Push the bar down until your arms are fully straight, without moving your upper arms.", "Squeeze your triceps, then let the bar rise slowly back to the start."],
    cues: ["Elbows glued to your sides", "Lock out at the bottom", "Slow on the way up"],
    commonMistake: "Leaning over the bar and pushing with the shoulders",
  },
  27: {
    muscles: ["Triceps"],
    steps: ["Stand tall holding one dumbbell with both hands under the top plate.", "Press it overhead so your arms are straight and your biceps sit beside your ears.", "Bend only at the elbows and lower the dumbbell behind your head.", "Stretch at the bottom, then straighten your arms to press it back up."],
    cues: ["Elbows point forward", "Ribs down", "Upper arms stay still"],
    commonMistake: "Flaring the elbows out wide",
  },
  28: {
    muscles: ["Triceps"],
    steps: ["Lie on a flat bench holding the bar above your chest with straight arms.", "Keep your feet flat on the floor and your back on the bench.", "Bend only at the elbows and lower the bar towards your forehead.", "Stop just above your head, then straighten your arms to push the bar back up."],
    cues: ["Upper arms stay still", "Elbows point to the ceiling", "Slow and controlled"],
    commonMistake: "Letting the elbows flare out and the shoulders do the work",
  },
  36: {
    muscles: ["Front delts", "Upper chest"],
    steps: ["Stand tall with a dumbbell in each hand in front of your thighs, palms facing you.", "Brace your core and keep a slight bend in your elbows.", "Raise both dumbbells straight in front of you to shoulder height.", "Pause, then lower slowly back to your thighs."],
    cues: ["Long arms", "Stop at shoulder height", "No body swing"],
    commonMistake: "Rocking the body to throw the weights up",
  },
  37: {
    muscles: ["Rear delts", "Upper back"],
    steps: ["Hold a dumbbell in each hand and hinge at the hips until your back is about 45 degrees, knees soft.", "Let the dumbbells hang below your chest with palms facing each other.", "Keep a slight elbow bend and lift the dumbbells out wide in an arc.", "Squeeze your upper back at the top, then lower slowly."],
    cues: ["Flat back", "Lead with the elbows", "Light weight, slow tempo"],
    commonMistake: "Standing up during the rep and using momentum",
  },
  40: {
    muscles: ["Delts", "Triceps"],
    steps: ["Stand tall holding the dumbbells at chin height, palms facing you.", "Brace your core and squeeze your glutes.", "Press the dumbbells up while turning your palms to face forward.", "Finish with straight arms overhead, then reverse the turn as you lower."],
    cues: ["Rotate as you press", "Ribs down", "Full lockout"],
    commonMistake: "Arching the lower back to finish the press",
  },
  73: {
    muscles: ["Quads"],
    steps: ["Sit on the machine with your back against the pad and the roller on your lower shins.", "Line your knees up with the machine's pivot and hold the side handles.", "Straighten your legs until they are fully extended and squeeze your quads.", "Lower the weight slowly back to the start."],
    cues: ["Back against the pad", "Squeeze at the top", "Slow on the way down"],
    commonMistake: "Kicking the weight up and letting it drop",
  },
  74: {
    muscles: ["Hamstrings", "Calves"],
    steps: ["Lie face down on the machine with the roller on the back of your lower calves, just above the heels.", "Hold the handles and press your hips into the pad.", "Curl your heels up towards your glutes as far as you can.", "Pause, then lower slowly until your legs are straight."],
    cues: ["Hips stay down", "Full curl", "Control the lowering"],
    commonMistake: "Lifting the hips off the pad to finish the curl",
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
