import type { SupabaseClient } from "@supabase/supabase-js";

/** Check-ins and form videos each client is waiting on a reply for, in two queries. */
export async function loadReviewCounts(db: SupabaseClient, clientIds: string[]): Promise<Record<string, { checkIns: number; videos: number }>> {
  const out: Record<string, { checkIns: number; videos: number }> = Object.fromEntries(clientIds.map((id) => [id, { checkIns: 0, videos: 0 }]));
  if (!clientIds.length) return out;
  const [ci, fc] = await Promise.all([
    db.from("check_ins").select("client_id").in("client_id", clientIds).is("reviewed_at", null).limit(2000),
    db.from("form_checks").select("client_id").in("client_id", clientIds).is("reviewed_at", null).limit(2000),
  ]);
  // A missing table (an older database) just counts as nothing waiting.
  for (const r of (ci.data ?? []) as { client_id: string }[]) if (out[r.client_id]) out[r.client_id]!.checkIns++;
  for (const r of (fc.data ?? []) as { client_id: string }[]) if (out[r.client_id]) out[r.client_id]!.videos++;
  return out;
}
