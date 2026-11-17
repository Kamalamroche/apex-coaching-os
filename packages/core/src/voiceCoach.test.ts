import { describe, expect, it } from "vitest";
import { introLine, parseVoiceCommand, restStartLine, restTickLine, spokenTarget, spokenTime, wordsToDigits } from "./voiceCoach";

describe("voice commands", () => {
  it("reads spoken numbers", () => {
    expect(wordsToDigits("done eight reps")).toBe("done 8 reps");
    expect(wordsToDigits("twenty five kilos")).toBe("25 kilos");
    expect(wordsToDigits("one hundred and ten")).toBe("110");
    expect(wordsToDigits("go to the next")).toBe("go to the next");
  });

  it("understands the set being done, with reps and weight", () => {
    expect(parseVoiceCommand("Done")).toEqual({ kind: "done" });
    expect(parseVoiceCommand("done 8 reps")).toEqual({ kind: "done", reps: 8 });
    expect(parseVoiceCommand("I did ten reps at sixty kilos")).toEqual({ kind: "done", reps: 10, kg: 60 });
    expect(parseVoiceCommand("finished twelve")).toEqual({ kind: "done", reps: 12 });
    expect(parseVoiceCommand("done 5 at 102.5")).toEqual({ kind: "done", reps: 5, kg: 102.5 });
  });

  it("controls the rest", () => {
    expect(parseVoiceCommand("rest 30 more")).toEqual({ kind: "restMore", seconds: 30 });
    expect(parseVoiceCommand("add one minute")).toEqual({ kind: "restMore", seconds: 60 });
    expect(parseVoiceCommand("give me 45 seconds more")).toEqual({ kind: "restMore", seconds: 45 });
    expect(parseVoiceCommand("more rest")).toEqual({ kind: "restMore", seconds: 30 });
    expect(parseVoiceCommand("skip rest")).toEqual({ kind: "skipRest" });
    expect(parseVoiceCommand("I'm ready")).toEqual({ kind: "skipRest" });
  });

  it("moves around the workout", () => {
    expect(parseVoiceCommand("next exercise")).toEqual({ kind: "next" });
    expect(parseVoiceCommand("go back")).toEqual({ kind: "back" });
    expect(parseVoiceCommand("say that again")).toEqual({ kind: "repeat" });
    expect(parseVoiceCommand("any tips")).toEqual({ kind: "cues" });
    expect(parseVoiceCommand("start")).toEqual({ kind: "start" });
    expect(parseVoiceCommand("finish workout")).toEqual({ kind: "finish" });
    expect(parseVoiceCommand("stop listening")).toEqual({ kind: "stop" });
  });

  it("ignores chatter", () => {
    expect(parseVoiceCommand("this music is loud")).toBeNull();
    expect(parseVoiceCommand("")).toBeNull();
  });
});

describe("coach voice", () => {
  it("says times and targets naturally", () => {
    expect(spokenTime(90)).toBe("1 minute 30");
    expect(spokenTime(45)).toBe("45 seconds");
    expect(spokenTime(120)).toBe("2 minutes");
    expect(spokenTarget("5")).toBe("5 reps");
    expect(spokenTarget("8-10")).toBe("8 to 10 reps");
    expect(spokenTarget("40s")).toBe("40 seconds");
    expect(spokenTarget("200m")).toBe("200 metres");
  });

  it("introduces a set and the rest", () => {
    expect(introLine({ exercise: "Back Squat", set: 1, sets: 3, reps: "5", load: "100 kilos" })).toBe("Back Squat. Set 1 of 3: 5 reps at 100 kilos. Say done when you finish.");
    expect(introLine({ exercise: "Plank", set: 2, sets: 3, reps: "40s", load: null }, "Squeeze glutes")).toBe("Plank. Set 2 of 3: 40 seconds. Coach says: Squeeze glutes Say start when you're ready.");
    expect(restStartLine(90, { exercise: "Back Squat", set: 2, sets: 3, reps: "5", load: "100 kilos" })).toBe("Rest 1 minute 30. Next: Back Squat, 5 reps at 100 kilos.");
    expect(restTickLine(10, 90)).toBe("10 seconds. Get ready.");
    expect(restTickLine(30, 60)).toBeNull();
    expect(restTickLine(0, 60)).toBe("Go.");
  });
});
