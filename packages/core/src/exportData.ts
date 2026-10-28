/* Everything a coach takes with them: the transfer tables as CSV (which import reads back),
   their messages, and a printable report that the browser saves as a PDF. */

import { toCsv } from "./csv";
import { EXERCISES } from "./data/exercises";
import type { DbTrainingMode } from "./transfer";

export interface ExportItem {
  group: string;
  exerciseId: number;
  sets: number;
  reps: string;
  kg: number | null;
  rpe: number | null;
  restSeconds: number;
  notes: string | null;
}

export interface ExportWorkout {
  name: string;
  week: number;
  dayIndex: number;
  items: ExportItem[];
}

export interface ExportSession {
  startedAt: string;
  finishedAt: string;
  workoutName: string;
  rpe: number | null;
  note: string | null;
  sets: { exerciseId: number; kg: number | null; reps: number | null; seconds: number | null; rpe: number | null }[];
}

export interface ExportClient {
  name: string;
  email: string;
  goal: string;
  mode: DbTrainingMode;
  /** "active", "paused", or "invited" for an imported client who hasn't joined yet. */
  status: string;
  startedAt: string;
  program: { name: string; weeks: number; workouts: ExportWorkout[] } | null;
  sessions: ExportSession[];
  checkIns: { submittedAt: string; weightKg: number | null; energy: number | null; mood: number | null; sleepHours: number | null; note: string | null }[];
  messages: { at: string; from: "coach" | "client"; body: string }[];
}

export interface ExportData {
  coachName: string;
  exportedAt: string;
  clients: ExportClient[];
}

export const TEMPLATE_HEADERS = {
  clients: ["Client", "Email", "Goal", "Training mode", "Start date", "Status", "Notes"],
  program: ["Client", "Program", "Week", "Day", "Workout", "Group", "Exercise", "Sets", "Reps", "Weight (kg)", "RPE", "Rest (s)", "Notes"],
  history: ["Client", "Date", "Workout", "Exercise", "Set", "Weight (kg)", "Reps", "Seconds", "RPE", "Session RPE", "Minutes", "Notes"],
  checkins: ["Client", "Date", "Weight (kg)", "Energy (1-5)", "Mood (1-5)", "Sleep (h)", "Notes"],
  messages: ["Client", "Date", "Time", "From", "Message"],
} as const;

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MODE_NAMES: Record<DbTrainingMode, string> = { online: "Online", hybrid: "Hybrid", in_person: "In person" };

const names = new Map(EXERCISES.map((e) => [e.id, e.name]));
export const exerciseName = (id: number): string => names.get(id) ?? `Exercise #${id}`;

const day = (iso: string) => iso.slice(0, 10);
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const minutesBetween = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 60000));

export interface ExportFile {
  name: string;
  content: string;
}

/** The CSV files plus a short read-me, ready to zip. */
export function buildExportFiles(data: ExportData): ExportFile[] {
  const clients: (string | number | null)[][] = [[...TEMPLATE_HEADERS.clients], ...data.clients.map((c) => [c.name, c.email, c.goal, MODE_NAMES[c.mode], day(c.startedAt), c.status, ""])];
  const program: (string | number | null)[][] = [[...TEMPLATE_HEADERS.program]];
  const history: (string | number | null)[][] = [[...TEMPLATE_HEADERS.history]];
  const checkins: (string | number | null)[][] = [[...TEMPLATE_HEADERS.checkins]];
  const messages: (string | number | null)[][] = [[...TEMPLATE_HEADERS.messages]];
  for (const c of data.clients) {
    for (const w of c.program?.workouts ?? []) {
      for (const it of w.items) {
        program.push([c.name, c.program!.name, w.week, DAY_NAMES[w.dayIndex] ?? "", w.name, it.group, exerciseName(it.exerciseId), it.sets, it.reps, it.kg, it.rpe, it.restSeconds, it.notes]);
      }
    }
    for (const s of c.sessions) {
      const count = new Map<number, number>();
      s.sets.forEach((x, i) => {
        const n = (count.get(x.exerciseId) ?? 0) + 1;
        count.set(x.exerciseId, n);
        history.push([c.name, day(s.startedAt), s.workoutName, exerciseName(x.exerciseId), n, x.kg, x.reps, x.seconds, x.rpe, i === 0 ? s.rpe : null, i === 0 ? minutesBetween(s.startedAt, s.finishedAt) : null, i === 0 ? s.note : null]);
      });
    }
    for (const k of c.checkIns) checkins.push([c.name, day(k.submittedAt), k.weightKg, k.energy, k.mood, k.sleepHours, k.note]);
    for (const m of c.messages) messages.push([c.name, day(m.at), time(m.at), m.from === "coach" ? data.coachName : c.name, m.body]);
  }
  return [
    { name: "README.txt", content: readme(data) },
    { name: "clients.csv", content: toCsv(clients) },
    { name: "program.csv", content: toCsv(program) },
    { name: "history.csv", content: toCsv(history) },
    { name: "checkins.csv", content: toCsv(checkins) },
    { name: "messages.csv", content: toCsv(messages) },
  ];
}

const readme = (data: ExportData) =>
  [
    `APEX Coaching OS export for ${data.coachName}`,
    `Exported ${data.exportedAt.slice(0, 16).replace("T", " ")} UTC · ${data.clients.length} client${data.clients.length === 1 ? "" : "s"}`,
    "",
    "clients.csv    one row per client",
    "program.csv    each client's current program, one row per exercise",
    "history.csv    every logged set, one row per set",
    "checkins.csv   weekly check-ins",
    "messages.csv   your message threads",
    "",
    "Open any file in Google Sheets (File > Import), Excel or Numbers.",
    "Weights are in kg. Dates are YYYY-MM-DD. The same files can be imported back into APEX.",
    "",
  ].join("\r\n");

/** Blank tables with one example row each, so a coach can see the format before filling it in. */
export function templateFiles(): ExportFile[] {
  return [
    { name: "README.txt", content: ["APEX import template", "", "Fill in any of these tables (you don't need all four), then import them in APEX: Clients > Import and export.", "Copy the cells straight out of Google Sheets, or save each sheet as CSV. Column names can be in any order.", "Weights in kg unless the column says lb. Dates as 28/10/2026 or 2026-10-28.", ""].join("\r\n") },
    { name: "clients.csv", content: toCsv([[...TEMPLATE_HEADERS.clients], ["Priya Shah", "priya@example.com", "Lose 5 kg and deadlift 100 kg", "Online", "2026-03-02", "active", "Left hip tight after long runs"]]) },
    { name: "program.csv", content: toCsv([[...TEMPLATE_HEADERS.program], ["Priya Shah", "Strength block", 1, "Monday", "Lower A", "A", "Back squat", 4, "6-8", 60, 8, 120, ""], ["Priya Shah", "Strength block", 1, "Monday", "Lower A", "B1", "Romanian deadlift", 3, "10", 50, 7, 0, "Superset with B2"], ["Priya Shah", "Strength block", 1, "Monday", "Lower A", "B2", "Plank", 3, "40s", "", "", 60, ""]]) },
    { name: "history.csv", content: toCsv([[...TEMPLATE_HEADERS.history], ["Priya Shah", "2026-10-20", "Lower A", "Back squat", 1, 60, 8, "", 7, 8, 55, "Felt strong"], ["Priya Shah", "2026-10-20", "Lower A", "Back squat", 2, 60, 7, "", 8, "", "", ""]]) },
    { name: "checkins.csv", content: toCsv([[...TEMPLATE_HEADERS.checkins], ["Priya Shah", "2026-10-18", 62.6, 4, 4, 7, "Hip a little tight after RDLs"]]) },
  ];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const n = (v: number | null | undefined, unit = "") => (v == null ? "–" : `${Number(v)}${unit}`);

/** A clean printable report of every client. The browser's print dialog saves it as a PDF. */
export function buildReportHtml(data: ExportData): string {
  const sections = data.clients.map((c) => {
    const program = c.program
      ? c.program.workouts.map((w) => `
        <h4>Week ${w.week} · ${esc(DAY_NAMES[w.dayIndex] ?? "")} · ${esc(w.name)}</h4>
        <table><thead><tr><th></th><th>Exercise</th><th>Sets × reps</th><th>kg</th><th>RPE</th><th>Rest</th></tr></thead><tbody>
        ${w.items.map((it) => `<tr><td>${esc(it.group)}</td><td>${esc(exerciseName(it.exerciseId))}</td><td>${it.sets} × ${esc(it.reps)}</td><td>${n(it.kg)}</td><td>${n(it.rpe)}</td><td>${it.restSeconds} s</td></tr>`).join("")}
        </tbody></table>`).join("")
      : `<p class="muted">No program.</p>`;
    const recent = [...c.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 12);
    const sessions = recent.length
      ? `<table><thead><tr><th>Date</th><th>Workout</th><th>Sets</th><th>Volume</th><th>RPE</th></tr></thead><tbody>
        ${recent.map((s) => `<tr><td>${fmtDate(s.startedAt)}</td><td>${esc(s.workoutName)}</td><td>${s.sets.length}</td><td>${Math.round(s.sets.reduce((t, x) => t + (x.kg ?? 0) * (x.reps ?? 0), 0))} kg</td><td>${n(s.rpe)}</td></tr>`).join("")}
        </tbody></table>${c.sessions.length > recent.length ? `<p class="muted">Latest ${recent.length} of ${c.sessions.length} sessions. Every set is in history.csv.</p>` : ""}`
      : `<p class="muted">No sessions logged.</p>`;
    const checkIns = c.checkIns.length
      ? `<table><thead><tr><th>Date</th><th>Weight</th><th>Energy</th><th>Mood</th><th>Sleep</th><th>Note</th></tr></thead><tbody>
        ${[...c.checkIns].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 12).map((k) => `<tr><td>${fmtDate(k.submittedAt)}</td><td>${n(k.weightKg, " kg")}</td><td>${n(k.energy, "/5")}</td><td>${n(k.mood, "/5")}</td><td>${n(k.sleepHours, " h")}</td><td>${esc(k.note ?? "")}</td></tr>`).join("")}
        </tbody></table>`
      : `<p class="muted">No check-ins.</p>`;
    return `
    <section>
      <div class="eyebrow">${esc(MODE_NAMES[c.mode])} · since ${fmtDate(c.startedAt)}${c.status === "invited" ? " · invited, not joined yet" : ""}</div>
      <h2>${esc(c.name)}</h2>
      ${c.goal ? `<p><b>Goal:</b> ${esc(c.goal)}</p>` : ""}
      <h3>${c.program ? esc(c.program.name) : "Program"}</h3>${program}
      <h3>Recent sessions</h3>${sessions}
      <h3>Check-ins</h3>${checkIns}
    </section>`;
  });
  // Colours are the Athletic Tech light-theme tokens.
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>APEX client report · ${esc(data.coachName)}</title>
<style>
  body{font:13px/1.45 Archivo,system-ui,sans-serif;color:#0B1324;margin:32px;background:#FFFFFF}
  header{border-bottom:3px solid #E85A0C;padding-bottom:12px;margin-bottom:8px}
  h1{font-size:24px;margin:0} h2{font-size:20px;margin:2px 0 6px} h3{font-size:14px;margin:18px 0 6px;color:#1D4ED8} h4{font-size:12px;margin:12px 0 4px;color:#4A5670}
  .eyebrow{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7A869C}
  .muted{color:#7A869C;margin:4px 0}
  section{padding:18px 0;border-bottom:1px solid #DCE2EC;break-inside:avoid-page}
  section+section{break-before:page}
  table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
  th,td{text-align:left;padding:4px 8px 4px 0;border-bottom:1px solid #DCE2EC;vertical-align:top}
  th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#7A869C}
  @media print{body{margin:0}}
</style></head><body>
<header><div class="eyebrow">APEX Coaching OS · client report</div><h1>${esc(data.coachName)}</h1><div class="muted">${data.clients.length} client${data.clients.length === 1 ? "" : "s"} · exported ${fmtDate(data.exportedAt)}</div></header>
${sections.join("") || `<p class="muted">No clients yet.</p>`}
</body></html>`;
}
