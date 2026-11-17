import { laurelBoard, laurelState, liftLadder, type LaurelBoardLine, type LaurelState } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { LadderPage, LadderPeek, LaurelPage, LaurelPeek } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "../data/StoreContext";
import { useTeamApi } from "../data/team";
import { useAppInfo } from "./AppContext";

/** My Laurel rank, and the team board when I'm in the team. The team count wins, as it is what everyone else sees. */
export function useLaurels(): { state: LaurelState; lines: LaurelBoardLine[] | null } {
  const { history } = useApexState(useStore());
  const api = useTeamApi();
  const [lines, setLines] = useState<LaurelBoardLine[] | null>(null);
  useEffect(() => {
    let live = true;
    if (!api) return;
    (async () => {
      try {
        if (!(await api.joined())) return;
        const all = await api.allTime();
        if (live) setLines(laurelBoard(all));
      } catch { /* the board is extra; my own rank still shows */ }
    })();
    return () => { live = false; };
  }, [api]);
  const mine = lines?.find((l) => l.isMe)?.workouts ?? history.sessions?.length ?? 0;
  return { state: laurelState(mine), lines };
}

/** The Laurel ranks row, opening the full page. */
export function LaurelRanks() {
  const { state, lines } = useLaurels();
  const { coachName } = useAppInfo();
  const [open, setOpen] = useState(false);
  return (
    <>
      <LaurelPeek state={state} onOpen={() => setOpen(true)} />
      {open && <LaurelPage state={state} lines={lines} teamTitle={`${coachName}'s team · all time`} onBack={() => setOpen(false)} />}
    </>
  );
}

/** The Lift ladder row on Progress, opening the full page. Every finished session's kg added up. */
export function LiftLadderRow() {
  const { history } = useApexState(useStore());
  const state = useMemo(() => liftLadder((history.sessions ?? []).reduce((a, x) => a + (x.volumeKg || 0), 0)), [history.sessions]);
  const [open, setOpen] = useState(false);
  return (
    <>
      <LadderPeek state={state} onOpen={() => setOpen(true)} />
      {open && <LadderPage state={state} onBack={() => setOpen(false)} />}
    </>
  );
}
