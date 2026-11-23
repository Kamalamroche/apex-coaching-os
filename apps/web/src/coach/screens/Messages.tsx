import { countOn, firstName, type AutomationSettings } from "@apex/core";
import { Avatar, Icons } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { useAppInfo, useStoreStatus } from "../../app/AppContext";
import { Thread } from "../../app/Thread";
import { demoAutomations, liveAutomations } from "../../data/automations";
import type { CoachLiveProps } from "../CoachApp";
import { Automations } from "./Automations";
import { CoachChallenges } from "./CoachChallenges";
import { CoachLiveSession } from "../../app/LiveParts";
import { useLiveLink } from "../../data/live";
import { GroupMessage } from "./GroupMessage";
import { CoachResources } from "./CoachResources";
import { CoachTeam } from "./CoachTeam";
import { useTeamApi } from "../../data/team";


import { demoReplies, liveReplies } from "../../data/savedReplies";
import { CoachAnswers } from "./CoachAnswers";
import { useExtras } from "../../data/extras";
import { useViewScroll } from "../../app/useViewScroll";

/* Loaded when first opened, so the app starts faster. */

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/** The coach's side of the chat: pick a client, read their thread (workout summaries included) and reply. */
export type MessagesStart = "auto" | "group" | "challenges" | "live" | "resources" | "team" | "answers";

export function Messages({ live, say, start }: { live?: CoachLiveProps; say: (m: string) => void; /** Open straight onto one of the tools (from quick find). */ start?: MessagesStart }) {
  const { clientName, coachName } = useAppInfo();
  const liveLink = useLiveLink();
  const coachFirst = (coachName || "Your coach").split(" ")[0]!;
  const { status } = useStoreStatus();
  const clients = live?.clients;
  const api = useMemo(() => (live ? liveAutomations(live.db, live.coachId) : demoAutomations()), [live?.db, live?.coachId]);
  const replies = useMemo(() => (live ? liveReplies(live.db, live.coachId) : demoReplies()), [live?.db, live?.coachId]);
  const [auto, setAuto] = useState(start === "auto");
  const [extra, setExtra] = useState<"group" | "challenges" | "live" | "resources" | "team" | "answers" | null>(() => (start && start !== "auto" ? start : null));
  const teamApi = useTeamApi();
  const extras = useExtras();
  const [on, setOn] = useState<number | null>(null);
  useEffect(() => {
    if (auto) return;
    api.load().then((r: { settings: AutomationSettings }) => setOn(countOn(r.settings)), () => setOn(null));
  }, [api, auto]);
  useViewScroll(auto ? "auto" : extra);
  if (auto) return <Automations api={api} clientNames={Object.fromEntries((clients ?? []).map((c) => [c.id, c.name]))} onBack={() => setAuto(false)} say={say} />;
  if (extra === "group") return <GroupMessage live={live} onBack={() => setExtra(null)} say={say} />;
  if (extra === "challenges") return <CoachChallenges onBack={() => setExtra(null)} say={say} />;
  if (extra === "live" && liveLink) return <CoachLiveSession coach={coachFirst} onBack={() => setExtra(null)} say={say} />;
  if (extra === "team") return <CoachTeam onBack={() => setExtra(null)} say={say} />;
  if (extra === "answers") return <CoachAnswers onBack={() => setExtra(null)} say={say} />;
  if (extra === "resources") return <CoachResources live={live} onBack={() => setExtra(null)} say={say} />;
  // Same tile layout as Business › Your tools, so every tab's tools look and work the same way.
  const tools: { key: string; icon: keyof typeof Icons; colour?: string; title: string; note: string; open: () => void }[] = [
    { key: "auto", icon: "energy", title: "Automatic messages", note: on ? `${on} on · welcome, missed workouts, reminders` : "Welcome, missed workouts, check-in reminders", open: () => setAuto(true) },
    { key: "group", icon: "clients", title: "Message everyone", note: "One message, each in their own chat", open: () => setExtra("group") },
    ...(extras ? [{ key: "answers", icon: "replies" as const, title: "Quick answers", note: "Shown to clients the moment they ask", open: () => setExtra("answers") }] : []),
    ...(liveLink ? [{ key: "live", icon: "play" as const, title: "Live session", note: "Run one timer, clients follow live", open: () => setExtra("live") }] : []),
    { key: "challenges", icon: "trophy", title: "Challenges", note: "Group challenges with a leaderboard", open: () => setExtra("challenges") },
    ...(teamApi ? [{ key: "team", icon: "five" as const, title: "Team", note: "Private feed, high fives, effort board", open: () => setExtra("team") }] : []),
    { key: "resources", icon: "file", title: "Resource library", note: "Guides, videos and links", open: () => setExtra("resources") },
  ];
  const autoButton = (
    <section className="bz-tools-wrap">
      <div className="sect"><h2 className="h3">Your tools</h2></div>
      <div className="bz-tools strip">
        {tools.map((t, i) => {
          const I = Icons[t.icon];
          return (
            <button key={t.key} className="bz-tool" style={{ ["--i" as string]: i }} onClick={t.open} title={t.note}>
              <span className={`mi c${(i % 4) + 1}`}><I /></span>
              <b>{t.title}</b>
              <small>{t.note}</small>
            </button>
          );
        })}
      </div>
    </section>
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
      {status === "loading" ? <div className="small">Loading messages…</div> : status === "error" ? <div className="card small">Couldn't load messages. Reload the page to try again.</div> : <Thread me="coach" to={firstName(clientName)} replies={replies} say={say} />}
    </>
  );
}
