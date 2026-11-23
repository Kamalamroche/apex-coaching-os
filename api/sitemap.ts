/* /sitemap.xml: the site pages, Find a trainer and every listed trainer page, for Google. */
import { sitemapXml } from "../packages/core/src/seo";
import { rpc } from "./_supabase";

export const config = { runtime: "edge" };

const PAGES = ["/", "/trainers/", "/start/"];

export default async function handler(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;
  const rows = (await rpc<{ slug: string; updated_at: string | null }[]>("public_trainers", {})) ?? [];
  return new Response(sitemapXml(origin, PAGES, rows.map((r) => ({ slug: r.slug, updated: r.updated_at }))), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
