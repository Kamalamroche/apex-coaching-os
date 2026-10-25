import { Shell, useToast, type TabDef } from "@apex/ui";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";
import { useAppInfo } from "../app/AppContext";
import type { CoachLiveInfo } from "./CoachLive";
import { Brief } from "./screens/Brief";
import { Builder } from "./screens/Builder";
import { Business } from "./screens/Business";
import { Clients } from "./screens/Clients";
import { LiveClients } from "./screens/LiveClients";
import { CoachNutrition } from "./screens/Nutrition";

type Tab = "brief" | "clients" | "build" | "food" | "money";
const TABS: TabDef<Tab>[] = [
  { id: "brief", icon: "brief", label: "Brief" },
  { id: "clients", icon: "clients", label: "Clients" },
  { id: "build", icon: "build", label: "Builder" },
  { id: "food", icon: "food", label: "Nutrition" },
  { id: "money", icon: "money", label: "Business" },
];

export type CoachLiveProps = CoachLiveInfo & { db: SupabaseClient; coachId: string };

export function CoachApp({ live }: { live?: CoachLiveProps }) {
  const { signOut } = useAppInfo();
  const [tab, setTab] = useState<Tab>("brief");
  const [clientId, setClientId] = useState<number | null>(null);
  const [toast, say] = useToast();
  const openClient = (id: number) => { setClientId(id); setTab("clients"); };
  const goBuild = () => setTab("build");
  const changeTab = (t: Tab) => { setTab(t); if (t !== "clients") setClientId(null); };
  return (
    <Shell side="Coach" switchHref="/" tabs={TABS} tab={tab} setTab={changeTab} wide={tab === "brief" || tab === "money"} actions={signOut && <button className="iconbtn" onClick={signOut}>Sign out</button>}>
      {tab === "brief" && <Brief openClient={openClient} say={say} clientCount={live?.clients?.length} />}
      {tab === "clients" && (live ? <LiveClients live={live} say={say} goBuild={goBuild} /> : <Clients id={clientId} setId={setClientId} say={say} goBuild={goBuild} />)}
      {tab === "build" && <Builder say={say} onInvite={() => setTab("clients")} />}
      {tab === "food" && <CoachNutrition />}
      {tab === "money" && <Business />}
      {toast}
    </Shell>
  );
}
