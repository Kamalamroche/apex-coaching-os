import { groupResources, type Resource } from "@apex/core";
import { BackLink } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { ResourceBody, ResourceIcon, ResourceStatus, resourceMeta, useResources } from "../../app/ResourceParts";
import { useResourceApi } from "../../data/resources";

/** Client: guides and links from the coach, by topic. */
export function Resources() {
  const data = useResources(useResourceApi());
  const { coachName } = useAppInfo();
  const [open, setOpen] = useState<Resource | null>(null);
  if (open) return <><BackLink onClick={() => setOpen(null)}>Resources</BackLink><ResourceBody r={open} /></>;
  return (
    <>
      <div><div className="eyebrow">Resources</div><h1 className="h1">From {coachName}</h1></div>
      <ResourceStatus data={data} />
      {data.status === "ready" && data.list.length === 0 && <div className="card small">Nothing here yet. {coachName} will add guides and videos for you.</div>}
      {groupResources(data.list).map((g) => (
        <section key={g.category}>
          <div className="sect"><h2 className="h3">{g.category}</h2></div>
          <div className="card flat list">
            {g.items.map((r) => (
              <button key={r.id} className="li" onClick={() => setOpen(r)}>
                <ResourceIcon r={r} />
                <div className="grow"><div className="h3">{r.title}</div><div className="tiny">{resourceMeta(r)}{r.clientId ? " · just for you" : ""}</div></div>
                <span className="tiny">›</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
