import { useApexState } from "@apex/core/react";
import { Shell, useToast, type TabDef } from "@apex/ui";
import { useState } from "react";
import { store } from "../store";
import { Chat } from "./screens/Chat";
import { More } from "./screens/More";
import { Player } from "./screens/Player";
import { Progress } from "./screens/Progress";
import { Today } from "./screens/Today";
import { Train } from "./screens/Train";

type Tab = "today" | "train" | "progress" | "chat" | "more";

export function ClientApp() {
  const { messages } = useApexState(store);
  const [tab, setTab] = useState<Tab>("today");
  const [playing, setPlaying] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [toast, say] = useToast();
  const tabs: TabDef<Tab>[] = [
    { id: "today", icon: "today", label: "Today" },
    { id: "train", icon: "train", label: "Train" },
    { id: "progress", icon: "progress", label: "Progress" },
    { id: "chat", icon: "chat", label: "Messages", dot: messages.at(-1)?.from === "coach" },
    { id: "more", icon: "more", label: "More" },
  ];
  const start = () => setPlaying(true);

  if (playing) {
    return <Player onExit={() => setPlaying(false)} onDone={() => { setPlaying(false); setTab("today"); say("Session saved · Coach Kamal can see it"); }} />;
  }
  return (
    <Shell side="Client" switchHref="/" tabs={tabs} tab={tab} setTab={setTab}>
      {tab === "today" && <Today start={start} checkedIn={checkedIn} onCheckIn={() => { setCheckedIn(true); say("Thanks, Kamal will see this"); }} />}
      {tab === "train" && <Train start={start} />}
      {tab === "progress" && <Progress />}
      {tab === "chat" && <Chat />}
      {tab === "more" && <More />}
      {toast}
    </Shell>
  );
}
