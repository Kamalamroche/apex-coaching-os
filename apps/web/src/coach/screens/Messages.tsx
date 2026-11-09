import { countOn, firstName, type AutomationSettings } from "@apex/core";
import { Avatar, Icons } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { useAppInfo, useStoreStatus } from "../../app/AppContext";
import { Thread } from "../../app/Thread";
import { demoAutomations, liveAutomations } from "../../data/automations";
import type { CoachLiveProps } from "../CoachApp";
import { Automations } from "./Automations";
import { CoachChallenges } from "./CoachChallenges";
import { GroupMessage } from "./GroupMessage";
import { CoachResources } from "./CoachResources";
import { CoachTeam } from "./CoachTeam";
import { useTeamApi } from "../../data/team";
import { openedForLeads, useGrowthApi } from "../../data/growth";
import { CoachGrow } from "./CoachGrow";

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/** The coach's side of the chat: pick a client, read their thread (workout summaries included) and reply. */
export function Messages({ live, say }: { live?: CoachLiveProps; say: (m: string) => void }) {
  const { clientName } = useAppInfo();
  const { status } = useStoreStatus();
  const clients = live?.clients;
  const api = useMemo(() => (live ? liveAutomations(live.db, live.coachId) : demoAutomations()), [live?.db, live?.coachId]);
  const [auto, setAuto] = useState(false);
  const [extra, setExtra] = useState<"group" | "challenges" | "resources" | "team" | "grow" | null>(() => (openedForLeads() ? "grow" : null));
  const teamApi = useTeamApi();
  const growApi = useGrowthApi();
  const [on, setOn] = useState<number | null>(null);
  useEffect(() => {
    if (auto) return;
    api.load().then((r: { settings: AutomationSettings }) => setOn(countOn(r.settings)), () => setOn(null));
  }, [api, auto]);
  if (auto) return <Automations api={api} clientNames={Object.fromEntries((clients ?? []).map((c) => [c.id, c.name]))} onBack={() => setAuto(false)} say={say} />;
  if (extra === "group") return <GroupMessage live={live} onBack={() => setExtra(null)} say={say} />;
  if (extra === "challenges") return <CoachChallenges onBack={() => setExtra(null)} say={say} />;
  if (extra === "team") return <CoachTeam onBack={() => setExtra(null)} say={say} />;
  if (extra === "grow") return <CoachGrow onBack={() => setExtra(null)} say={say} />;
  if (extra === "resources") return <CoachResources live={live} onBack={() => setExtra(null)} say={say} />;
  const autoButton = (
    <div className="card flat list">
      <button className="li" onClick={() => setAuto(true)}>
        <Icons.energy width={18} height={18} style={{ color: "var(--act)" }} />
        <div className="grow"><div className="h3">Automatic messages</div><div className="tiny">{on ? `${on} on · welcome, missed workouts, check-in reminders` : "Welcome, missed workouts, check-in reminders"}</div></div>
        <span className="tiny">›</span>
      </button>
      <button className="li" onClick={() => setExtra("group")}>
        <Icons.clients width={18} height={18} style={{ color: "var(--act)" }} />
        <div className="grow"><div className="h3">Message everyone</div><div className="tiny">One message to all your clients, each in their own chat</div></div>
        <span className="tiny">›</span>
      </button>
      <button className="li" onClick={() => setExtra("challenges")}>
        <Icons.trophy width={18} height={18} style={{ color: "var(--act)" }} />
        <div className="grow"><div className="h3">Challenges</div><div className="tiny">Group challenges with a leaderboard</div></div>
        <span className="tiny">›</span>
      </button>
      {teamApi && (
        <button className="li" onClick={() => setExtra("team")}>
          <Icons.five width={18} height={18} style={{ color: "var(--act)" }} />
          <div className="grow"><div className="h3">Team</div><div className="tiny">Private feed, high fives and the weekly effort board</div></div>
          <span className="tiny">›</span>
        </button>
      )}
      {growApi && (
        <button className="li" onClick={() => setExtra("grow")}>
          <Icons.globe width={18} height={18} style={{ color: "var(--act)" }} />
          <div className="grow"><div className="h3">Train with me</div><div className="tiny">Leads, your enquiry form and welcome email, your public page</div></div>
          <span className="tiny">›</span>
        </button>
      )}
      <button className="li" onClick={() => setExtra("resources")}>
        <Icons.file width={18} height={18} style={{ color: "var(--act)" }} />
        <div className="grow"><div className="h3">Resource library</div><div className="tiny">Guides, videos and links for your clients</div></div>
        <span className="tiny">›</span>
      </button>
    </div>
  );
  if (live && clients?.length === 0) {
    return (
      <>
        <div><div className="eyebrow">Messages</div><h1 className="h1">No clients yet</h1></div>
        <div className="card small">Invite a client from the Clients tab and your conversation with them will appear here.</div>
        {autoButton}
      </>
    );
  }
  return (
    <>
      <div><div className="eyebrow">Messages</div><h1 className="h1" style={{ fontSize: 22 }}>{clientName || "Loading…"}</h1></div>
      {autoButton}
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
