import { cleanHidden, featureOn, type ClientFeature } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";

/* Client feature switches. The coach hides parts of the app per client; the client app leaves them out.
   Live: a hidden_features column on coach_clients (the coach writes it, the client reads their own row).
   Demo: this browser, shared by the coach and client tabs, so a switch on one shows on the other. */

export interface FeaturesApi {
  live: boolean;
  load(clientId: string): Promise<ClientFeature[]>;
  save(clientId: string, hidden: ClientFeature[]): Promise<void>;
}

const isMissingColumn = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST204";
export const FEATURES_SQL_NOTE = "Run the feature switches SQL first, then these can be saved";

export function liveFeatures(db: SupabaseClient, coachId: string): FeaturesApi {
  return {
    live: true,
    async load(clientId) {
      const { data, error } = await db.from("coach_clients").select("hidden_features").eq("coach_id", coachId).eq("client_id", clientId).maybeSingle();
      if (error) {
        if (isMissingColumn(error)) return [];
        throw error;
      }
      return cleanHidden((data as { hidden_features?: unknown[] } | null)?.hidden_features);
    },
    async save(clientId, hidden) {
      const { error } = await db.from("coach_clients").update({ hidden_features: hidden }).eq("coach_id", coachId).eq("client_id", clientId);
      if (error) throw isMissingColumn(error) ? new Error(FEATURES_SQL_NOTE) : error;
    },
  };
}

/** The client's own switches, read with their coach link. Empty (everything on) until the SQL has run. */
export async function loadMyFeatures(db: SupabaseClient, clientId: string, coachId: string): Promise<ClientFeature[]> {
  const { data, error } = await db.from("coach_clients").select("hidden_features").eq("coach_id", coachId).eq("client_id", clientId).maybeSingle();
  if (error) return [];
  return cleanHidden((data as { hidden_features?: unknown[] } | null)?.hidden_features);
}

const KEY = "apex-demo-hidden-features";
const EVENT = "apex-demo-features";

function readDemo(): Record<string, ClientFeature[]> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, ClientFeature[]>) : {};
  } catch {
    return {};
  }
}

/** Demo: the sample client's app reads whichever demo client the coach changed last for them. */
export const DEMO_FEATURES_CLIENT = "demo";

export function demoFeatures(): FeaturesApi {
  return {
    live: false,
    async load(clientId) { return cleanHidden(readDemo()[clientId]); },
    async save(clientId, hidden) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...readDemo(), [clientId]: hidden }));
        window.dispatchEvent(new Event(EVENT));
      } catch { /* this visit only */ }
    },
  };
}

function useDemoHidden(clientId: string, enabled: boolean): ClientFeature[] {
  const [hidden, setHidden] = useState<ClientFeature[]>(() => (enabled ? cleanHidden(readDemo()[clientId]) : []));
  useEffect(() => {
    if (!enabled) return;
    const sync = () => setHidden(cleanHidden(readDemo()[clientId]));
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener(EVENT, sync); };
  }, [clientId, enabled]);
  return hidden;
}

const Ctx = createContext<ClientFeature[] | null>(null);
/** Live client: the switches their coach set. Leave it out for the demo, which reads this browser. */
export const ClientFeaturesProvider = Ctx.Provider;

/** Client side: is this part of the app on for me? */
export function useFeatures(): (key: ClientFeature) => boolean {
  const live = useContext(Ctx);
  const demo = useDemoHidden(DEMO_FEATURES_CLIENT, live === null);
  const hidden = live ?? demo;
  return (key) => featureOn(hidden, key);
}
