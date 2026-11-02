import {
  pendingToExport, toImportRows, type ExerciseChoices, type ExportClient, type ExportData, type ImportBundle, type ImportClient, type ImportRows,
} from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LiveClient } from "./coach";

/** True when the client-import SQL hasn't been run on this database yet. */
export const isMissingImportSchema = (e: unknown): boolean => {
  const code = (e as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST205" || code === "42703" || code === "PGRST204";
};

export const IMPORT_SQL_NOTICE = "Importing needs a one-off database update. Ask your admin to run the client-import SQL, then try again.";

interface Stored {
  client: ImportClient;
  choices: ExerciseChoices;
}

export interface ImportResult {
  name: string;
  /** "added" went straight onto an existing client; "invited" waits for them to accept the link. */
  status: "added" | "invited" | "failed";
  link?: string;
  /** Exercises left out because no match was chosen. */
  skipped: number;
  /** For an existing client who already had a program: it was kept and the imported one left out. */
  keptProgram?: boolean;
  error?: string;
}

const CHUNK = 500;
async function insertAll(db: SupabaseClient, table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from(table).insert(rows.slice(i, i + CHUNK));
    if (error) throw error;
  }
}

/** Parents before children, so every reference exists when its row goes in. */
async function insertRows(db: SupabaseClient, rows: ImportRows) {
  await insertAll(db, "programs", rows.programs);
  await insertAll(db, "program_versions", rows.program_versions);
  await insertAll(db, "workouts", rows.workouts);
  await insertAll(db, "workout_items", rows.workout_items);
  await insertAll(db, "sessions", rows.sessions);
  await insertAll(db, "logged_sets", rows.logged_sets);
  await insertAll(db, "check_ins", rows.check_ins);
}

async function hasProgram(db: SupabaseClient, clientId: string): Promise<boolean> {
  const { count, error } = await db.from("programs").select("id", { count: "exact", head: true }).eq("client_id", clientId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Writes one client's imported data into the normal tables. Returns how many exercises were left out. */
async function applyTo(db: SupabaseClient, coachId: string, clientId: string, client: ImportClient, choices: ExerciseChoices) {
  const includeProgram = !!client.program && !(await hasProgram(db, clientId));
  const rows = toImportRows(client, choices, { coachId, clientId, now: new Date().toISOString(), newId: () => crypto.randomUUID(), includeProgram });
  await insertRows(db, rows);
  return { skipped: rows.skipped, keptProgram: !!client.program && !includeProgram };
}

/** Only the choices for exercises this client uses, so each stored import stays small. */
function choicesFor(client: ImportClient, all: ExerciseChoices): ExerciseChoices {
  const out: ExerciseChoices = {};
  const take = (n: string) => { const k = n.trim().toLowerCase(); if (k in all) out[k] = all[k] ?? null; };
  client.program?.workouts.forEach((w) => w.items.forEach((i) => take(i.exercise)));
  client.sessions.forEach((s) => s.sets.forEach((x) => take(x.exercise)));
  return out;
}

/**
 * Imports every client in the bundle. A name that matches one of the coach's clients gets the
 * data straight away; anyone else gets an invite link and their data waits until they join.
 */
export async function importBundle(db: SupabaseClient, coachId: string, bundle: ImportBundle, choices: ExerciseChoices, existing: LiveClient[]): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  for (const client of bundle.clients) {
    const mine = choicesFor(client, choices);
    const match = existing.find((c) => c.name.trim().toLowerCase() === client.name.trim().toLowerCase());
    try {
      if (match) {
        const r = await applyTo(db, coachId, match.id, client, mine);
        results.push({ name: client.name, status: "added", ...r });
        continue;
      }
      const { data: invite, error: e1 } = await db.from("invites").insert({ coach_id: coachId }).select("token").single();
      if (e1) throw e1;
      const stored: Stored = { client, choices: mine };
      const { error: e2 } = await db.from("imported_clients").insert({
        coach_id: coachId, full_name: client.name.slice(0, 200), email: client.email || null, goal: client.goal || null, mode: client.mode,
        data: stored, invite_token: invite.token,
      });
      if (e2) {
        await db.from("invites").delete().eq("token", invite.token);
        throw e2;
      }
      const skipped = Object.values(mine).filter((v) => v === null).length;
      results.push({ name: client.name, status: "invited", link: `${location.origin}/client/?invite=${invite.token}`, skipped });
    } catch (e) {
      if (isMissingImportSchema(e)) throw new Error(IMPORT_SQL_NOTICE);
      results.push({ name: client.name, status: "failed", skipped: 0, error: e instanceof Error ? e.message : String((e as { message?: string }).message ?? e) });
    }
  }
  return results;
}

export interface PendingImport {
  id: string;
  name: string;
  link: string | null;
  createdAt: string;
}

/** Imported clients who haven't accepted their invite yet. Empty before the SQL has run. */
export async function listPendingImports(db: SupabaseClient, coachId: string): Promise<PendingImport[]> {
  const { data, error } = await db.from("imported_clients").select("id, full_name, invite_token, created_at").eq("coach_id", coachId).is("client_id", null).order("created_at", { ascending: false });
  if (error) {
    if (isMissingImportSchema(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => ({ id: r.id as string, name: r.full_name as string, link: r.invite_token ? `${location.origin}/client/?invite=${r.invite_token}` : null, createdAt: r.created_at as string }));
}

/** Brings in the data of imported clients who have joined since last time. Returns their names. */
export async function applyJoinedImports(db: SupabaseClient, coachId: string): Promise<string[]> {
  const { data, error } = await db.from("imported_clients").select("id, full_name, client_id, data").eq("coach_id", coachId).not("client_id", "is", null).is("applied_at", null);
  if (error) {
    if (isMissingImportSchema(error)) return [];
    throw error;
  }
  const done: string[] = [];
  for (const row of data ?? []) {
    // Claim the row first so two open tabs can't both write the same history.
    const { data: claimed, error: cErr } = await db.from("imported_clients").update({ applied_at: new Date().toISOString() }).eq("id", row.id).is("applied_at", null).select("id");
    if (cErr) throw cErr;
    if (!claimed?.length) continue;
    const stored = row.data as Stored;
    try {
      await applyTo(db, coachId, row.client_id as string, stored.client, stored.choices);
      done.push(row.full_name as string);
    } catch (e) {
      await db.from("imported_clients").update({ applied_at: null }).eq("id", row.id);
      throw e;
    }
  }
  return done;
}

/* ───────────── export ───────────── */

const PAGE = 1000;
/** Supabase returns at most 1000 rows per request, so page through everything. */
async function all<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

const inChunks = async <T,>(ids: string[], fn: (chunk: string[]) => Promise<T[]>): Promise<T[]> => {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) out.push(...(await fn(ids.slice(i, i + 200))));
  return out;
};

interface ProgramRow { id: string; client_id: string; name: string; weeks: number; created_at: string }
interface WorkoutRow { id: string; program_version_id: string; name: string; week: number; day_index: number }
interface ItemRow { workout_id: string; position: number; group_label: string; exercise_id: number; sets: number; reps: string; load_kg: number | null; target_rpe: number | null; rest_seconds: number; notes: string | null }
interface SessionRow { id: string; client_id: string; started_at: string; finished_at: string; session_rpe: number | null; note: string | null; workouts: { name: string } | null }
interface SetRow { session_id: string; exercise_id: number; set_index: number; load_kg: number | null; reps: number | null; seconds: number | null; rpe: number | null }
interface CheckInRow { client_id: string; submitted_at: string; weight_kg: number | null; energy: number | null; mood: number | null; sleep_hours: number | null; note: string | null }
interface MessageRow { client_id: string; sender_id: string; body: string; created_at: string }

const num = (v: number | string | null) => (v == null ? null : Number(v));

/** Everything the coach has in APEX: clients, current programs, every logged set, check-ins, messages and imports still waiting. */
export async function loadExportData(db: SupabaseClient, coachId: string, coachName: string): Promise<ExportData> {
  const { data: links, error } = await db.from("coach_clients").select("client_id, status, mode, goal, started_at, profiles!coach_clients_client_id_fkey(full_name)").eq("coach_id", coachId).order("started_at");
  if (error) throw error;
  const ids = (links ?? []).map((l) => l.client_id as string);

  const programs = await inChunks(ids, (c) => all<ProgramRow>((f, t) => db.from("programs").select("id, client_id, name, weeks, created_at").eq("coach_id", coachId).in("client_id", c).order("created_at", { ascending: false }).range(f, t)));
  const latestProgram = new Map<string, ProgramRow>();
  for (const p of programs) if (!latestProgram.has(p.client_id)) latestProgram.set(p.client_id, p);
  const programIds = [...latestProgram.values()].map((p) => p.id);
  const versions = await inChunks(programIds, (c) => all<{ id: string; program_id: string; version: number }>((f, t) => db.from("program_versions").select("id, program_id, version").in("program_id", c).order("version", { ascending: false }).range(f, t)));
  const latestVersion = new Map<string, string>();
  for (const v of versions) if (!latestVersion.has(v.program_id)) latestVersion.set(v.program_id, v.id);
  const workouts = await inChunks([...latestVersion.values()], (c) => all<WorkoutRow>((f, t) => db.from("workouts").select("id, program_version_id, name, week, day_index").in("program_version_id", c).order("week").order("day_index").range(f, t)));
  const items = await inChunks(workouts.map((w) => w.id), (c) => all<ItemRow>((f, t) => db.from("workout_items").select("workout_id, position, group_label, exercise_id, sets, reps, load_kg, target_rpe, rest_seconds, notes").in("workout_id", c).order("position").range(f, t)));
  const sessions = await inChunks(ids, (c) => all<SessionRow>((f, t) => db.from("sessions").select("id, client_id, started_at, finished_at, session_rpe, note, workouts(name)").in("client_id", c).not("finished_at", "is", null).order("started_at").range(f, t).returns<SessionRow[]>()));
  const sets = await inChunks(sessions.map((s) => s.id), (c) => all<SetRow>((f, t) => db.from("logged_sets").select("session_id, exercise_id, set_index, load_kg, reps, seconds, rpe").in("session_id", c).order("set_index").range(f, t)));
  const checkIns = await inChunks(ids, (c) => all<CheckInRow>((f, t) => db.from("check_ins").select("client_id, submitted_at, weight_kg, energy, mood, sleep_hours, note").in("client_id", c).order("submitted_at").range(f, t)));
  const messages = await all<MessageRow>((f, t) => db.from("messages").select("client_id, sender_id, body, created_at").eq("coach_id", coachId).order("created_at").range(f, t));

  const clients: ExportClient[] = (links ?? []).map((l) => {
    const id = l.client_id as string;
    const profile = l.profiles as unknown as { full_name: string } | null;
    const p = latestProgram.get(id);
    const versionId = p ? latestVersion.get(p.id) : undefined;
    return {
      name: profile?.full_name ?? "Client", email: "", goal: (l.goal as string | null) ?? "", mode: l.mode as ExportClient["mode"], status: l.status as string, startedAt: l.started_at as string,
      program: p ? {
        name: p.name, weeks: p.weeks,
        workouts: workouts.filter((w) => w.program_version_id === versionId).map((w) => ({
          name: w.name, week: w.week, dayIndex: w.day_index,
          items: items.filter((i) => i.workout_id === w.id).map((i) => ({ group: i.group_label, exerciseId: Number(i.exercise_id), sets: i.sets, reps: i.reps, kg: num(i.load_kg), rpe: num(i.target_rpe), restSeconds: i.rest_seconds, notes: i.notes })),
        })),
      } : null,
      sessions: sessions.filter((s) => s.client_id === id).map((s) => ({
        startedAt: s.started_at, finishedAt: s.finished_at, workoutName: s.workouts?.name ?? "Session", rpe: num(s.session_rpe), note: s.note,
        sets: sets.filter((x) => x.session_id === s.id).map((x) => ({ exerciseId: Number(x.exercise_id), kg: num(x.load_kg), reps: x.reps, seconds: x.seconds, rpe: num(x.rpe) })),
      })),
      checkIns: checkIns.filter((k) => k.client_id === id).map((k) => ({ submittedAt: k.submitted_at, weightKg: num(k.weight_kg), energy: k.energy, mood: k.mood, sleepHours: num(k.sleep_hours), note: k.note })),
      messages: messages.filter((m) => m.client_id === id).map((m) => ({ at: m.created_at, from: m.sender_id === coachId ? "coach" : "client", body: m.body })),
    };
  });

  const { data: pending, error: pErr } = await db.from("imported_clients").select("data, created_at").eq("coach_id", coachId).is("client_id", null);
  if (pErr && !isMissingImportSchema(pErr)) throw pErr;
  for (const row of pending ?? []) {
    const stored = row.data as Stored;
    clients.push(pendingToExport(stored.client, stored.choices, row.created_at as string));
  }
  return { coachName, exportedAt: new Date().toISOString(), clients };
}
