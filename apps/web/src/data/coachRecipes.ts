import { fromCoachRecipeRow, recipeProblem, toCoachRecipeRow, type CoachRecipeRow, type Recipe } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";

/** The coach's own recipes. The coach writes them; their clients see them next to the APEX library. */
export interface CoachRecipeApi {
  live: boolean;
  load(): Promise<Recipe[]>;
  save(r: Recipe): Promise<void>;
  remove(id: string): Promise<void>;
}

export const RECIPES_NEED_UPDATE = "needs-update";
const isMissing = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";
const err = (e: { code?: string; message: string }) => (isMissing(e) ? new Error(RECIPES_NEED_UPDATE) : new Error(e.message));

export function liveCoachRecipes(db: SupabaseClient, coachId: string): CoachRecipeApi {
  return {
    live: true,
    async load() {
      const { data, error } = await db.from("coach_recipes").select("id, coach_id, recipe, updated_at").eq("coach_id", coachId).order("updated_at", { ascending: false }).limit(300).returns<CoachRecipeRow[]>();
      if (error) {
        // Before the recipes SQL runs there is simply no table: show the APEX library on its own.
        if (isMissing(error)) return [];
        throw err(error);
      }
      return (data ?? []).map(fromCoachRecipeRow);
    },
    async save(r) {
      const problem = recipeProblem(r);
      if (problem) throw new Error(problem);
      const { error } = await db.from("coach_recipes").upsert({ ...toCoachRecipeRow(r, coachId), updated_at: new Date().toISOString() });
      if (error) throw err(error);
    },
    async remove(id) {
      const { error } = await db.from("coach_recipes").delete().eq("id", id);
      if (error) throw err(error);
    },
  };
}

const KEY = "apex-coach-recipes-v1";

/** Demo: recipes live in this browser only. */
export function demoCoachRecipes(): CoachRecipeApi {
  const read = (): Recipe[] => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as Recipe[];
    } catch { /* none yet */ }
    return [];
  };
  const write = (v: Recipe[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* this visit only */ }
  };
  return {
    live: false,
    async load() {
      return read();
    },
    async save(r) {
      const problem = recipeProblem(r);
      if (problem) throw new Error(problem);
      const all = read();
      write(all.some((x) => x.id === r.id) ? all.map((x) => (x.id === r.id ? r : x)) : [r, ...all]);
    },
    async remove(id) {
      write(read().filter((x) => x.id !== id));
    },
  };
}

const Ctx = createContext<CoachRecipeApi | null>(null);
export const CoachRecipeProvider = Ctx.Provider;
export const useCoachRecipeApi = (): CoachRecipeApi | null => useContext(Ctx);

/** The coach's recipes, loaded once, with a reload after the coach saves or deletes one. */
export function useCoachRecipes(): { recipes: Recipe[]; api: CoachRecipeApi | null; reload: () => void } {
  const api = useCoachRecipeApi();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!api) return;
    let gone = false;
    api.load().then((r) => { if (!gone) setRecipes(r); }).catch(() => { /* keep the APEX library on its own */ });
    return () => { gone = true; };
  }, [api, tick]);
  return { recipes, api, reload: () => setTick((t) => t + 1) };
}

/** Shrink a photo the coach picks to a ~640 px WebP (falls back to JPEG), small enough to keep with the recipe. */
export async function recipePhotoFromFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Pick a photo.");
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  for (const q of [0.8, 0.65, 0.5]) {
    let url = c.toDataURL("image/webp", q);
    if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/jpeg", q);
    if (url.length < 140_000) return url;
  }
  throw new Error("That photo is too big. Try another.");
}
