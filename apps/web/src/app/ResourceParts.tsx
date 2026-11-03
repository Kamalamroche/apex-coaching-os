import { linkHost, linkKind, safeUrl, shortDate, type Resource } from "@apex/core";
import { Icons } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { RESOURCES_NEED_UPDATE, type ResourceApi } from "../data/resources";

export interface ResourceData {
  status: "loading" | "ready" | "needs-update" | "error";
  error?: string;
  list: Resource[];
  reload: () => Promise<void>;
}

export function useResources(api: ResourceApi | null): ResourceData {
  const [s, setS] = useState<Omit<ResourceData, "reload">>({ status: "loading", list: [] });
  const reload = useCallback(async () => {
    if (!api) return;
    try {
      setS({ status: "ready", list: await api.load() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setS((p) => ({ ...p, status: msg === RESOURCES_NEED_UPDATE ? "needs-update" : "error", error: msg }));
    }
  }, [api]);
  useEffect(() => void reload(), [reload]);
  return { ...s, reload };
}

export function ResourceStatus({ data }: { data: ResourceData }) {
  if (data.status === "loading") return <div className="card small">Loading…</div>;
  if (data.status === "needs-update") return <div className="card small">The resource library needs a quick database update. Run the resources and notes SQL in Supabase, then reload.</div>;
  if (data.status === "error") return <div className="card small" style={{ borderColor: "var(--crit)" }}>Couldn't load resources: {data.error}</div>;
  return null;
}

const KIND_ICON = { video: "play", pdf: "file", link: "link" } as const;
const KIND_WORD = { video: "Watch the video", pdf: "Open the PDF", link: "Open the link" } as const;

export function ResourceIcon({ r }: { r: Resource }) {
  const I = r.url ? Icons[KIND_ICON[linkKind(r.url)]] : Icons.note;
  return <span className="hb-ico" aria-hidden><I /></span>;
}

/** What it is in a few words: "Video · youtube.com", "Guide". */
export const resourceMeta = (r: Resource): string =>
  r.url ? `${linkKind(r.url) === "video" ? "Video" : linkKind(r.url) === "pdf" ? "PDF" : "Link"} · ${linkHost(r.url)}${r.body ? " · with notes" : ""}` : "Guide";

/** The full guide, with its link as a button. */
export function ResourceBody({ r }: { r: Resource }) {
  return (
    <article className="card stack">
      <div><span className="chip">{r.category}</span></div>
      <h1 className="h1" style={{ fontSize: 24 }}>{r.title}</h1>
      <div className="tiny">Added {shortDate(r.createdAt)}</div>
      {r.body && <div className="res-body">{r.body}</div>}
      {r.url && safeUrl(r.url) && (
        <a className="btn act block" href={r.url} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", textDecoration: "none" }}>
          {KIND_WORD[linkKind(r.url)]} <span style={{ opacity: 0.75, fontWeight: 500 }}>· {linkHost(r.url)}</span>
        </a>
      )}
    </article>
  );
}
