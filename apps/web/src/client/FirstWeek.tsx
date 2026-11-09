import { firstWeekProgress, firstWeekSteps, showFirstWeek, type FirstWeekStepId } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { FirstWeekCard } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { useAppInfo } from "../app/AppContext";
import { browserPushSupport } from "../data/push";
import { useLifestyle } from "../data/LifestyleContext";
import { useStore } from "../data/StoreContext";

const HIDE_KEY = "apex-first-week-hidden";
const DONE_KEY = "apex-first-week-done";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* this visit only */ } };

/** The first-week journey for new clients. Steps tick themselves from what the client has really done. */
export function useFirstWeek() {
  const store = useStore();
  const { history, progress, messages } = useApexState(store);
  const life = useLifestyle();
  const { coachName } = useAppInfo();
  const support = browserPushSupport();
  const steps = useMemo(() => firstWeekSteps({
    hasIntake: !!life.intake,
    notificationsOn: support === "unsupported" ? null : support === "granted",
    sessions: history.sessions?.length ?? 0,
    habitTicks: life.ticks.length,
    foodLogged: life.food.length,
    messagesFromClient: messages.filter((m) => m.from === "client").length,
    checkIns: progress.checkIns.length,
    coach: coachName,
  }), [life.intake, life.ticks.length, life.food.length, support, history.sessions?.length, messages, progress.checkIns.length, coachName]);
  const progressNow = firstWeekProgress(steps);
  const [hidden, setHidden] = useState(() => read(HIDE_KEY) === "1");
  const [doneAt, setDoneAt] = useState<number | null>(() => Number(read(DONE_KEY)) || null);
  useEffect(() => {
    if (progressNow.complete && !doneAt) { const t = Date.now(); write(DONE_KEY, String(t)); setDoneAt(t); }
  }, [progressNow.complete, doneAt]);
  const ready = life.status === "ready";
  const visible = ready && showFirstWeek(progressNow, { dismissed: hidden, completedAt: doneAt, now: Date.now() });
  return { steps, progress: progressNow, visible, hide: () => { write(HIDE_KEY, "1"); setHidden(true); } };
}

export function FirstWeek({ go }: { go: (id: FirstWeekStepId) => void }) {
  const fw = useFirstWeek();
  if (!fw.visible) return null;
  return <FirstWeekCard steps={fw.steps} progress={fw.progress} onStep={go} onHide={fw.hide} />;
}
