import { latestPlanUpdate } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { PlanChangedCard } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../app/AppContext";
import { useStore } from "../data/StoreContext";

const KEY = "apex-plan-update-seen";
const seen = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

/** The newest plan update from the coach, on Today until the client taps "Got it". */
export function PlanChanged() {
  const { messages } = useApexState(useStore());
  const { coachName } = useAppInfo();
  const [done, setDone] = useState(seen);
  const update = latestPlanUpdate(messages);
  if (!update || done === update.key) return null;
  return <PlanChangedCard update={update} coach={coachName} onDone={() => { try { localStorage.setItem(KEY, update.key); } catch { /* this visit only */ } setDone(update.key); }} />;
}
