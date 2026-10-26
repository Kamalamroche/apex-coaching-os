import { firstName } from "@apex/core";
import { Avatar } from "@apex/ui";
import { useAppInfo, useStoreStatus } from "../../app/AppContext";
import { Thread } from "../../app/Thread";
import type { CoachLiveProps } from "../CoachApp";

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/** The coach's side of the chat: pick a client, read their thread (workout summaries included) and reply. */
export function Messages({ live }: { live?: CoachLiveProps }) {
  const { clientName } = useAppInfo();
  const { status } = useStoreStatus();
  const clients = live?.clients;
  if (live && clients?.length === 0) {
    return (
      <>
        <div><div className="eyebrow">Messages</div><h1 className="h1">No clients yet</h1></div>
        <div className="card small">Invite a client from the Clients tab and your conversation with them will appear here.</div>
      </>
    );
  }
  return (
    <>
      <div><div className="eyebrow">Messages</div><h1 className="h1" style={{ fontSize: 22 }}>{clientName || "Loading…"}</h1></div>
      {live && clients && clients.length > 1 && (
        <div className="chips" role="tablist" aria-label="Client">
          {clients.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === live.activeClientId} className={`chip ${c.id === live.activeClientId ? "on" : ""}`} onClick={() => live.setActiveClientId(c.id)}>
              <Avatar initials={initials(c.name)} size={18} /> {firstName(c.name)}
            </button>
          ))}
        </div>
      )}
      {status === "loading" ? <div className="small">Loading messages…</div> : status === "error" ? <div className="card small">Couldn't load messages. Reload the page to try again.</div> : <Thread me="coach" to={firstName(clientName)} />}
    </>
  );
}
