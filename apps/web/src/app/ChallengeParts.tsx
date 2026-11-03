import { challengePhase, formatTotal, localDate, phaseText, rankBoard, shortDate, type BoardLine, type Challenge, type ChallengeLog } from "@apex/core";
import { Bar, Icons } from "@apex/ui";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CHALLENGES_NEED_UPDATE, type ChallengeApi } from "../data/challenges";

export interface ChallengeData {
  status: "loading" | "ready" | "needs-update" | "error";
  error?: string;
  challenges: Challenge[];
  joined: string[];
  logs: ChallengeLog[];
  boards: Record<string, BoardLine[]>;
  reload: () => Promise<void>;
}

/** Loads challenges and each one's leaderboard; again when the window comes back into focus. */
export function useChallenges(api: ChallengeApi | null): ChallengeData {
  const [s, setS] = useState<Omit<ChallengeData, "reload">>({ status: "loading", challenges: [], joined: [], logs: [], boards: {} });
  const reload = useCallback(async () => {
    if (!api) return;
    try {
      const r = await api.load();
      const boards = Object.fromEntries(await Promise.all(r.challenges.map(async (c) => [c.id, await api.board(c.id)] as const)));
      setS({ status: "ready", ...r, boards });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setS((p) => ({ ...p, status: msg === CHALLENGES_NEED_UPDATE ? "needs-update" : "error", error: msg }));
    }
  }, [api]);
  useEffect(() => {
    void reload();
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);
  return { ...s, reload };
}

export function ChallengeStatus({ data }: { data: ChallengeData }) {
  if (data.status === "loading") return <div className="card small">Loading…</div>;
  if (data.status === "needs-update") return <div className="card small">Challenges need a quick database update before they can work. Run the challenges SQL in Supabase, then reload.</div>;
  if (data.status === "error") return <div className="card small" style={{ borderColor: "var(--crit)" }}>Couldn't load challenges: {data.error}</div>;
  return null;
}

/** One challenge: dates, what counts, the leaderboard, and whatever actions the screen adds. */
export function ChallengeCard({ c, board, mine, children }: { c: Challenge; board: BoardLine[]; mine?: number | null; children?: ReactNode }) {
  const today = localDate(new Date());
  const phase = challengePhase(c, today);
  const ranked = rankBoard(board);
  const me = ranked.find((l) => l.isMe);
  const top = ranked.slice(0, 5);
  const shown = me && !top.includes(me) ? [...top, me] : top;
  const leader = ranked[0]?.total ?? 0;
  return (
    <section className="card stack">
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <span className="hb-ico" aria-hidden style={phase === "live" ? { background: "var(--act-soft)", color: "var(--act)" } : undefined}><Icons.trophy /></span>
        <div className="grow">
          <div className="h3">{c.title}</div>
          <div className="tiny">{shortDate(`${c.startsOn}T12:00:00`)} to {shortDate(`${c.endsOn}T12:00:00`)} · <span style={phase === "live" ? { color: "var(--act)", fontWeight: 700 } : undefined}>{phaseText(c, today)}</span></div>
        </div>
        <span className="chip" style={{ flex: "none" }}>{c.metric === "sessions" ? "Counts workouts" : `Log ${c.unit}`}</span>
      </div>
      {c.description && <p className="small" style={{ margin: 0 }}>{c.description}</p>}
      {mine !== undefined && mine !== null && c.goal && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="row" style={{ justifyContent: "space-between" }}><span className="small">You</span><span className="small num"><b style={{ color: "var(--text)" }}>{formatTotal(mine)}</b> of {formatTotal(c.goal)} {c.unit}</span></div>
          <Bar pct={(mine / c.goal) * 100} color="var(--act)" />
        </div>
      )}
      {shown.length > 0 ? (
        <div className="ch-board" role="list" aria-label={`${c.title} leaderboard`}>
          {shown.map((l, i) => (
            <div key={`${l.name}-${i}`} role="listitem" className={`ch-line ${l.isMe ? "me" : ""}`}>
              <span className="num ch-rank" style={l.rank === 1 ? { color: "var(--act)" } : undefined}>{l.rank}</span>
              <span className="grow small" style={{ color: "var(--text)", fontWeight: l.isMe ? 700 : 500 }}>{l.isMe ? `${l.name} (you)` : l.name}</span>
              <span className="ch-bar" aria-hidden><span style={{ width: `${leader ? (l.total / leader) * 100 : 0}%` }} /></span>
              <span className="num small" style={{ minWidth: 64, textAlign: "right", color: "var(--text)" }}>{formatTotal(l.total)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="tiny">Nobody has joined yet.</div>
      )}
      {children}
    </section>
  );
}
