import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_SETS, ASSESSMENT_TESTS, CORRECTIVES, addCorrectives, assessmentFileProblem, assessmentPath, assessmentPercent, compareAssessments, correctivesFor, createDemoAssessmentStore,
  demoBody, emptyItem, fromAssessmentRow, answerForRow, postureMeasures, previousReviewed, retestDue, reviewMessage, sampleAssessments, sideGap, submitProblem, suggestFocus, suggestScore,
  type Assessment, type AssessmentRow,
} from "./assessments";
import { exerciseById } from "./library";
import { INITIAL_WORKOUT } from "./data/workout";

describe("posture measures", () => {
  it("finds a low right shoulder from the front", () => {
    const m = postureMeasures("front", demoBody("front", { shoulderDrop: 0.012 }), 0.75);
    const sh = m.find((x) => x.label === "Shoulder level")!;
    expect(sh.value).toBeGreaterThan(3);
    expect(sh.flag).toBe(true);
    expect(sh.note).toBe("Left shoulder higher");
    expect(m.find((x) => x.label === "Hip level")!.note).toBe("Level");
  });
  it("reads the person's own left from the back too", () => {
    const m = postureMeasures("back", demoBody("back", { shoulderDrop: 0.012 }), 0.75);
    expect(m[0]!.note).toBe("Left shoulder higher");
  });
  it("measures the head ahead of the shoulder side on", () => {
    const fwd = postureMeasures("side", demoBody("side", { headFwd: 0.04 }), 0.75).find((x) => x.label === "Head position")!;
    const ok = postureMeasures("side", demoBody("side", { headFwd: 0 }), 0.75).find((x) => x.label === "Head position")!;
    expect(fwd.value).toBeGreaterThan(10);
    expect(fwd.note).toMatch(/ahead/);
    expect(ok.value).toBeLessThan(2);
    expect(ok.note).toBe("Head over the shoulder");
  });
  it("gives nothing when the body can't be seen", () => {
    expect(postureMeasures("front", null, 1)).toEqual([]);
    expect(postureMeasures("front", Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 })), 1)).toEqual([]);
  });
});

describe("scores and focus", () => {
  it("suggests scores from answers, the worse side wins, pain is 0", () => {
    expect(suggestScore({ ...emptyItem("knee-to-wall"), answer: { left: 7, right: 11 } })).toBe(2);
    expect(suggestScore({ ...emptyItem("knee-to-wall"), answer: { left: 4, right: 11 } })).toBe(1);
    expect(suggestScore({ ...emptyItem("balance"), answer: { left: 41, right: 45 } })).toBe(3);
    expect(suggestScore({ ...emptyItem("toe-touch"), answer: { value: "Toes" } })).toBe(3);
    expect(suggestScore({ ...emptyItem("toe-touch"), answer: { value: "Toes" }, pain: true })).toBe(0);
    expect(suggestScore(emptyItem("overhead-squat"))).toBeNull();
    expect(suggestScore({ ...emptyItem("overhead-squat"), answer: { value: ["None of these"] } })).toBe(3);
    expect(suggestScore({ ...emptyItem("overhead-squat"), answer: { value: ["Heels lifted", "Knees moved in"] } })).toBe(1);
  });
  it("spots a gap between sides", () => {
    expect(sideGap({ ...emptyItem("balance"), answer: { left: 18, right: 41 } })).toBe("Left side 23 s behind");
    expect(sideGap({ ...emptyItem("balance"), answer: { left: 40, right: 41 } })).toBeNull();
  });
  it("focus comes from anything scored 2 or under, once each", () => {
    const [, before] = sampleAssessments();
    expect(suggestFocus(before!.items)).toContain("Ankle mobility");
    expect(new Set(suggestFocus(before!.items)).size).toBe(suggestFocus(before!.items).length);
  });
  it("every focus area has correctives that exist in the library", () => {
    const areas = new Set(ASSESSMENT_TESTS.map((t) => t.focus));
    for (const a of areas) expect(CORRECTIVES[a]?.length).toBeGreaterThan(0);
    for (const id of correctivesFor([...areas])) expect(exerciseById(id).id).toBe(id);
  });
});

describe("correctives into the programme", () => {
  it("puts them at the top as a warm-up, once", () => {
    const ids = correctivesFor(["Ankle mobility"]);
    const w = addCorrectives(INITIAL_WORKOUT, ids);
    expect(w.items.length).toBe(INITIAL_WORKOUT.items.length + ids.length);
    expect(w.items.slice(0, ids.length).map((i) => i.exerciseId)).toEqual(ids);
    expect(w.items[0]!.sets).toBe(2);
    expect(addCorrectives(w, ids).items.length).toBe(w.items.length);
  });
});

describe("sending and re-testing", () => {
  it("won't send until every photo, video and answer is in", () => {
    const a: Assessment = { ...sampleAssessments()[0]!, status: "requested" };
    expect(submitProblem(a)).toBeNull();
    const missing = { ...a, items: a.items.map((i) => (i.key === "balance" ? { ...i, answer: { left: 20 } } : i)) };
    expect(submitProblem(missing)).toMatch(/seconds held/);
    const noPhoto = { ...a, items: a.items.map((i) => (i.key === "posture-side" ? { ...i, media: null } : i)) };
    expect(submitProblem(noPhoto)).toMatch(/photo for standing posture, side/);
  });
  it("compares a re-test with the one before", () => {
    const [after, before] = sampleAssessments();
    const rows = compareAssessments(before!, after!);
    expect(rows[0]!.label).toBe("Score");
    expect(rows[0]!.better).toBe(true);
    const ankle = rows.find((r) => r.label === "Ankle, left")!;
    expect(ankle).toMatchObject({ before: "7 cm", after: "10 cm", better: true });
    expect(rows.find((r) => r.label === "Head position")!.better).toBe(true);
    expect(previousReviewed([after!, before!], after!)?.id).toBe(before!.id);
  });
  it("knows when the re-test is due", () => {
    const [, before] = sampleAssessments();
    expect(retestDue([before!])?.due).toBe(true);
    expect(retestDue([{ ...before!, retestWeeks: 0 }])).toBeNull();
    expect(retestDue(sampleAssessments())).toBeNull();
  });
  it("writes the client's message", () => {
    const [, before] = sampleAssessments();
    expect(assessmentPercent(before!.items)).toBe(63);
    expect(reviewMessage(before!, "Kamal")).toMatch(/^Kamal has reviewed your full start assessment: 15 out of 24\. What we'll work on: ankle mobility/);
  });
});

describe("rows and files", () => {
  it("round-trips answers and reviews through a row", () => {
    const [after] = sampleAssessments();
    const it0 = after!.items[0]!;
    const row: AssessmentRow = {
      id: "x", client_id: "c", title: "Re-test", tests: after!.tests, status: "submitted", summary: null, focus: null, retest_weeks: 8, created_at: "2026-11-15T00:00:00Z", submitted_at: null, reviewed_at: null,
      answers: { [it0.key]: answerForRow(it0) }, review: { [it0.key]: { note: "ok" } },
    };
    const a = fromAssessmentRow(row, new Map([[it0.media!.path, "https://signed"]]));
    expect(a.items).toHaveLength(after!.tests.length);
    expect(a.items[0]).toMatchObject({ score: it0.score, note: "ok", media: { url: "https://signed" } });
    expect(a.items[0]!.measures).toEqual(it0.measures);
    expect(a.items[1]!.media).toBeNull();
  });
  it("checks files and builds paths in the client's folder", () => {
    expect(assessmentFileProblem({ size: 10, type: "image/jpeg" }, "photo")).toBeNull();
    expect(assessmentFileProblem({ size: 10, type: "video/mp4" }, "photo")).toMatch(/photo/);
    expect(assessmentFileProblem({ size: 60 * 1024 * 1024, type: "video/mp4" }, "video")).toMatch(/50 MB/);
    expect(assessmentPath("c1", "a1", "posture-side", "image/jpeg")).toMatch(/^c1\/a1\/posture-side-.+\.jpg$/);
  });
  it("sets cover known tests", () => {
    for (const s of ASSESSMENT_SETS) expect(s.tests.every((k) => ASSESSMENT_TESTS.some((t) => t.key === k))).toBe(true);
  });
});

describe("demo store", () => {
  it("runs request, answer, submit and review", async () => {
    const s = createDemoAssessmentStore();
    await s.request({ title: "Posture only", tests: ["posture-front"], retestWeeks: 4 });
    const id = s.get().list[0]!.id;
    await expect(s.submit(id)).rejects.toThrow(/photo/);
    await s.saveAnswer(id, "posture-front", { points: null, aspect: null, measures: [], answer: null, pain: false }, new Blob(["x"], { type: "image/jpeg" }));
    await s.submit(id);
    expect(s.get().list[0]!.status).toBe("submitted");
    await s.review(id, { reviews: { "posture-front": { note: "Stand like this every day" } }, summary: "Nice", focus: [], done: true });
    expect(s.get().list[0]).toMatchObject({ status: "reviewed", summary: "Nice" });
  });
});
