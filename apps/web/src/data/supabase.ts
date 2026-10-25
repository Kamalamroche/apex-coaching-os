import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Null when the app is built without Supabase settings: then only the demo runs. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

/** `?demo` in the URL forces demo mode even when Supabase is configured. */
export const isDemo = (): boolean => !supabase || new URLSearchParams(location.search).has("demo");
