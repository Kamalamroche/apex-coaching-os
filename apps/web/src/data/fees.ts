import { fromFeeRow, toFeeRow, type FeePayment, type FeePaymentRow } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/* Monthly fee ticks (packages/core/src/fees.ts). Live: the fee_payments table from the money SQL. Demo: this browser. */

export const FEES_NEED_UPDATE = "Ticking off monthly fees needs the money SQL in Supabase first.";
const isMissing = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205" || e?.code === "PGRST204" || e?.code === "42703";

export interface FeeApi {
  /** This month and every month after it that's already paid for. ready is false until the money SQL has run. */
  load(fromMonth: string): Promise<{ list: FeePayment[]; ready: boolean }>;
  /** One row per month covered (a membership paid up front is several). All or none. */
  markPaid(ps: FeePayment[]): Promise<void>;
  unmark(id: string): Promise<void>;
}

export function liveFees(db: SupabaseClient, coachId: string): FeeApi {
  return {
    async load(month) {
      const { data, error } = await db.from("fee_payments").select("*").eq("coach_id", coachId).gte("month", `${month}-01`);
      if (error) { if (isMissing(error)) return { list: [], ready: false }; throw new Error(error.message); }
      return { list: ((data ?? []) as FeePaymentRow[]).map(fromFeeRow), ready: true };
    },
    async markPaid(ps) {
      if (!ps.length) return;
      const { error } = await db.from("fee_payments").insert(ps.map((p) => toFeeRow(p, coachId)));
      if (error) throw isMissing(error) ? new Error(FEES_NEED_UPDATE) : error.code === "23505" ? new Error("Already marked as paid for that month.") : new Error(error.message);
    },
    async unmark(id) {
      const { error } = await db.from("fee_payments").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

const KEY = "apex-fee-payments";
const read = (): FeePayment[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null") ?? []; } catch { return []; } };
const write = (v: FeePayment[]) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* this visit only */ } };

export function demoFees(): FeeApi {
  let mem: FeePayment[] | null = null;
  const get = () => (mem ??= read());
  const set = (v: FeePayment[]) => { mem = v; write(v); };
  return {
    async load(month) { mem = null; return { list: get().filter((p) => p.month >= month), ready: true }; },
    async markPaid(ps) { if (ps.some((p) => get().some((x) => x.clientId === p.clientId && x.month === p.month))) throw new Error("Already marked as paid for that month."); set([...get(), ...ps]); },
    async unmark(id) { set(get().filter((p) => p.id !== id)); },
  };
}
