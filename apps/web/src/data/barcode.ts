import { OFF_FIELDS, foodFromOff, type Food, type OffProduct } from "@apex/core";

const CACHE_KEY = "apex.barcodes";
type Cache = Record<string, Food | null>;

function readCache(): Cache {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Cache; } catch { return {}; }
}
function remember(code: string, food: Food | null) {
  try {
    const c = readCache();
    c[code] = food;
    const keys = Object.keys(c);
    // Keep the last 200 scans.
    for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete c[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch { /* private mode: no cache */ }
}

/** Looks a barcode up on Open Food Facts (free, open data). Null when the product isn't there or has no calories. */
export async function lookupBarcode(code: string, fetcher: typeof fetch = fetch): Promise<Food | null> {
  const cached = readCache();
  if (code in cached) return cached[code] ?? null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const res = await fetcher(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, { signal: ctl.signal });
    if (res.status === 404) { remember(code, null); return null; }
    if (!res.ok) throw new Error(`Food database error ${res.status}`);
    const body = (await res.json()) as { status?: number; product?: OffProduct };
    const food = body.status === 1 || body.product ? foodFromOff(code, body.product) : null;
    remember(code, food);
    return food;
  } catch (e) {
    throw new Error(e instanceof DOMException && e.name === "AbortError" ? "The food database didn't answer. Check your connection and try again." : e instanceof Error ? e.message : "Couldn't look that up.");
  } finally {
    clearTimeout(t);
  }
}
