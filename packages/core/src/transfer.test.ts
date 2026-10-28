import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { buildExportFiles, templateFiles, type ExportData } from "./exportData";
import { parseProgramText } from "./programText";
import {
  defaultChoices, describeClient, detectKind, exerciseNames, mergeClient, parseDate, parseDayIndex, parseKg, parseMode, parseRest,
  programFromParsed, readTables, suggestMatches, toImportRows,
} from "./transfer";

const table = (name: string, text: string) => ({ name, rows: parseCsv(text) });

describe("values", () => {
  it("reads UK, ISO, written and Excel dates", () => {
    expect(parseDate("2026-10-01")).toBe("2026-10-01");
    expect(parseDate("01/10/2026")).toBe("2026-10-01");
    expect(parseDate("10/25/2026")).toBe("2026-10-25");
    expect(parseDate("1 Oct 2026")).toBe("2026-10-01");
    expect(parseDate("October 1st, 2026")).toBe("2026-10-01");
    expect(parseDate("46296")).toBe("2026-10-01");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("soon")).toBeNull();
  });

  it("converts pounds and reads European decimals", () => {
    expect(parseKg("60")).toBe(60);
    expect(parseKg("62,5 kg")).toBe(62.5);
    expect(parseKg("135 lb")).toBe(61.2);
    expect(parseKg("135", true)).toBe(61.2);
    expect(parseKg("")).toBeNull();
  });

  it("reads days, rest and training modes", () => {
    expect(parseDayIndex("Wednesday")).toBe(2);
    expect(parseDayIndex("Day 2")).toBe(1);
    expect(parseDayIndex("")).toBeNull();
    expect(parseRest("90")).toBe(90);
    expect(parseRest("2 min")).toBe(120);
    expect(parseRest("1:30")).toBe(90);
    expect(parseMode("Face to face")).toBe("in_person");
    expect(parseMode("Hybrid")).toBe("hybrid");
    expect(parseMode("")).toBe("online");
  });

  it("tells tables apart by their columns", () => {
    expect(detectKind(["Athlete", "Exercise name", "Sets", "Reps"])).toBe("program");
    expect(detectKind(["Client", "Date", "Exercise", "Load (lb)", "Reps"])).toBe("history");
    expect(detectKind(["Client", "Date", "Body weight", "Mood"])).toBe("checkins");
    expect(detectKind(["Full name", "Email address", "Goal"])).toBe("clients");
    expect(detectKind(["Foo", "Bar"])).toBeNull();
  });
});

describe("readTables", () => {
  const bundle = readTables([
    table("clients.csv", "Name,Email,Goal,Mode\nPriya Shah,priya@example.com,Deadlift 100 kg,Online\nSam Lee,sam@example.com,,In person"),
    table("program.csv", "Client,Week,Day,Workout,Group,Exercise,Sets,Reps,Load (lb),Rest\npriya shah,1,Mon,Lower A,A,Back squats,4,6-8,135,2 min\nPriya Shah,1,Mon,Lower A,B1,RDL,3,10,,90\nPriya Shah,1,Thu,Upper A,,Press-ups,3,AMRAP,,60"),
    table("history.csv", "Client\tDate\tExercise\tSets\tReps\tWeight\nSam Lee\t20/10/2026\tLeg press\t3\t12\t140\nSam Lee\t20/10/2026\tPlank\t2\t45s\t\nSam Lee\tsoon\tPlank\t1\t30s\t"),
    table("checkins.csv", "Client,Date,Weight (kg),Energy,Mood,Sleep\nPriya Shah,2026-10-18,62.6,4,9,7.5"),
    table("notes.csv", "Foo,Bar\n1,2"),
  ]);
  const priya = bundle.clients.find((c) => c.name === "Priya Shah")!;
  const sam = bundle.clients.find((c) => c.name === "Sam Lee")!;

  it("groups every table by client, whatever the case of the name", () => {
    expect(bundle.clients.map((c) => c.name)).toEqual(["Priya Shah", "Sam Lee"]);
    expect(sam.mode).toBe("in_person");
    expect(describeClient(priya)).toBe("2 workouts · 1 check-in");
    expect(describeClient(sam)).toBe("1 session");
  });

  it("builds the program by week and day, converting pounds and rest", () => {
    const [lower, upper] = priya.program!.workouts;
    expect(lower).toMatchObject({ name: "Lower A", week: 1, dayIndex: 0 });
    expect(lower!.items[0]).toMatchObject({ group: "A", exercise: "Back squats", sets: 4, reps: "6-8", kg: 61.2, restSeconds: 120 });
    expect(upper).toMatchObject({ name: "Upper A", dayIndex: 3 });
    expect(upper!.items[0]).toMatchObject({ group: "A", reps: "AMRAP" });
  });

  it("expands a Sets count into separate sets and reads holds", () => {
    const [s] = sam.sessions;
    expect(s).toMatchObject({ date: "2026-10-20", workoutName: "Imported session" });
    expect(s!.sets.filter((x) => x.exercise === "Leg press")).toHaveLength(3);
    expect(s!.sets.find((x) => x.exercise === "Plank")).toMatchObject({ reps: null, seconds: 45 });
  });

  it("keeps scores in range and reports rows it left out", () => {
    expect(priya.checkIns[0]).toMatchObject({ weightKg: 62.6, energy: 4, mood: 5, sleepHours: 7.5 });
    expect(bundle.problems).toEqual([
      'history.csv row 4: date "soon" not recognised',
      expect.stringContaining("notes.csv: couldn't tell"),
    ]);
  });

  it("uses the chosen client for a table without a client column", () => {
    const b = readTables([table("p.csv", "Exercise,Sets,Reps\nPlank,3,30s")], { defaultClient: "Alex" });
    expect(b.clients[0]?.name).toBe("Alex");
  });

  it("adds a program read from a PDF to a client", () => {
    const program = programFromParsed(parseProgramText("Day 1\nGoblet squat 3x10\nPlank 3 x 30s"), "From PDF");
    const merged = mergeClient(bundle, { name: "sam lee", program });
    expect(merged.clients).toHaveLength(2);
    expect(merged.clients[1]?.program?.workouts[0]?.items.map((i) => i.exercise)).toEqual(["Goblet squat", "Plank"]);
    expect(merged.clients[1]?.sessions).toHaveLength(1);
  });
});

describe("toImportRows", () => {
  const bundle = readTables([
    table("program.csv", "Client,Program,Week,Day,Exercise,Sets,Reps,Weight\nPriya,Block 1,1,Monday,Back squat,4,8,60\nPriya,Block 1,2,Monday,Zumba,1,30,\nPriya,Block 1,1,Monday,Plank,3,40s,"),
    table("history.csv", "Client,Date,Exercise,Set,Weight,Reps,Session RPE,Minutes\nPriya,2026-10-20,Back squat,1,60,8,8,50\nPriya,2026-10-20,Back squat,2,60,7,,\nPriya,2026-10-20,Zumba,1,,10,,"),
    table("checkins.csv", "Client,Date,Weight,Mood\nPriya,2026-10-18,62.6,4"),
  ]);
  const names = exerciseNames(bundle);
  const choices = defaultChoices(suggestMatches(names));
  let n = 0;
  const ctx = { coachId: "coach", clientId: "client", now: "2026-10-28T12:00:00.000Z", newId: () => `id${++n}`, includeProgram: true };
  const rows = toImportRows(bundle.clients[0]!, choices, ctx);

  it("lists each exercise once and leaves out the ones with no match", () => {
    expect(names).toEqual(["Back squat", "Plank", "Zumba"]);
    expect(choices.zumba).toBeNull();
    expect(rows.skipped).toBe(2);
  });

  it("makes a published program with one workout per week and day", () => {
    expect(rows.programs).toEqual([{ id: "id1", coach_id: "coach", client_id: "client", name: "Block 1", weeks: 2 }]);
    expect(rows.program_versions[0]).toMatchObject({ program_id: "id1", version: 1, published_at: ctx.now });
    expect(rows.workouts.map((w) => [w.week, w.day_index])).toEqual([[1, 0], [2, 0]]);
    expect(rows.workout_items.map((i) => [i.position, i.exercise_id, i.load_kg])).toEqual([[0, 1, 60], [1, 14, null]]);
  });

  it("makes finished sessions with totals, marked as imported", () => {
    expect(rows.sessions).toHaveLength(1);
    expect(rows.sessions[0]).toMatchObject({ started_at: "2026-10-20T12:00:00.000Z", finished_at: "2026-10-20T12:50:00.000Z", session_rpe: 8, sets_completed: 2, volume_kg: 900, source: "import" });
    expect(rows.logged_sets.map((s) => s.set_index)).toEqual([0, 1]);
    expect(rows.check_ins[0]).toMatchObject({ client_id: "client", weight_kg: 62.6, mood: 4, source: "import" });
  });

  it("doesn't add a program for a client who already has one", () => {
    const again = toImportRows(bundle.clients[0]!, choices, { ...ctx, includeProgram: false });
    expect(again.programs).toEqual([]);
    expect(again.sessions).toHaveLength(1);
  });
});

describe("export", () => {
  const data: ExportData = {
    coachName: "Kamal",
    exportedAt: "2026-10-28T18:00:00.000Z",
    clients: [{
      name: "Priya Shah", email: "priya@example.com", goal: "Deadlift 100 kg", mode: "hybrid", status: "active", startedAt: "2026-03-02T10:00:00.000Z",
      program: { name: "Foundations", weeks: 8, workouts: [{ name: "Lower A", week: 1, dayIndex: 0, items: [{ group: "A", exerciseId: 1, sets: 4, reps: "6-8", kg: 60, rpe: 8, restSeconds: 120, notes: null }] }] },
      sessions: [{ startedAt: "2026-10-20T12:00:00.000Z", finishedAt: "2026-10-20T12:50:00.000Z", workoutName: "Lower A", rpe: 8, note: "Strong", sets: [{ exerciseId: 1, kg: 60, reps: 8, seconds: null, rpe: null }, { exerciseId: 1, kg: 60, reps: 7, seconds: null, rpe: null }] }],
      checkIns: [{ submittedAt: "2026-10-18T09:00:00.000Z", weightKg: 62.6, energy: 4, mood: 4, sleepHours: 7, note: "=1+1" }],
      messages: [{ at: "2026-10-20T13:05:00.000Z", from: "coach", body: "Great session" }],
    }],
  };
  const files = buildExportFiles(data);

  it("writes the transfer tables plus messages and a read-me", () => {
    expect(files.map((f) => f.name)).toEqual(["README.txt", "clients.csv", "program.csv", "history.csv", "checkins.csv", "messages.csv"]);
    expect(parseCsv(files.find((f) => f.name === "messages.csv")!.content)[1]).toEqual(["Priya Shah", "2026-10-20", "13:05", "Kamal", "Great session"]);
  });

  it("reads back in as the same client, program, sessions and check-ins", () => {
    const back = readTables(files.filter((f) => f.name.endsWith(".csv")).map((f) => table(f.name, f.content)));
    const [c] = back.clients;
    expect(back.clients).toHaveLength(1);
    expect(c).toMatchObject({ name: "Priya Shah", email: "priya@example.com", goal: "Deadlift 100 kg", mode: "hybrid" });
    expect(c!.program!.workouts[0]!.items[0]).toMatchObject({ exercise: "Barbell Back Squat", sets: 4, reps: "6-8", kg: 60, rpe: 8, restSeconds: 120 });
    expect(c!.sessions[0]).toMatchObject({ date: "2026-10-20", workoutName: "Lower A", minutes: 50, rpe: 8, note: "Strong" });
    expect(c!.sessions[0]!.sets).toHaveLength(2);
    expect(c!.checkIns[0]).toMatchObject({ weightKg: 62.6, note: "=1+1" });
    expect(back.problems).toEqual(["messages.csv: messages aren't imported. They stay in your export file."]);
    expect(defaultChoices(suggestMatches(exerciseNames(back)))["barbell back squat"]).toBe(1);
  });

  it("ships a template that imports cleanly", () => {
    const t = readTables(templateFiles().filter((f) => f.name.endsWith(".csv")).map((f) => table(f.name, f.content)));
    expect(t.problems).toEqual([]);
    expect(t.clients.map((c) => describeClient(c))).toEqual(["1 workout · 1 session · 1 check-in"]);
  });
});
