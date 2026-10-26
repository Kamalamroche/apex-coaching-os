import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * localStorage, with an in-memory fallback. Some in-app browsers (a link opened
 * inside Gmail, Instagram and the like) and private windows refuse it, and then
 * Supabase finds no session when it writes to the database, even though the user
 * has just signed in. Keeping the session in memory keeps that page working; it
 * is lost when the tab closes, so the user signs in again next time.
 */
const sessionStore = (): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void } => {
  const memory = new Map<string, string>();
  const fallback = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
  try {
    const probe = "apex-storage-probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
  } catch {
    return fallback;
  }
  return {
    getItem: (k) => { try { return localStorage.getItem(k) ?? memory.get(k) ?? null; } catch { return memory.get(k) ?? null; } },
    setItem: (k, v) => { memory.set(k, v); try { localStorage.setItem(k, v); } catch { /* keep the memory copy */ } },
    removeItem: (k) => { memory.delete(k); try { localStorage.removeItem(k); } catch { /* already gone */ } },
  };
};

/** Null when the app is built without Supabase settings: then only the demo runs. */
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { storage: sessionStore() } })
  : null;

/** `?demo` in the URL forces demo mode even when Supabase is configured. */
export const isDemo = (): boolean => !supabase || new URLSearchParams(location.search).has("demo");
