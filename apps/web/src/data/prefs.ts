import { getPrefs, onPrefsChange, setPrefs } from "@apex/ui";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect } from "react";

/* Units and language follow the person between devices by riding in their Supabase Auth user
   metadata, so no table or SQL is needed. The device copy (packages/ui/src/prefs.ts) still applies
   straight away and while offline. */

const META_KEY = "apex_prefs";

export function useAccountPrefs(db: SupabaseClient, metadata: Record<string, unknown> | undefined) {
  const saved = metadata?.[META_KEY];
  const savedJson = saved ? JSON.stringify(saved) : "";
  useEffect(() => {
    if (savedJson) setPrefs(JSON.parse(savedJson) as Parameters<typeof setPrefs>[0], true);
    // First sign-in on this account: keep what this device already uses.
    else void db.auth.updateUser({ data: { [META_KEY]: getPrefs() } });
  }, [db, savedJson]);
  useEffect(() => onPrefsChange((p) => void db.auth.updateUser({ data: { [META_KEY]: p } })), [db]);
}
