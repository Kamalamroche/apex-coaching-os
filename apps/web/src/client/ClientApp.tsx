import { useApexState } from "@apex/core/react";
import { Shell, useToast, type TabDef } from "@apex/ui";
import { useEffect, useState } from "react";
import { useAppInfo } from "../app/AppContext";
import { useStore } from "../data/StoreContext";
import { Chat } from "./screens/Chat";
import { More } from "./screens/More";
import { Player } from "./screens/Player";
import { Progress } from "./screens/Progress";
import { Today } from "./screens/Today";
import { Train } from "./screens/Train";

type Tab = "today" | "train" | "progress" | "chat" | "more";

/** `notice`: a one-off message to show on arrival, e.g. after coming back from Strava. */
export function ClientApp({ notice }: { notice?: string | null }) {
  const store = useStore();
  const { coachName, signOut } = useAppInfo();
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
  useEffect(() => {
    if (!notice) return;
    say(notice);
    setTab("train");
  }, [notice, say]);

  if (playing) {
    return <Player onExit={() => setPlaying(false)} onDone={() => { setPlaying(false); setTab("today"); say(`Session saved · ${coachName} can see it`); }} />;
  }
  return (
    <Shell side="Client" switchHref="/start/" tabs={tabs} tab={tab} setTab={setTab} actions={signOut && <button className="iconbtn" onClick={signOut}>Sign out</button>}>
      {tab === "today" && <Today start={start} checkedIn={checkedIn} onCheckIn={() => { setCheckedIn(true); say(`Thanks, ${coachName} will see this`); }} />}
      {tab === "train" && <Train start={start} say={say} />}
      {tab === "progress" && <Progress />}
      {tab === "chat" && <Chat />}
      {tab === "more" && <More say={say} />}
      {toast}
    </Shell>
  );
}
