import { describe, expect, it } from "vitest";
import type { CheckIn } from "./checkins";
import type { Health } from "./health";
import { draftReviewReply, reviewMinutes, reviewQueue } from "./reviewMode";

const health = (band: Health["band"], score: number, trainingScore = 0.5): Health => ({
  score, band, reasons: [],
  parts: [{ key: "training", label: "Training", score: trainingScore, weight: 40, note: "2 of 6 planned sessions in 14 days" }],
});
const checkIn = (p: Partial<CheckIn>): CheckIn => ({
  id: "c", submittedAt: "2026-11-15T09:00:00Z", weightKg: null, sleepHours: null, energy: null, mood: null, stress: null, hunger: null,
  training: null, nutrition: null, wins: "", struggles: "", note: "", coachReply: null, reviewedAt: null, ...p,
});

describe("review queue", () => {
  const q = reviewQueue([
    { id: "a", name: "Omar Tahir", health: health("good", 94), checkInsWaiting: 0, videosWaiting: 0 },
    { id: "b", name: "Lena Rossi", health: health("watch", 67), checkInsWaiting: 1, videosWaiting: 0 },
    { id: "c", name: "Sarah Mitchell", health: health("low", 27), checkInsWaiting: 0, videosWaiting: 0 },
    { id: "d", name: "James Kowalski", health: health("good", 80), checkInsWaiting: 0, videosWaiting: 2 },
    { id: "e", name: "Priya Sharma", health: health("good", 88), trend: -14, checkInsWaiting: 1, videosWaiting: 0 },
  ]);

  it("leaves out clients on track with nothing waiting", () => {
    expect(q.map((e) => e.id)).not.toContain("a");
  });

  it("puts the most urgent first", () => {
    expect(q.map((e) => e.name)).toEqual(["Priya Sharma", "Sarah Mitchell", "Lena Rossi", "James Kowalski"]);
  });

  it("explains why each client is there", () => {
    expect(q.find((e) => e.id === "e")?.why).toEqual(["Slipping", "Check-in to review"]);
    expect(q.find((e) => e.id === "d")?.why).toEqual(["Form video to review"]);
  });

  it("estimates the round in 5-minute steps", () => {
    expect(reviewMinutes(q)).toBe(15);
    expect(reviewMinutes([])).toBe(0);
  });
});

describe("draft reply", () => {
  it("uses the check-in's own numbers and words", () => {
    const text = draftReviewReply({
      name: "Priya Sharma", coach: "Kamal Amroche", health: health("good", 88, 0.9), reasons: ["check-in"],
      checkIn: checkIn({ weightKg: 62.3, sleepHours: 7.5, energy: 4, wins: "Hit 70 kg on trap bar", struggles: "Hip tight after RDLs." }),
      previous: checkIn({ weightKg: 62.6 }),
    });
    expect(text).toContain("Hi Priya,");
    expect(text).toContain("weight down 0.3 kg, 7.5 h sleep, energy 4/5");
    expect(text).toContain("Great to hear: Hit 70 kg on trap bar.");
    expect(text).toContain('On "Hip tight after RDLs"');
    expect(text).toContain("Training's on point");
    expect(text.endsWith("Speak soon, Kamal")).toBe(true);
  });

  it("reaches out kindly to a client who is slipping", () => {
    const text = draftReviewReply({ name: "Sarah Mitchell", health: health("low", 27), reasons: ["needs-you"] });
    expect(text).toContain("I can see 2 of 6 planned sessions in 14 days.");
    expect(text).toContain("What got in the way");
  });
});
