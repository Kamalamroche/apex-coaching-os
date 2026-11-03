import { challengePhase, formatTotal, localDate, myTotal, parseNumber, type Challenge } from "@apex/core";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { ChallengeCard, ChallengeStatus, useChallenges, type ChallengeData } from "../../app/ChallengeParts";
import { useChallengeApi } from "../../data/challenges";

/** Client: the coach's challenges, joining, logging today's number, and the leaderboard. */
export function Challenges({ say }: { say: (m: string) => void }) {
  const api = useChallengeApi();
  const data = useChallenges(api);
  const { coachName } = useAppInfo();
  if (!api) return null;
  const today = localDate(new Date());
  const open = data.challenges.filter((c) => challengePhase(c, today) !== "ended");
  const ended = data.challenges.filter((c) => challengePhase(c, today) === "ended");

  const act = async (fn: () => Promise<void>, done: string) => {
    try {
      await fn();
      say(done);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
    }
    await data.reload();
  };

  return (
    <>
      <div><div className="eyebrow">Challenges</div><h1 className="h1">Train together</h1></div>
      <ChallengeStatus data={data} />
      {data.status === "ready" && data.challenges.length === 0 && <div className="card small">No challenges right now. {coachName} will start one soon.</div>}
      {open.map((c) => (
        <Entry key={c.id} c={c} data={data} onJoin={() => act(() => api.join(c.id), `You're in · ${c.title}`)} onLeave={() => act(() => api.leave(c.id), "Left the challenge")} onLog={(v) => act(() => api.log(c.id, today, v), "Logged")} />
      ))}
      {ended.length > 0 && <div className="sect" style={{ marginTop: 6 }}><h2 className="h2">Finished</h2></div>}
      {ended.map((c) => <ChallengeCard key={c.id} c={c} board={data.boards[c.id] ?? []} />)}
    </>
  );
}

function Entry({ c, data, onJoin, onLeave, onLog }: { c: Challenge; data: ChallengeData; onJoin: () => void; onLeave: () => void; onLog: (v: number) => void }) {
  const today = localDate(new Date());
  const joined = data.joined.includes(c.id);
  const live = challengePhase(c, today) === "live";
  const todays = data.logs.find((l) => l.challengeId === c.id && l.day === today)?.value;
  const [v, setV] = useState(todays !== undefined ? String(todays) : "");
  const n = parseNumber(v);
  const mine = c.metric === "sessions" ? (data.boards[c.id] ?? []).find((l) => l.isMe)?.total ?? 0 : myTotal(data.logs, c.id);
  return (
    <ChallengeCard c={c} board={data.boards[c.id] ?? []} mine={joined ? mine : null}>
      {!joined && <button className="btn act block" onClick={onJoin}>Join challenge</button>}
      {joined && c.metric === "logged" && live && (
        <div className="row" style={{ gap: 8 }}>
          <label className="small grow" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ whiteSpace: "nowrap" }}>Today</span>
            <input className="field num" inputMode="decimal" aria-label={`Today's ${c.unit}`} placeholder={`0 ${c.unit}`} value={v} onChange={(e) => setV(e.target.value)} style={{ minWidth: 0 }} />
          </label>
          <button className="btn act" disabled={n === null || n < 0 || n === todays} onClick={() => n !== null && onLog(n)}>{todays !== undefined ? "Update" : "Log"}</button>
        </div>
      )}
      {joined && c.metric === "sessions" && live && <div className="tiny">Every workout you finish counts. {formatTotal(mine)} so far.</div>}
      {joined && <button className="btn ghost" style={{ alignSelf: "flex-start", fontSize: 13, padding: "6px 10px" }} onClick={onLeave}>Leave</button>}
    </ChallengeCard>
  );
}
