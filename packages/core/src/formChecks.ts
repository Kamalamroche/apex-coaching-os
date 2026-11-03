/* Video form checks: the client films a set and sends it; the coach watches it and replies.
   Videos live in a private storage bucket under "<client id>/...". Behind one interface like ApexStore:
   the demo keeps them in memory, the live app in form_checks + the form-videos bucket
   (supabase/migrations/20261103120000_form_checks.sql). Pure, so it is unit tested. */

import { DEMO_VIDEOS } from "./data/demoVideos";

export interface FormCheck {
  id: string;
  exerciseId: number | null;
  /** Name at the time it was sent, so a renamed exercise doesn't change history. */
  exercise: string;
  /** The client's question, e.g. "Is my back rounding at the bottom?" */
  note: string;
  path: string;
  createdAt: string;
  coachReply: string | null;
  reviewedAt: string | null;
  /** Something a <video> can play: a signed URL (live) or a local URL (demo). Null when it can't be shown. */
  url: string | null;
}

export interface FormCheckUpload {
  exerciseId: number | null;
  exercise: string;
  note: string;
  file: Blob;
}

export interface FormCheckState {
  /** Newest first. */
  checks: FormCheck[];
  /** "needs-update": the database doesn't have the table yet (the SQL hasn't run). */
  status: "loading" | "ready" | "needs-update" | "error";
  error?: string;
}

export interface FormCheckStore {
  get(): FormCheckState;
  subscribe(listener: () => void): () => void;
  /** Client: upload a video and send it. */
  submit(u: FormCheckUpload): Promise<void>;
  /** Coach: reply and mark it reviewed. */
  reply(id: string, text: string): Promise<void>;
  /** Client: take one back (the video is deleted too). */
  remove(id: string): Promise<void>;
}

export const MAX_VIDEO_MB = 50;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

/** Why this file can't be sent, or null when it can. */
export function videoProblem(f: { size: number; type: string }): string | null {
  if (!f.type.startsWith("video/")) return "That file isn't a video. Pick or film a video of the set.";
  if (!VIDEO_TYPES.includes(f.type)) return "That video format isn't supported. Most phones film in MP4 or MOV, which both work.";
  if (f.size > MAX_VIDEO_MB * 1024 * 1024) return `That video is over ${MAX_VIDEO_MB} MB. Film just the one set (under a minute), or trim it first.`;
  if (f.size === 0) return "That video is empty. Try filming it again.";
  return null;
}

export const videoExtension = (type: string): string => (type === "video/quicktime" ? "mov" : type === "video/webm" ? "webm" : "mp4");

/** Storage path for a new video: the client's folder first, so storage policies know whose it is. */
export const videoPath = (clientId: string, id: string, type: string): string => `${clientId}/${id}.${videoExtension(type)}`;

export const awaitingReview = (checks: FormCheck[]): FormCheck[] => checks.filter((c) => !c.reviewedAt);

/* ---------- Database rows ---------- */

export interface FormCheckRow {
  id: string;
  client_id: string;
  exercise_id: number | null;
  exercise_name: string;
  note: string | null;
  storage_path: string;
  created_at: string;
  coach_reply: string | null;
  reviewed_at: string | null;
}

export const toFormCheckRow = (u: Omit<FormCheckUpload, "file">, clientId: string, id: string, path: string) => ({
  id, client_id: clientId, exercise_id: u.exerciseId, exercise_name: u.exercise.slice(0, 120), note: u.note.trim().slice(0, 1000) || null, storage_path: path,
});

export const fromFormCheckRow = (r: FormCheckRow, url: string | null): FormCheck => ({
  id: r.id, exerciseId: r.exercise_id === null ? null : Number(r.exercise_id), exercise: r.exercise_name, note: r.note ?? "", path: r.storage_path,
  createdAt: r.created_at, coachReply: r.coach_reply, reviewedAt: r.reviewed_at, url,
});

/* ---------- Demo ---------- */

/** One check waiting for the coach, played from a HELIX demo clip, so the demo has something to show. */
export function sampleFormChecks(now = new Date()): FormCheck[] {
  const at = new Date(now.getTime() - 3 * 3600000).toISOString();
  return [{
    id: "demo-form-1", exerciseId: 1, exercise: "Trap Bar Deadlift", note: "Last set felt heavy. Is my back staying flat at the bottom?", path: "demo/sample.mp4",
    createdAt: at, coachReply: null, reviewedAt: null, url: DEMO_VIDEOS[1]?.src ?? null,
  }];
}

/** Demo store: in memory for this visit (videos are too big for localStorage). `toUrl` turns a picked file into something playable. */
export function createDemoFormCheckStore(toUrl: (b: Blob) => string | null = () => null, now = new Date()): FormCheckStore {
  let state: FormCheckState = { checks: sampleFormChecks(now), status: "ready" };
  const listeners = new Set<() => void>();
  const update = (fn: (s: FormCheckState) => FormCheckState) => {
    state = fn(state);
    listeners.forEach((l) => l());
  };
  return {
    get: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    async submit(u) {
      const problem = videoProblem({ size: u.file.size, type: u.file.type });
      if (problem) throw new Error(problem);
      const id = `demo-form-${Date.now()}`;
      const check: FormCheck = { id, exerciseId: u.exerciseId, exercise: u.exercise, note: u.note.trim(), path: `demo/${id}`, createdAt: new Date().toISOString(), coachReply: null, reviewedAt: null, url: toUrl(u.file) };
      update((s) => ({ ...s, checks: [check, ...s.checks] }));
    },
    async reply(id, text) {
      update((s) => ({ ...s, checks: s.checks.map((c) => (c.id === id ? { ...c, coachReply: text.trim() || null, reviewedAt: new Date().toISOString() } : c)) }));
    },
    async remove(id) {
      update((s) => ({ ...s, checks: s.checks.filter((c) => c.id !== id) }));
    },
  };
}

export function emptyFormCheckStore(): FormCheckStore {
  const state: FormCheckState = { checks: [], status: "ready" };
  return { get: () => state, subscribe: () => () => {}, submit: async () => {}, reply: async () => {}, remove: async () => {} };
}
