import { Shell, useToast, type TabDef } from "@apex/ui";
import type { SupabaseClient } from "@supabase/supabase-js";
import { firstName } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { useEffect, useRef, useState } from "react";
import { useAppInfo, useStoreStatus } from "../app/AppContext";
import { useStore } from "../data/StoreContext";
import type { CoachLiveInfo } from "./CoachLive";
import { Brief } from "./screens/Brief";
import { Builder } from "./screens/Builder";
import { Business } from "./screens/Business";
import { Clients } from "./screens/Clients";
import { LiveClients } from "./screens/LiveClients";
import { Messages } from "./screens/Messages";
import { CoachNutrition } from "./screens/Nutrition";
import { CoachGym } from "./screens/CoachGym";
import { acceptGymInvite, gymInviteNote, useGymApi } from "../data/gym";
import { AccountScreen } from "../app/Privacy";
import { BackLink } from "@apex/ui";

type Tab = "brief" | "clients" | "chat" | "build" | "food" | "money";
const TABS: TabDef<Tab>[] = [
  { id: "brief", icon: "brief", label: "Brief" },
  { id: "clients", icon: "clients", label: "Clients" },
  { id: "chat", icon: "chat", label: "Messages" },
  { id: "build", icon: "build", label: "Builder" },
  { id: "food", icon: "food", label: "Nutrition" },
  { id: "money", icon: "money", label: "Business" },
];

export type CoachLiveProps = CoachLiveInfo & { db: SupabaseClient; coachId: string };

export function CoachApp({ live }: { live?: CoachLiveProps }) {
  const { signOut } = useAppInfo();
  const { messages } = useApexState(useStore());
  // A dot on Messages while the client has the last word.
  const tabs = TABS.map((t) => (t.id === "chat" ? { ...t, dot: messages.at(-1)?.from === "client" } : t));
  const [tab, setTab] = useState<Tab>("brief");
  const [clientId, setClientId] = useState<number | null>(null);
  const [account, setAccount] = useState(false);
  const [gym, setGym] = useState(false);
  const gymApi = useGymApi();
  const [toast, say] = useToast();
  useFinishedAlert(say);
  useGymInviteLink(live?.db, () => { setAccount(false); setTab("money"); setGym(true); });
  const openClient = (id: number) => { setClientId(id); setTab("clients"); };
  const goBuild = () => setTab("build");
  const changeTab = (t: Tab) => { setAccount(false); setGym(false); setTab(t); if (t !== "clients") setClientId(null); };
  return (
    <Shell side="Coach" switchHref="/start/" tabs={tabs} tab={tab} setTab={changeTab} wide={tab === "brief" || (tab === "money" && !gym) || tab === "build"} actions={<><button className="iconbtn" aria-pressed={account} onClick={() => setAccount((a) => !a)}>Account</button>{signOut && <button className="iconbtn" onClick={signOut}>Sign out</button>}</>}>
      {account && <><div className="full"><BackLink onClick={() => setAccount(false)}>Back</BackLink></div><AccountScreen say={say} /></>}
      {!account && tab === "brief" && <Brief openClient={openClient} say={say} clientCount={live?.clients?.length} clients={live?.clients} />}
      {!account && tab === "clients" && (live ? <LiveClients live={live} say={say} goBuild={goBuild} /> : <Clients id={clientId} setId={setClientId} say={say} goBuild={goBuild} />)}
      {!account && tab === "chat" && <Messages live={live} say={say} />}
      {!account && tab === "build" && <Builder say={say} onInvite={() => setTab("clients")} live={live} />}
      {!account && tab === "food" && <CoachNutrition live={live} say={say} />}
      {!account && tab === "money" && (gym && gymApi ? <CoachGym onBack={() => setGym(false)} say={say} /> : <Business openGym={gymApi ? () => setGym(true) : undefined} />)}
      {toast}
    </Shell>
  );
}

/** A coach who opened a gym invite link (/coach/?gym=…): join the gym, drop the token from the address, open the Gym screen. */
function useGymInviteLink(db: SupabaseClient | undefined, show: () => void) {
  const done = useRef(false);
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("gym");
    if (!token || !db || done.current) return;
    done.current = true;
    history.replaceState(null, "", location.pathname);
    void acceptGymInvite(db, token).then(
      (name) => { gymInviteNote.text = `Welcome to ${name}. You're in the team.`; },
      (e: unknown) => { gymInviteNote.text = e instanceof Error ? e.message : String(e); },
    ).then(show);
  }, [db, show]);
}

/** Toasts the coach when the client finishes a session while the app is open, whatever tab they are on. */
function useFinishedAlert(say: (m: string) => void) {
  const store = useStore();
  const { clientName } = useAppInfo();
  const { status } = useStoreStatus();
  const { log } = useApexState(store);
  // What was already there when this client's data loaded; only a change after that is news.
  const seen = useRef<{ store: unknown; key: string } | null>(null);
  useEffect(() => {
    if (status !== "ready") return;
    const key = log ? JSON.stringify(log) : "";
    if (seen.current?.store !== store) {
      seen.current = { store, key };
      return;
    }
    if (key && key !== seen.current.key && log) say(`${firstName(clientName) || "Your client"} finished ${log.workoutName}${log.prs ? ` · ${log.prs} PR` : ""}`);
    seen.current.key = key;
  }, [store, status, log, clientName, say]);
}
