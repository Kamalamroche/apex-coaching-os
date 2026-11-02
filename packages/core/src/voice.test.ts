import { describe, expect, it } from "vitest";
import { parseProgramText } from "./programText";
import { numberWordsToDigits, spokenToProgramText } from "./voice";

describe("number words", () => {
  it("turns spoken numbers into digits", () => {
    expect(numberWordsToDigits("four by six at eighty")).toBe("4 by 6 at 80");
    expect(numberWordsToDigits("one hundred and twenty two point five kilos")).toBe("122.5 kilos");
    expect(numberWordsToDigits("rest ninety seconds")).toBe("rest 90 seconds");
    expect(numberWordsToDigits("sixty two point five")).toBe("62.5");
    expect(numberWordsToDigits("plank three sets of forty seconds")).toBe("plank 3 sets of 40 seconds");
  });
});

describe("voice to workout", () => {
  const spoken = "Back squat four by six at eighty kilos RPE eight, then Romanian deadlift three sets of ten at sixty, and then plank three by forty seconds";

  it("writes one line per exercise", () => {
    expect(spokenToProgramText(spoken)).toBe("Back squat 4 x 6 @ 80 kg RPE 8\nRomanian deadlift 3 sets of 10 @ 60\nplank 3 x 40s");
  });

  it("reads back as a program the importer understands", () => {
    const items = parseProgramText(spokenToProgramText(spoken)).days[0]?.items ?? [];
    expect(items.map((i) => [i.match?.exercise.name, i.sets, i.reps, i.kg])).toEqual([
      ["Barbell Back Squat", 4, "6", 80],
      ["Romanian Deadlift", 3, "10", 60],
      ["Plank", 3, "40s", 0],
    ]);
  });
});
