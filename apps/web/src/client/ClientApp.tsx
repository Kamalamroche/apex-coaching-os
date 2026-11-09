import { useApexState } from "@apex/core/react";
import { Shell, useT, useToast, type TabDef } from "@apex/ui";
import { useEffect, useState } from "react";
import { OfflineBanner, useAppInfo } from "../app/AppContext";
import { useOpenFromNotification } from "../app/PushParts";
import { useStore } from "../data/StoreContext";
import { Chat } from "./screens/Chat";
import { CheckIn } from "./screens/CheckIn";
import { Intake } from "./screens/Intake";
import { More, type MoreView } from "./screens/More";
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
  const [checkingIn, setCheckingIn] = useState(false);
  const [intaking, setIntaking] = useState(false);
  // Opens More straight on a screen, e.g. Team from Today.
  const [moreStart, setMoreStart] = useState<{ view: MoreView; n: number } | null>(null);
  const [toast, say] = useToast();
  const t = useT();
  const tabs: TabDef<Tab>[] = [
    { id: "today", icon: "today", label: "Today" },
    { id: "train", icon: "train", label: "Train" },
    { id: "progress", icon: "progress", label: "Progress" },
    { id: "chat", icon: "chat", label: "Messages", dot: messages.at(-1)?.from === "coach" },
    { id: "more", icon: "more", label: "More" },
  ];
  useOpenFromNotification<Tab>({ chat: "chat", today: "today" }, (t) => { setCheckingIn(false); setIntaking(false); setTab(t); });
  const start = () => setPlaying(true);
  const openCheckIn = () => { setCheckingIn(true); window.scrollTo(0, 0); };
  const openIntake = () => { setIntaking(true); window.scrollTo(0, 0); };
  useEffect(() => {
    if (!notice) return;
    say(notice);
  }, [notice, say]);

  if (playing) {
    return <Player onExit={() => setPlaying(false)} onDone={() => { setPlaying(false); setTab("today"); say(`Session saved · ${coachName} can see it`); }} />;
  }
  return (
    <Shell side="Client" switchHref="/start/" tabs={tabs} tab={tab} setTab={(t) => { setCheckingIn(false); setIntaking(false); setMoreStart(null); setTab(t); }} actions={signOut && <button className="iconbtn" onClick={signOut}>{t("Sign out")}</button>}>
      <OfflineBanner />
      {checkingIn && !intaking && <CheckIn onExit={() => setCheckingIn(false)} onDone={() => { setCheckingIn(false); setTab("today"); window.scrollTo(0, 0); say(`Check-in sent · ${coachName} can see it`); }} />}
      {intaking && <Intake onExit={() => setIntaking(false)} onDone={() => { setIntaking(false); setTab("today"); window.scrollTo(0, 0); say(`Sent · ${coachName} can see your answers`); }} />}
      {!checkingIn && !intaking && tab === "today" && <Today start={start} checkedIn={checkedIn} onCheckIn={() => { setCheckedIn(true); say(`Thanks, ${coachName} will see this`); }} openCheckIn={openCheckIn} openIntake={openIntake} say={say} openTeam={() => { setMoreStart((p) => ({ view: "team", n: (p?.n ?? 0) + 1 })); setTab("more"); window.scrollTo(0, 0); }} go={(id) => {
        const more = (view: "account" | "habits") => { setMoreStart((p) => ({ view, n: (p?.n ?? 0) + 1 })); setTab("more"); window.scrollTo(0, 0); };
        if (id === "intake") openIntake(); else if (id === "checkin") openCheckIn(); else if (id === "notifications") more("account"); else if (id === "habit") more("habits");
        else { setTab(id === "hello" ? "chat" : "train"); window.scrollTo(0, 0); }
      }} />}
      {!checkingIn && !intaking && tab === "train" && <Train start={start} say={say} />}
      {!checkingIn && !intaking && tab === "progress" && <Progress say={say} openCheckIn={openCheckIn} />}
      {!checkingIn && !intaking && tab === "chat" && <Chat />}
      {!checkingIn && !intaking && tab === "more" && <More key={moreStart?.n ?? 0} say={say} start={moreStart?.view ?? null} goTrain={() => { setTab("train"); window.scrollTo(0, 0); }} />}
      {toast}
    </Shell>
  );
}
