/* Search engines and link previews for trainer pages. No imports beyond growth.ts, so the page function on the
   server stays small. */

import { MODE_LABEL, type CoachPage } from "./growth";

/** Title and description for a trainer's page, for Google and link previews. */
export function trainerMeta(p: Pick<CoachPage, "name" | "headline" | "city" | "specialties" | "modes" | "bio">): { title: string; description: string } {
  const where = p.city.trim() ? ` in ${p.city.trim()}` : p.modes.includes("online") ? " online" : "";
  const title = `${p.name} · Personal trainer${where} · APEX`;
  const lead = p.headline.trim() || p.bio.trim().split(/(?<=[.!?])\s/)[0] || "Personal training with a plan built for you.";
  const extra = p.specialties.length ? ` ${p.specialties.slice(0, 3).join(", ")}.` : "";
  const description = `${lead.replace(/[.!?]?$/, ".")}${extra} ${p.modes.map((m) => MODE_LABEL[m]).join(" · ")}.`.replace(/\s+/g, " ").trim();
  return { title: clip(title, 70), description: clip(description, 160) };
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** sitemap.xml for the site pages, the directory and every listed trainer. */
export function sitemapXml(origin: string, staticPaths: string[], trainers: { slug: string; updated: string | null }[]): string {
  const urls = [
    ...staticPaths.map((p) => `<url><loc>${xml(origin + p)}</loc></url>`),
    ...trainers.map((t) => `<url><loc>${xml(`${origin}/c/${t.slug}/`)}</loc>${t.updated ? `<lastmod>${xml(t.updated.slice(0, 10))}</lastmod>` : ""}</url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/** Fills a page's head with its own title, description and share preview. Leaves the rest alone. */
export function withMeta(html: string, meta: { title: string; description: string; url: string; image?: string }): string {
  const tags = [
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:title" content="${xml(meta.title)}" />`,
    `<meta property="og:description" content="${xml(meta.description)}" />`,
    `<meta property="og:url" content="${xml(meta.url)}" />`,
    ...(meta.image ? [`<meta property="og:image" content="${xml(meta.image)}" />`] : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<link rel="canonical" href="${xml(meta.url)}" />`,
  ].join("\n    ");
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${xml(meta.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${xml(meta.description)}" />\n    ${tags}`);
}

