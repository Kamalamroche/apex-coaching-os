import { fromResourceRow, resourceProblem, sampleResources, toResourceRow, type Resource, type ResourceRow } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

/** The coach's resource library. The coach manages it; clients read what's shared with them. */
export interface ResourceApi {
  live: boolean;
  load(): Promise<Resource[]>;
  save(r: Resource): Promise<void>;
  remove(id: string): Promise<void>;
}

const isMissing = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";
export const RESOURCES_NEED_UPDATE = "needs-update";
const err = (e: { code?: string; message: string }) => (isMissing(e) ? new Error(RESOURCES_NEED_UPDATE) : new Error(e.message));

export function liveResources(db: SupabaseClient, coachId: string): ResourceApi {
  return {
    live: true,
    async load() {
      // RLS already limits a client to everyone's and their own.
      const { data, error } = await db.from("coach_resources").select("*").eq("coach_id", coachId).order("created_at", { ascending: false }).limit(200).returns<ResourceRow[]>();
      if (error) throw err(error);
      return (data ?? []).map(fromResourceRow);
    },
    async save(r) {
      const problem = resourceProblem(r);
      if (problem) throw new Error(problem);
      const { error } = await db.from("coach_resources").upsert(toResourceRow(r, coachId));
      if (error) throw err(error);
    },
    async remove(id) {
      const { error } = await db.from("coach_resources").delete().eq("id", id);
      if (error) throw err(error);
    },
  };
}

const KEY = "apex-resources-v1";

export function demoResources(): ResourceApi {
  const read = (): Resource[] => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as Resource[];
    } catch { /* sample */ }
    return sampleResources();
  };
  const write = (v: Resource[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* this visit only */ }
  };
  return {
    live: false,
    async load() {
      return read();
    },
    async save(r) {
      const problem = resourceProblem(r);
      if (problem) throw new Error(problem);
      const all = read();
      write(all.some((x) => x.id === r.id) ? all.map((x) => (x.id === r.id ? r : x)) : [r, ...all]);
    },
    async remove(id) {
      write(read().filter((x) => x.id !== id));
    },
  };
}

const Ctx = createContext<ResourceApi | null>(null);
export const ResourceProvider = Ctx.Provider;
export const useResourceApi = (): ResourceApi | null => useContext(Ctx);
