import { INVITE_DAYS, canInvite, fromGymClientRow, gymInviteLink, gymNameProblem, sampleGym, type Gym, type GymClient, type GymClientRow, type GymInvite, type GymMember, type GymRole } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

export interface GymState {
  gym: Gym | null;
  members: GymMember[];
  clients: GymClient[];
  invites: GymInvite[];
}

/** The signed-in trainer's gym: the team, the clients they can see, and the owner and managers' tools. */
export interface GymApi {
  live: boolean;
  me: string;
  load(): Promise<GymState>;
  create(name: string): Promise<void>;
  rename(name: string): Promise<void>;
  close(): Promise<void>;
  /** Makes an invite and returns the link to send. */
  invite(role: Exclude<GymRole, "owner">): Promise<string>;
  revoke(token: string): Promise<void>;
  setRole(coachId: string, role: Exclude<GymRole, "owner">): Promise<void>;
  /** Removes a teammate, or me to leave. */
  remove(coachId: string): Promise<void>;
  handOver(clientId: string, to: string): Promise<void>;
  share(clientId: string, withId: string, on: boolean): Promise<void>;
  /** The team inbox: one chat for everyone in the gym. */
  chat: {
    list(gymId: string): Promise<TeamMessage[]>;
    send(gymId: string, body: string): Promise<void>;
    remove(id: string): Promise<void>;
    /** Calls back when someone posts. Returns a stop function. */
    watch(gymId: string, changed: () => void): () => void;
  };
}

export interface TeamMessage { id: string; senderId: string; body: string; at: string }
export const TEAM_MESSAGE_MAX = 2000;
const bodyCheck = (b: string) => { const t = b.trim(); if (!t) throw new Error("Write a message first"); if (t.length > TEAM_MESSAGE_MAX) throw new Error("Keep it under 2,000 characters"); return t; };
export const TEAM_CHAT_NEEDS_SQL = "The team inbox needs the latest database update (20261121090000_contracts_classes_inbox.sql)";

const isMissing = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205" || e?.code === "PGRST202" || e?.code === "42883";
export const GYM_NEEDS_UPDATE = "needs-update";
const err = (e: { code?: string; message: string }) => (isMissing(e) ? new Error(GYM_NEEDS_UPDATE) : new Error(e.message));
const nameCheck = (name: string) => { const p = gymNameProblem(name); if (p) throw new Error(p); };

export function liveGym(db: SupabaseClient, me: string): GymApi {
  const call = async (fn: string, args: Record<string, unknown> = {}) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw err(error);
    return data as unknown;
  };
  return {
    live: true,
    me,
    async load() {
      const { data: g, error } = await db.rpc("my_gym").maybeSingle<{ id: string; name: string; my_role: GymRole }>();
      if (error) throw err(error);
      if (!g) return { gym: null, members: [], clients: [], invites: [] };
      const gym: Gym = { id: g.id, name: g.name, myRole: g.my_role };
      const lead = gym.myRole !== "trainer";
      const [team, clients, invites] = await Promise.all([
        db.rpc("gym_team"),
        db.rpc("gym_clients"),
        lead
          ? db.from("gym_invites").select("token, role, created_at, expires_at").is("accepted_by", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);
      for (const r of [team, clients, invites]) if (r.error) throw err(r.error);
      return {
        gym,
        members: ((team.data ?? []) as { coach_id: string; full_name: string; role: GymRole; joined_at: string }[]).map((m) => ({ id: m.coach_id, name: m.full_name, role: m.role, joinedAt: m.joined_at, isMe: m.coach_id === me })),
        clients: ((clients.data ?? []) as GymClientRow[]).map(fromGymClientRow),
        invites: ((invites.data ?? []) as { token: string; role: "manager" | "trainer"; created_at: string; expires_at: string }[]).map((i) => ({ token: i.token, role: i.role, createdAt: i.created_at, expiresAt: i.expires_at })),
      };
    },
    async create(name) { nameCheck(name); await call("create_gym", { p_name: name.trim() }); },
    async rename(name) { nameCheck(name); await call("rename_gym", { p_name: name.trim() }); },
    async close() { await call("close_gym"); },
    async invite(role) { return gymInviteLink(location.origin, (await call("create_gym_invite", { p_role: role })) as string); },
    async revoke(token) { await call("revoke_gym_invite", { p_token: token }); },
    async setRole(coachId, role) { await call("set_gym_role", { p_coach: coachId, p_role: role }); },
    async remove(coachId) { await call("remove_gym_member", { p_coach: coachId }); },
    async handOver(clientId, to) { await call("hand_over_gym_client", { p_client: clientId, p_to: to }); },
    async share(clientId, withId, on) { await call("share_gym_client", { p_client: clientId, p_with: withId, p_on: on }); },
    chat: {
      async list(gymId) {
        const { data, error } = await db.from("gym_messages").select("id, sender_id, body, created_at").eq("gym_id", gymId).order("created_at", { ascending: false }).limit(100);
        if (error) throw isMissing(error) ? new Error(TEAM_CHAT_NEEDS_SQL) : new Error(error.message);
        return (data as { id: string; sender_id: string; body: string; created_at: string }[]).reverse().map((r) => ({ id: r.id, senderId: r.sender_id, body: r.body, at: r.created_at }));
      },
      async send(gymId, body) {
        const { error } = await db.from("gym_messages").insert({ gym_id: gymId, sender_id: me, body: bodyCheck(body) });
        if (error) throw isMissing(error) ? new Error(TEAM_CHAT_NEEDS_SQL) : new Error(error.message);
      },
      async remove(id) {
        const { error } = await db.from("gym_messages").delete().eq("id", id);
        if (error) throw new Error(error.message);
      },
      watch(gymId, changed) {
        const ch = db.channel(`apex-team-chat-${gymId}-${Math.random().toString(36).slice(2)}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "gym_messages", filter: `gym_id=eq.${gymId}` }, changed)
          .subscribe();
        return () => { void db.removeChannel(ch); };
      },
    },
  };
}

/** A coach who opened a gym invite link: join, then drop the token from the address. Returns the gym's name. */
export async function acceptGymInvite(db: SupabaseClient, token: string): Promise<string> {
  const { data, error } = await db.rpc("accept_gym_invite", { p_token: token });
  if (error) throw err(error);
  return data as string;
}

/** What happened to a gym invite opened this visit, for the Gym screen to say. */
export const gymInviteNote: { text: string | null } = { text: null };

/** Demo: Kamal owns a sample gym, kept in memory for this visit. */
export function demoGym(): GymApi {
  let s: GymState = { ...sampleGym() };
  const me = "coach";
  const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  let chat: TeamMessage[] = [
    { id: "tm-1", senderId: "t-amara", body: "Morning all. Studio 2 is closed for cleaning until 10, so use the main floor for early sessions.", at: ago(190) },
    { id: "tm-2", senderId: "t-luis", body: "Thanks. Aisha's knee is better, so I'm putting squats back in from Monday.", at: ago(150) },
    { id: "tm-3", senderId: "t-mei", body: "Can someone cover my 6pm Thursday? Happy to swap for a Saturday morning.", at: ago(42) },
  ];
  const myRole = () => s.gym?.myRole ?? "trainer";
  const member = (id: string) => s.members.find((m) => m.id === id);
  return {
    live: false,
    me,
    async load() { return structuredClone(s); },
    async create(name) { nameCheck(name); const fresh = sampleGym(); s = { gym: { id: "gym-demo", name: name.trim(), myRole: "owner" }, members: fresh.members.slice(0, 1), clients: fresh.clients.filter((c) => c.trainerId === me).map((c) => ({ ...c, sharedWith: [] })), invites: [] }; },
    async rename(name) { nameCheck(name); if (s.gym) s.gym = { ...s.gym, name: name.trim() }; },
    async close() { s = { gym: null, members: [], clients: [], invites: [] }; },
    async invite(role) {
      if (!canInvite(myRole(), role)) throw new Error(`You can't invite a ${role}`);
      const now = new Date();
      const token = `demo-${Date.now().toString(36)}`;
      s.invites = [{ token, role, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + INVITE_DAYS * 86_400_000).toISOString() }, ...s.invites];
      return gymInviteLink(location.origin, token);
    },
    async revoke(token) { s.invites = s.invites.filter((i) => i.token !== token); },
    async setRole(id, role) { s.members = s.members.map((m) => (m.id === id && m.role !== "owner" ? { ...m, role } : m)); },
    async remove(id) {
      if (member(id)?.role === "owner") throw new Error("The owner can't leave. Close the gym instead.");
      s.members = s.members.filter((m) => m.id !== id);
      s.clients = s.clients.filter((c) => c.trainerId !== id).map((c) => ({ ...c, sharedWith: c.sharedWith.filter((w) => w.id !== id) }));
    },
    async handOver(clientId, to) {
      const t = member(to);
      if (!t) throw new Error("That trainer isn't in your gym");
      s.clients = s.clients.map((c) => (c.id === clientId ? { ...c, trainerId: t.id, trainerName: t.name, sharedWith: c.sharedWith.filter((w) => w.id !== t.id) } : c));
    },
    async share(clientId, withId, on) {
      const t = member(withId);
      if (!t) return;
      s.clients = s.clients.map((c) => {
        if (c.id !== clientId) return c;
        const rest = c.sharedWith.filter((w) => w.id !== withId);
        return { ...c, sharedWith: on ? [...rest, { id: t.id, name: t.name }].sort((a, b) => a.name.localeCompare(b.name)) : rest };
      });
    },
    chat: {
      async list() { return chat.map((m) => ({ ...m })); },
      async send(_gym, body) { chat = [...chat, { id: crypto.randomUUID(), senderId: me, body: bodyCheck(body), at: new Date().toISOString() }]; },
      async remove(id) { chat = chat.filter((m) => m.id !== id || m.senderId !== me); },
      watch() { return () => {}; },
    },
  };
}

const Ctx = createContext<GymApi | null>(null);
export const GymProvider = Ctx.Provider;
export const useGymApi = () => useContext(Ctx);
