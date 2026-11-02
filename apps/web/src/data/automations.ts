import { DEFAULT_AUTOMATIONS, fromAutomationRow, fromSendRow, toAutomationRow, type AutomationRow, type AutomationSend, type AutomationSendRow, type AutomationSettings } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The coach's automatic message settings and what recently went out. Demo: localStorage. Live: coach_automations and automation_sends. */
export interface AutomationsApi {
  load(): Promise<{ settings: AutomationSettings; sends: AutomationSend[] }>;
  save(s: AutomationSettings): Promise<void>;
  /** False in the demo: nothing is really sent. */
  live: boolean;
}

const isMissingTable = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";
export const NEEDS_UPDATE = "needs-update";

export function liveAutomations(db: SupabaseClient, coachId: string): AutomationsApi {
  return {
    live: true,
    async load() {
      const [a, s] = await Promise.all([
        db.from("coach_automations").select("*").eq("coach_id", coachId).maybeSingle<AutomationRow>(),
        db.from("automation_sends").select("client_id, kind, sent_at").eq("coach_id", coachId).order("sent_at", { ascending: false }).limit(20).returns<AutomationSendRow[]>(),
      ]);
      const err = a.error ?? s.error;
      if (err) throw isMissingTable(err) ? new Error(NEEDS_UPDATE) : new Error(err.message);
      return { settings: a.data ? fromAutomationRow(a.data) : DEFAULT_AUTOMATIONS, sends: (s.data ?? []).map(fromSendRow) };
    },
    async save(settings) {
      const { error } = await db.from("coach_automations").upsert({ ...toAutomationRow(settings, coachId), updated_at: new Date().toISOString() });
      if (error) throw isMissingTable(error) ? new Error(NEEDS_UPDATE) : new Error(error.message);
    },
  };
}

const KEY = "apex-automations-v1";

export function demoAutomations(): AutomationsApi {
  return {
    live: false,
    async load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) return { settings: { ...DEFAULT_AUTOMATIONS, ...(JSON.parse(raw) as Partial<AutomationSettings>) }, sends: [] };
      } catch {
        /* blocked storage: defaults */
      }
      return { settings: DEFAULT_AUTOMATIONS, sends: [] };
    },
    async save(s) {
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch {
        /* blocked storage: kept for this visit only */
      }
    },
  };
}
