import { describe, expect, it } from "vitest";
import { AGREEMENT_STARTERS, agreementProblem, nameProblem, signingStatus, toSign, type Agreement, type Signature } from "./agreements";
import { classAvailability, classProblem, classRoster, demoJoin, demoLeave, myClassLine, type ClassSpot } from "./classes";
import { ANSWER_STARTERS, answerProblem, matchAnswers } from "./answers";
import { microStatus, microTotals, scaleMicros } from "./micros";
import { foodFromOff } from "./barcode";
import { fromFoodRow, toFoodRow } from "./lifestyle";

const ag = (over: Partial<Agreement> = {}): Agreement => ({ id: "a1", title: "Waiver", body: "x".repeat(30), required: true, version: 1, active: true, updatedAt: "2026-11-01", ...over });
const sig = (over: Partial<Signature> = {}): Signature => ({ id: "s", agreementId: "a1", clientId: "c1", version: 1, title: "Waiver", body: "x", typedName: "Priya Sharma", signedAt: "2026-11-02", ...over });

describe("agreements", () => {
  it("checks the wording", () => {
    expect(agreementProblem({ title: "", body: "x".repeat(30) })).toBe("Give it a title");
    expect(agreementProblem({ title: "Waiver", body: "short" })).toMatch(/Write out/);
    for (const s of AGREEMENT_STARTERS) expect(agreementProblem(s)).toBeNull();
  });
  it("asks to sign the current version only", () => {
    expect(toSign([ag()], [], "c1")).toHaveLength(1);
    expect(toSign([ag()], [sig()], "c1")).toHaveLength(0);
    expect(toSign([ag({ version: 2 })], [sig()], "c1")).toHaveLength(1);
    expect(toSign([ag({ active: false })], [], "c1")).toHaveLength(0);
    expect(toSign([ag({ id: "b", required: false, title: "A" }), ag()], [], "c1").map((a) => a.id)).toEqual(["a1", "b"]);
  });
  it("wants the client's own name typed", () => {
    expect(nameProblem("P", "Priya Sharma")).toMatch(/full name/);
    expect(nameProblem("Someone Else", "Priya Sharma")).toMatch(/as it is on your account/);
    expect(nameProblem("priya sharma", "Priya Sharma")).toBeNull();
    expect(nameProblem("Jo Bloggs", "")).toBeNull();
  });
  it("shows who has signed and who signed an older version", () => {
    const st = signingStatus(ag({ version: 2 }), [sig({ version: 1 }), sig({ clientId: "c2", version: 2 })], [{ id: "c1", name: "Priya" }, { id: "c2", name: "Omar" }]);
    expect(st.signed.map((s) => s.name)).toEqual(["Omar"]);
    expect(st.waiting).toEqual([{ id: "c1", name: "Priya", old: true }]);
  });
});

describe("classes", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  it("checks a new class", () => {
    const ok = { title: "Circuits", startsAt: "2026-11-21T07:00:00Z", minutes: 45, capacity: 10, place: "", note: "" };
    expect(classProblem(ok, now)).toBeNull();
    expect(classProblem({ ...ok, startsAt: "2026-11-19T07:00:00Z" }, now)).toMatch(/future/);
    expect(classProblem({ ...ok, capacity: 0 }, now)).toMatch(/Places/);
  });
  it("says how full a class is", () => {
    expect(classAvailability({ booked: 3, waiting: 0, capacity: 4, cancelled: false })).toBe("1 place left");
    expect(classAvailability({ booked: 4, waiting: 2, capacity: 4, cancelled: false })).toBe("Full · 2 waiting");
    expect(classAvailability({ booked: 4, waiting: 0, capacity: 4, cancelled: false })).toBe("Full · join the waitlist");
    expect(myClassLine({ myStatus: "waitlist", myPlace: 2, booked: 4, capacity: 4, cancelled: false }).line).toMatch(/number 2/);
    expect(myClassLine({ myStatus: null, myPlace: null, booked: 4, capacity: 4, cancelled: false }).action).toBe("wait");
  });
  it("keeps the queue fair in the demo", () => {
    let spots: ClassSpot[] = [];
    let r = demoJoin(spots, 1, "a", "Ana", "1"); spots = r.spots; expect(r.status).toBe("booked");
    r = demoJoin(spots, 1, "b", "Ben", "2"); spots = r.spots; expect(r.status).toBe("waitlist");
    r = demoJoin(spots, 1, "c", "Cy", "3"); spots = r.spots;
    spots = demoLeave(spots, 1, "a");
    expect(classRoster(spots).booked.map((s) => s.clientId)).toEqual(["b"]);
    expect(classRoster(spots).waiting.map((s) => s.clientId)).toEqual(["c"]);
  });
});

describe("quick answers", () => {
  const list = ANSWER_STARTERS.map((a, i) => ({ ...a, id: String(i) }));
  it("finds the coach's answer for a question in other words", () => {
    expect(matchAnswers("I missed my session yesterday", list)[0]!.question).toBe("What if I miss a session?");
    expect(matchAnswers("is it ok to train when sore?", list)[0]!.question).toBe("Can I train if I'm sore?");
    expect(matchAnswers("what weight should I lift, how heavy", list)[0]!.question).toBe("How heavy should I go?");
  });
  it("finds nothing for unrelated questions", () => {
    expect(matchAnswers("what's your favourite film", list)).toEqual([]);
    expect(matchAnswers("?", list)).toEqual([]);
  });
  it("checks an answer", () => {
    expect(answerProblem({ question: "Hi", answer: "Fine answer" })).toBe("Write the question");
    for (const a of ANSWER_STARTERS) expect(answerProblem(a)).toBeNull();
  });
});

describe("fibre, sugar and salt", () => {
  it("totals only foods that list them", () => {
    const t = microTotals([{ fibreG: 4, sugarG: 10, saltG: 0.5 }, {}, { fibreG: 2.5 }]);
    expect(t).toEqual({ fibreG: 6.5, sugarG: 10, saltG: 0.5, withData: 2, items: 3 });
    expect(microStatus("fibreG", 31)).toBe("good");
    expect(microStatus("fibreG", 12)).toBe("low");
    expect(microStatus("saltG", 7)).toBe("high");
    expect(scaleMicros({ fibreG: 3, saltG: 0.25 }, 2)).toEqual({ fibreG: 6, saltG: 0.5 });
  });
  it("reads them from a scanned pack, per serving", () => {
    const f = foodFromOff("5000000000001", { product_name: "Oat bar", serving_quantity: 50, nutriments: { "energy-kcal_100g": 400, fiber_100g: 8, sugars_100g: 20, salt_100g: 0.3 } })!;
    expect(f).toMatchObject({ fibre: 4, sugar: 10, salt: 0.15 });
    const none = foodFromOff("5000000000002", { product_name: "Water", nutriments: { "energy-kcal_100g": 0 } })!;
    expect(none.fibre).toBeUndefined();
  });
  it("saves them only when known", () => {
    const base = { id: "f", day: "2026-11-20", meal: "lunch" as const, name: "Oats", kcal: 380, proteinG: 13, carbsG: 60, fatG: 7 };
    expect("fibre_g" in toFoodRow(base, "c")).toBe(false);
    const row = toFoodRow({ ...base, fibreG: 10 }, "c");
    expect(row.fibre_g).toBe(10);
    expect(fromFoodRow({ ...row, sugar_g: null }).fibreG).toBe(10);
    expect(fromFoodRow({ ...row, sugar_g: null }).sugarG).toBeUndefined();
  });
});
