import { describe, expect, it } from "vitest";
import { commentLines, commentMessage, commentProblem, commentsByExercise, readComment, voiceCommentMessage, type ExerciseComment } from "./exerciseComments";
import { summaryMessage } from "./summary";

describe("exercise comments", () => {
  it("tags the message with the exercise and set, and reads it back", () => {
    const m = commentMessage({ exercise: "Back Squat", set: 3, text: " Left knee clicked " });
    expect(m).toBe("💬 Back Squat · set 3: Left knee clicked");
    expect(readComment(m)).toEqual({ exercise: "Back Squat", set: 3, body: "Left knee clicked", voice: false });
    expect(readComment(commentMessage({ exercise: "Plank", set: null, text: "Easy: could go longer" }))).toEqual({ exercise: "Plank", set: null, body: "Easy: could go longer", voice: false });
  });

  it("marks voice notes", () => {
    const m = voiceCommentMessage({ exercise: "Romanian Deadlift", set: 2 });
    expect(readComment(m)).toEqual({ exercise: "Romanian Deadlift", set: 2, body: "", voice: true });
  });

  it("leaves ordinary messages alone", () => {
    expect(readComment("On Monday: I'll be late")).toBeNull();
    expect(readComment("✅ Finished Lower A")).toBeNull();
  });

  it("checks length", () => {
    expect(commentProblem(" ")).toMatch(/few words/);
    expect(commentProblem("x".repeat(301))).toMatch(/300/);
    expect(commentProblem("Too heavy")).toBeNull();
  });

  it("lists comments in the session message and groups them", () => {
    const list: ExerciseComment[] = [
      { exerciseId: 1, exercise: "Back Squat", set: 3, text: "Knee clicked" },
      { exerciseId: 6, exercise: "Barbell Row", set: null, text: "", voice: true },
      { exerciseId: 1, exercise: "Back Squat", set: 4, text: "Better" },
    ];
    expect(commentLines(list)).toEqual(['💬 Back Squat (set 3): "Knee clicked"', "💬 Barbell Row: voice note", '💬 Back Squat (set 4): "Better"']);
    expect(commentsByExercise(list).map((g) => [g.exercise, g.comments.length])).toEqual([["Back Squat", 2], ["Barbell Row", 1]]);
    const msg = summaryMessage({ workoutName: "Lower A", sets: 10, volumeKg: 2000, minutes: 50, rpe: 8, prs: 0, summary: { muscles: [], bests: [], vsLast: null, fun: "", comments: list } });
    expect(msg).toContain('💬 Back Squat (set 3): "Knee clicked"');
  });
});
