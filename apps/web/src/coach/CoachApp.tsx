import { Shell, useToast, type TabDef } from "@apex/ui";
import { useState } from "react";
import { Brief } from "./screens/Brief";
import { Builder } from "./screens/Builder";
import { Business } from "./screens/Business";
import { Clients } from "./screens/Clients";
import { CoachNutrition } from "./screens/Nutrition";

type Tab = "brief" | "clients" | "build" | "food" | "money";
const TABS: TabDef<Tab>[] = [
  { id: "brief", icon: "brief", label: "Brief" },
  { id: "clients", icon: "clients", label: "Clients" },
  { id: "build", icon: "build", label: "Builder" },
  { id: "food", icon: "food", label: "Nutrition" },
  { id: "money", icon: "money", label: "Business" },
];

export function CoachApp() {
  const [tab, setTab] = useState<Tab>("brief");
  const [clientId, setClientId] = useState<number | null>(null);
  const [toast, say] = useToast();
  const openClient = (id: number) => { setClientId(id); setTab("clients"); };
  const goBuild = () => setTab("build");
  const changeTab = (t: Tab) => { setTab(t); if (t !== "clients") setClientId(null); };
  return (
    <Shell side="Coach" switchHref="/" tabs={TABS} tab={tab} setTab={changeTab} wide={tab === "brief" || tab === "money"}>
      {tab === "brief" && <Brief openClient={openClient} say={say} />}
      {tab === "clients" && <Clients id={clientId} setId={setClientId} say={say} goBuild={goBuild} />}
      {tab === "build" && <Builder say={say} />}
      {tab === "food" && <CoachNutrition />}
      {tab === "money" && <Business />}
      {toast}
    </Shell>
  );
}
