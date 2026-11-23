/* /c/<slug>/: the trainer's page with its own title, description and share preview in the HTML, so Google and
   WhatsApp, Instagram or iMessage previews show the trainer, not a generic APEX title. The app itself is unchanged:
   this only fills the <head> of the same page. If anything fails, the plain page is served as before. */
import { trainerMeta, withMeta } from "../packages/core/src/seo";
import type { TrainingModeName } from "../packages/core/src/growth";
import { rpc } from "./_supabase";

export const config = { runtime: "edge" };

interface PageRow { slug: string; name: string; headline: string; bio: string; city: string; specialties: string[]; modes: TrainingModeName[] }

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const fromPath = url.pathname.match(/^\/c\/([^/]+)\/?$/)?.[1] ?? "";
  const slug = (url.searchParams.get("slug") || fromPath).toLowerCase();
  const shell = await fetch(new URL("/c/", url.origin)).catch(() => null);
  if (!shell || !shell.ok) return Response.redirect(new URL(`/c/?k=${encodeURIComponent(slug)}`, url.origin), 302);
  let html = await shell.text();
  if (SLUG.test(slug)) {
    const rows = await rpc<PageRow[]>("public_coach_page", { p_slug: slug });
    const page = rows?.[0];
    if (page) {
      const meta = trainerMeta({ ...page, specialties: page.specialties ?? [], modes: page.modes ?? [] });
      html = withMeta(html, { ...meta, url: `${url.origin}/c/${page.slug}/`, image: `${url.origin}/share-trainer.jpg` });
    }
  }
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400" },
  });
}
