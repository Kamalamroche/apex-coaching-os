import { useApexState } from "@apex/core/react";
import { Shell, useToast, type TabDef } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../app/AppContext";
import { useStore } from "../data/StoreContext";
import { Chat } from "./screens/Chat";
import { CheckIn } from "./screens/CheckIn";
import { More } from "./screens/More";
import { Player } from "./screens/Player";
import { Progress } from "./screens/Progress";
import { Today } from "./screens/Today";
import { Train } from "./screens/Train";

type Tab = "today" | "train" | "progress" | "chat" | "more";

export function ClientApp() {
  const store = useStore();
  const { coachName, signOut } = useAppInfo();
  const { messages } = useApexState(store);
  const [tab, setTab] = useState<Tab>("today");
  const [playing, setPlaying] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [toast, say] = useToast();
  const tabs: TabDef<Tab>[] = [
    { id: "today", icon: "today", label: "Today" },
    { id: "train", icon: "train", label: "Train" },
    { id: "progress", icon: "progress", label: "Progress" },
    { id: "chat", icon: "chat", label: "Messages", dot: messages.at(-1)?.from === "coach" },
    { id: "more", icon: "more", label: "More" },
  ];
  const start = () => setPlaying(true);
  const openCheckIn = () => { setCheckingIn(true); window.scrollTo(0, 0); };

  if (playing) {
    return <Player onExit={() => setPlaying(false)} onDone={() => { setPlaying(false); setTab("today"); say(`Session saved · ${coachName} can see it`); }} />;
  }
  return (
    <Shell side="Client" switchHref="/" tabs={tabs} tab={tab} setTab={(t) => { setCheckingIn(false); setTab(t); }} actions={signOut && <button className="iconbtn" onClick={signOut}>Sign out</button>}>
      {checkingIn && <CheckIn onExit={() => setCheckingIn(false)} onDone={() => { setCheckingIn(false); setTab("today"); window.scrollTo(0, 0); say(`Check-in sent · ${coachName} can see it`); }} />}
      {!checkingIn && tab === "today" && <Today start={start} checkedIn={checkedIn} onCheckIn={() => { setCheckedIn(true); say(`Thanks, ${coachName} will see this`); }} openCheckIn={openCheckIn} />}
      {!checkingIn && tab === "train" && <Train start={start} />}
      {!checkingIn && tab === "progress" && <Progress say={say} openCheckIn={openCheckIn} />}
      {!checkingIn && tab === "chat" && <Chat />}
      {!checkingIn && tab === "more" && <More />}
      {toast}
    </Shell>
  );
}
