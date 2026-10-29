import { STARTER_TEMPLATES, type ProgramTemplate } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/** A coach's saved programs. The demo keeps them in this browser; live mode in program_templates. */
export interface TemplateLibrary {
  list(): Promise<ProgramTemplate[]>;
  save(template: ProgramTemplate): Promise<void>;
  remove(id: string): Promise<void>;
}

const DEMO_KEY = "apex-templates-v1";

export function demoTemplates(): TemplateLibrary {
  const read = (): ProgramTemplate[] => {
    try {
      return JSON.parse(localStorage.getItem(DEMO_KEY) ?? "[]") as ProgramTemplate[];
    } catch {
      return [];
    }
  };
  const write = (list: ProgramTemplate[]) => {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(list));
    } catch {
      /* private mode: templates last for this visit only */
    }
  };
  return {
    list: async () => [...read(), ...STARTER_TEMPLATES],
    save: async (t) => write([t, ...read().filter((x) => x.id !== t.id)]),
    remove: async (id) => write(read().filter((x) => x.id !== id)),
  };
}

interface TemplateRow {
  id: string;
  name: string;
  note: string | null;
  weeks: number;
  days: ProgramTemplate["days"];
}

/** Postgres "undefined table" and PostgREST "table not in schema cache": the SQL hasn't been run yet. */
export const isMissingTable = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";

export function liveTemplates(db: SupabaseClient): TemplateLibrary {
  return {
    async list() {
      const { data, error } = await db.from("program_templates").select("id, name, note, weeks, days").order("updated_at", { ascending: false }).returns<TemplateRow[]>();
      if (error && !isMissingTable(error)) throw error;
      return [...(data ?? []).map((r) => ({ id: r.id, name: r.name, weeks: r.weeks, days: r.days, ...(r.note ? { note: r.note } : {}) })), ...STARTER_TEMPLATES];
    },
    async save(t) {
      const { error } = await db.from("program_templates").upsert({ id: t.id, name: t.name, note: t.note ?? null, weeks: t.weeks, days: t.days, updated_at: new Date().toISOString() });
      if (error) throw isMissingTable(error) ? new Error("Run the program builder SQL in Supabase to save templates") : error;
    },
    async remove(id) {
      const { error } = await db.from("program_templates").delete().eq("id", id);
      if (error) throw error;
    },
  };
}
