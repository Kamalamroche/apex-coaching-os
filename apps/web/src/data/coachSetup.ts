import type { SetupInput } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/* What a coach has set up so far, for the Get set up card on the Brief (packages/core/src/coachSetup.ts).
   Counts only. A table that doesn't exist yet (its SQL not run) counts as nothing set up. */

async function count(q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  try { const { count: n, error } = await q; return error ? 0 : n ?? 0; } catch { return 0; }
}

export async function loadSetup(db: SupabaseClient, coachId: string): Promise<SetupInput> {
  const head = { count: "exact" as const, head: true };
  const [clients, invites, imported, templates, services, hours, page] = await Promise.all([
    count(db.from("coach_clients").select("client_id", head).eq("coach_id", coachId)),
    count(db.from("invites").select("token", head).eq("coach_id", coachId)),
    count(db.from("imported_clients").select("id", head).eq("coach_id", coachId)),
    count(db.from("program_templates").select("id", head).eq("coach_id", coachId)),
    count(db.from("coach_services").select("id", head).eq("coach_id", coachId).eq("active", true).gt("price_pence", 0)),
    db.from("coach_booking_settings").select("windows").eq("coach_id", coachId).maybeSingle().then((r) => (Array.isArray(r.data?.windows) ? r.data!.windows.length : 0), () => 0),
    db.from("coach_pages").select("published").eq("coach_id", coachId).maybeSingle().then((r) => !!r.data?.published, () => false),
  ]);
  return { clients: clients + invites + imported, templates, bookingWindows: hours, pricedServices: services, pagePublished: page };
}

/** The demo coach: two steps left, so the card shows how it works. */
export const DEMO_SETUP: SetupInput = { clients: 6, templates: 3, bookingWindows: 5, pricedServices: 0, pagePublished: false };
