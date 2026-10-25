import type { SupabaseClient } from "@supabase/supabase-js";

export interface LiveClient {
  id: string;
  name: string;
  mode: string;
  startedAt: string;
  lastSession: string | null;
}

const MODE_LABEL: Record<string, string> = { online: "Online", hybrid: "Hybrid", in_person: "In person" };

/** The signed-in coach's clients, newest first, with their latest finished session. */
export async function listClients(db: SupabaseClient, coachId: string): Promise<LiveClient[]> {
  const { data, error } = await db
    .from("coach_clients")
    .select("client_id, mode, started_at, profiles!coach_clients_client_id_fkey(full_name)")
    .eq("coach_id", coachId)
    .neq("status", "ended")
    .order("started_at", { ascending: false });
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.client_id as string);
  const last = new Map<string, string>();
  if (ids.length) {
    const { data: sessions, error: sErr } = await db.from("sessions").select("client_id, finished_at").in("client_id", ids).not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(200);
    if (sErr) throw sErr;
    for (const s of sessions ?? []) if (!last.has(s.client_id)) last.set(s.client_id, s.finished_at);
  }
  return (data ?? []).map((r) => {
    const profile = r.profiles as unknown as { full_name: string } | null;
    return {
      id: r.client_id as string,
      name: profile?.full_name ?? "Client",
      mode: MODE_LABEL[r.mode as string] ?? "Online",
      startedAt: r.started_at as string,
      lastSession: last.get(r.client_id as string) ?? null,
    };
  });
}

/** Creates a one-time invite and returns the link to send to a client. */
export async function createInviteLink(db: SupabaseClient, coachId: string): Promise<string> {
  const { data, error } = await db.from("invites").insert({ coach_id: coachId }).select("token").single();
  if (error) throw error;
  return `${location.origin}/client/?invite=${data.token}`;
}
