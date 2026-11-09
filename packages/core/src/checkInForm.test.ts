import { describe, expect, it } from "vitest";
import { MAX_QUESTIONS, SAMPLE_QUESTIONS, answerText, answersFor, cleanQuestions, newQuestion, questionsProblem, readAnswers, readQuestions } from "./checkInForm";

describe("custom check-in questions", () => {
  it("drops blanks and tidies spaces", () => {
    expect(cleanQuestions([newQuestion("  How   was work? ", "text", "a"), newQuestion("   ", "scale", "b")])).toEqual([{ id: "a", text: "How was work?", kind: "text" }]);
  });
  it("catches too many, too long and twice", () => {
    expect(questionsProblem(SAMPLE_QUESTIONS)).toBeNull();
    expect(questionsProblem(Array.from({ length: MAX_QUESTIONS + 1 }, (_, i) => newQuestion(`Q${i}`)))).toMatch(/Up to/);
    expect(questionsProblem([newQuestion("x".repeat(201))])).toMatch(/under/);
    expect(questionsProblem([newQuestion("Sleep ok?"), newQuestion("sleep OK?")])).toMatch(/twice/);
  });
  it("keeps only real answers, with the question as asked", () => {
    const a = answersFor(SAMPLE_QUESTIONS, { "q-steps": false, "q-confidence": 4, "q-change": "  " });
    expect(a).toEqual([
      { id: "q-steps", question: "Did you hit your step goal most days?", kind: "yesno", value: false },
      { id: "q-confidence", question: "How confident do you feel about next week?", kind: "scale", value: 4 },
    ]);
    expect(answersFor(SAMPLE_QUESTIONS, { "q-confidence": 9 })).toEqual([]);
  });
  it("reads answers out loud for the coach", () => {
    expect(answerText({ id: "a", question: "", kind: "yesno", value: true })).toBe("Yes");
    expect(answerText({ id: "a", question: "", kind: "scale", value: 3 })).toBe("3 out of 5");
  });
  it("survives bad rows", () => {
    expect(readAnswers(null)).toEqual([]);
    expect(readAnswers([{ question: "Q", kind: "text", value: "fine" }, { kind: "nope" }, 3])).toHaveLength(1);
    expect(readQuestions([{ id: "a", text: "Q", kind: "scale" }, { id: 1 }])).toHaveLength(1);
  });
});
