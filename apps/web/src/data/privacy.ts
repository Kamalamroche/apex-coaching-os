import { LEGAL_VERSION, fromConsentRow, type ConsentKind, type ConsentRecord, type ConsentRow, type PrivacyRole } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

/** The signed-in person's agreements, a copy of their data, and deleting their account. */
export interface PrivacyApi {
  live: boolean;
  role: PrivacyRole;
  name: string;
  email: string;
  consents(): Promise<ConsentRecord[]>;
  give(kinds: ConsentKind[]): Promise<void>;
  withdraw(kind: ConsentKind): Promise<void>;
  exportData(): Promise<unknown>;
  /** Deletes the account and everything that belongs to it. Signs out afterwards. */
  deleteAccount(): Promise<void>;
  /** Whether to email this person when a message waits unread (on unless they switched it off). */
  emailAlerts(): Promise<boolean>;
  setEmailAlerts(on: boolean): Promise<void>;
  /** Push notifications: the server's public key, or null in the demo (which shows notifications on this device only). */
  pushKey(): Promise<string | null>;
  savePush(s: PushDevice): Promise<void>;
  removePush(endpoint: string): Promise<void>;
  /** Sends a test notification to every device of this person; how many it reached. */
  testPush(): Promise<number>;
}

export interface PushDevice { endpoint: string; p256dh: string; auth: string; device: string }

/** The push function isn't deployed yet (or the push SQL isn't run). */
export const PUSH_NOT_READY = "push-not-ready";


const isMissing = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205" || e?.code === "PGRST202" || e?.code === "42883";
export const PRIVACY_NEEDS_UPDATE = "needs-update";
const err = (e: { code?: string; message: string }) => (isMissing(e) ? new Error(PRIVACY_NEEDS_UPDATE) : new Error(e.message));

const PHOTO_BUCKET = "progress-photos";
const VIDEO_BUCKET = "form-videos";

export function livePrivacy(db: SupabaseClient, me: { id: string; role: PrivacyRole; name: string; email: string }): PrivacyApi {
  /** A client's photos and videos live in storage, outside the database rows, so they go first. */
  const removeFiles = async () => {
    if (me.role !== "client") return;
    for (const [table, bucket] of [["progress_photos", PHOTO_BUCKET], ["form_checks", VIDEO_BUCKET]] as const) {
      const { data, error } = await db.from(table).select("storage_path").eq("client_id", me.id).returns<{ storage_path: string }[]>();
      if (error) {
        if (isMissing(error)) continue;
        throw new Error(error.message);
      }
      const paths = (data ?? []).map((r) => r.storage_path);
      for (let i = 0; i < paths.length; i += 100) {
        const { error: e } = await db.storage.from(bucket).remove(paths.slice(i, i + 100));
        if (e) throw new Error(`Couldn't remove your files: ${e.message}`);
      }
    }
  };
  return {
    live: true,
    ...me,
    async consents() {
      const { data, error } = await db.from("user_consents").select("*").eq("user_id", me.id).returns<ConsentRow[]>();
      if (error) throw err(error);
      return (data ?? []).map(fromConsentRow);
    },
    async give(kinds) {
      if (!kinds.length) return;
      const { error } = await db.from("user_consents").insert(kinds.map((kind) => ({ user_id: me.id, kind, version: LEGAL_VERSION })));
      if (error) throw err(error);
    },
    async withdraw(kind) {
      const { error } = await db.rpc("withdraw_consent", { p_kind: kind });
      if (error) throw err(error);
    },
    async exportData() {
      const { data, error } = await db.rpc("export_my_data");
      if (error) throw err(error);
      return { ...(data as object), email: me.email };
    },
    async deleteAccount() {
      await removeFiles();
      const { error } = await db.rpc("delete_my_account");
      if (error) throw err(error);
      await db.auth.signOut();
    },
    async emailAlerts() {
      const { data, error } = await db.from("email_prefs").select("messages_on").eq("user_id", me.id).maybeSingle();
      if (error) throw err(error);
      return (data?.messages_on as boolean | undefined) ?? true;
    },
    async setEmailAlerts(on) {
      const { error } = await db.from("email_prefs").upsert({ user_id: me.id, messages_on: on, updated_at: new Date().toISOString() });
      if (error) throw err(error);
    },
    async pushKey() {
      const { data, error } = await db.functions.invoke<{ publicKey?: string }>("push", { body: { action: "key" } });
      if (error || !data?.publicKey) throw new Error(PUSH_NOT_READY);
      return data.publicKey;
    },
    async savePush(d) {
      const { error } = await db.rpc("save_push_subscription", { p_endpoint: d.endpoint, p_p256dh: d.p256dh, p_auth: d.auth, p_device: d.device });
      if (error) throw isMissing(error) ? new Error(PUSH_NOT_READY) : new Error(error.message);
    },
    async removePush(endpoint) {
      const { error } = await db.rpc("remove_push_subscription", { p_endpoint: endpoint });
      if (error && !isMissing(error)) throw new Error(error.message);
    },
    async testPush() {
      const { data, error } = await db.functions.invoke<{ sent?: number; error?: string }>("push", { body: { action: "test" } });
      if (error) throw new Error(PUSH_NOT_READY);
      return data?.sent ?? 0;
    },
  };
}

const KEY = "apex-privacy-v1";

/** Demo: agreements live in this browser; deleting clears the demo's sample data. */
export function demoPrivacy(role: PrivacyRole, name: string): PrivacyApi {
  const key = `${KEY}-${role}`;
  const read = (): ConsentRecord[] => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as ConsentRecord[];
    } catch { /* none */ }
    // The demo starts as if the person already agreed, so it opens straight into the app.
    return (role === "client" ? (["terms", "adult", "health"] as const) : (["terms", "adult", "coach_duty"] as const)).map((kind) => ({ kind, version: LEGAL_VERSION, givenAt: new Date().toISOString(), withdrawnAt: null }));
  };
  const write = (v: ConsentRecord[]) => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* this visit only */ }
  };
  return {
    live: false,
    role,
    name,
    email: role === "client" ? "priya@example.com" : "kamal@example.com",
    async consents() {
      return read();
    },
    async give(kinds) {
      const now = new Date().toISOString();
      write([...read(), ...kinds.map((kind) => ({ kind, version: LEGAL_VERSION, givenAt: now, withdrawnAt: null }))]);
    },
    async withdraw(kind) {
      const now = new Date().toISOString();
      write(read().map((c) => (c.kind === kind && !c.withdrawnAt ? { ...c, withdrawnAt: now } : c)));
    },
    async exportData() {
      const data: Record<string, unknown> = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith("apex")) data[k] = JSON.parse(localStorage.getItem(k) ?? "null") as unknown;
        }
      } catch { /* nothing stored */ }
      return { exported_at: new Date().toISOString(), profile: { full_name: name, role }, note: "Demo: this is the sample data stored in this browser.", data };
    },
    async deleteAccount() {
      try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith("apex")) keys.push(k);
        }
        for (const k of keys) localStorage.removeItem(k);
      } catch { /* nothing stored */ }
    },
    async emailAlerts() {
      try { return localStorage.getItem(`${key}-email`) !== "off"; } catch { return true; }
    },
    async setEmailAlerts(on) {
      try { localStorage.setItem(`${key}-email`, on ? "on" : "off"); } catch { /* this visit only */ }
    },
    async pushKey() {
      return null;
    },
    async savePush() { /* the demo keeps nothing */ },
    async removePush() { /* the demo keeps nothing */ },
    async testPush() {
      return 0;
    },
  };
}

const PrivacyContext = createContext<PrivacyApi | null>(null);
export const PrivacyProvider = PrivacyContext.Provider;
export const usePrivacyApi = (): PrivacyApi | null => useContext(PrivacyContext);
