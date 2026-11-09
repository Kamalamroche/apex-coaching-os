import type { BizBooking, BizClient, BizInput, BizLead, BizPack, BizSale } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface BusinessData {
  input: BizInput;
  /** True until the business SQL has run: fees and end dates can't be saved yet. */
  needsSql: boolean;
}

const isMissingColumn = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST204";
/** A table from a later SQL file that hasn't been run: that part of the dashboard is just empty. */
const isMissingTable = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";

/** Everything the business dashboard counts, from the coach's own records. Six months is plenty for the charts. */
export async function loadBusiness(db: SupabaseClient, coachId: string, now = new Date()): Promise<BusinessData> {
  const since = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();
  let needsSql = false;
  const pick = (cols: string) => db.from("coach_clients").select(`${cols}, profiles!coach_clients_client_id_fkey(full_name)`).eq("coach_id", coachId);
  let cc: { data: unknown[] | null; error: { code?: string; message: string } | null } = await pick("client_id, status, started_at, ended_at, monthly_fee_pence");
  if (cc.error && isMissingColumn(cc.error)) {
    needsSql = true;
    cc = await pick("client_id, status, started_at");
  }
  if (cc.error) throw cc.error;
  const clients: BizClient[] = (cc.data ?? []).map((r) => {
    const row = r as unknown as { client_id: string; status: BizClient["status"]; started_at: string; ended_at?: string | null; monthly_fee_pence?: number; profiles: { full_name: string } | null };
    return { id: row.client_id, name: row.profiles?.full_name ?? "Client", status: row.status, startedAt: row.started_at, endedAt: row.ended_at ?? null, feePence: row.monthly_fee_pence ?? 0 };
  });

  const [leads, bookings, packs, sales] = await Promise.all([
    db.from("join_requests").select("created_at, stage, source").eq("coach_id", coachId).gte("created_at", since),
    db.from("bookings").select("starts_at, kind, status, attendance, late").eq("coach_id", coachId).gte("starts_at", since),
    db.from("session_packs").select("bought_at, price_pence").eq("coach_id", coachId).gte("bought_at", since),
    db.from("programme_enrolments").select("started_at, paid_pence").eq("coach_id", coachId).eq("status", "active").gte("started_at", since),
  ]);
  const rows = <T,>(r: { data: unknown; error: { code?: string; message: string } | null }): T[] => {
    if (r.error && (isMissingTable(r.error) || isMissingColumn(r.error))) return [];
    if (r.error) throw r.error;
    return (r.data ?? []) as T[];
  };
  return {
    needsSql,
    input: {
      now,
      clients,
      leads: rows<{ created_at: string; stage: string; source: string }>(leads).map((l): BizLead => ({ createdAt: l.created_at, stage: l.stage, source: l.source })),
      bookings: rows<{ starts_at: string; kind: BizBooking["kind"]; status: BizBooking["status"]; attendance: BizBooking["attendance"]; late: boolean }>(bookings).map((b): BizBooking => ({ startsAt: b.starts_at, kind: b.kind, status: b.status, attendance: b.attendance ?? null, late: !!b.late })),
      packs: rows<{ bought_at: string; price_pence: number }>(packs).map((p): BizPack => ({ boughtAt: p.bought_at, pricePence: p.price_pence })),
      sales: rows<{ started_at: string | null; paid_pence: number }>(sales).filter((s) => s.started_at).map((s): BizSale => ({ at: s.started_at!, paidPence: s.paid_pence })),
    },
  };
}

/** The coach sets what a client pays each month. */
export async function setClientFee(db: SupabaseClient, coachId: string, clientId: string, pence: number): Promise<void> {
  const { error } = await db.from("coach_clients").update({ monthly_fee_pence: pence }).eq("coach_id", coachId).eq("client_id", clientId);
  if (error) throw isMissingColumn(error) ? new Error("Run the business SQL first, then fees can be saved") : error;
}

/** Pause, end or bring back a client. Ending records the date (for churn) and takes them off the client list. */
export async function setClientStatus(db: SupabaseClient, coachId: string, clientId: string, status: "active" | "paused" | "ended"): Promise<void> {
  const { error } = await db.from("coach_clients").update({ status }).eq("coach_id", coachId).eq("client_id", clientId);
  if (error) throw error;
}
