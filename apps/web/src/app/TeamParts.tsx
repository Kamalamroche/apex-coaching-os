import { cardioWeek, distanceDraft, levelDraft, localDate, milestoneDraft, mondayOf, teamName, toggleFive, workoutDraft, type EffortLine, type TeamDraft, type TeamPost } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Icons, Sheet, TEAM_ART, TeamDraftPreview, teamInitials, type IconName } from "@apex/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActivitiesIfAny } from "../data/ActivityContext";
import { useStore } from "../data/StoreContext";
import { TEAM_NEEDS_UPDATE, effortWeekLabel, useTeamApi, type TeamApi } from "../data/team";
import { useAppInfo } from "./AppContext";
import { useLevels } from "./LevelParts";

export interface TeamData {
  status: "loading" | "ready" | "needs-update" | "error";
  error?: string;
  joined: boolean;
  posts: TeamPost[];
  effort: EffortLine[];
  reload: () => Promise<void>;
  five: (id: string) => void;
}

/** Loads the team feed and effort board; again when the window comes back into focus. */
export function useTeam(api: TeamApi | null): TeamData {
  const [s, setS] = useState<Omit<TeamData, "reload" | "five">>({ status: "loading", joined: false, posts: [], effort: [] });
  const reload = useCallback(async () => {
    if (!api) return;
    try {
      const joined = await api.joined();
      const [posts, effort] = joined ? await Promise.all([api.feed(), api.effort()]) : [[], []];
      setS({ status: "ready", joined, posts, effort });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setS((p) => ({ ...p, status: msg === TEAM_NEEDS_UPDATE ? "needs-update" : "error", error: msg }));
    }
  }, [api]);
  useEffect(() => {
    void reload();
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);
  const postsRef = useRef(s.posts);
  postsRef.current = s.posts;
  // The hand lights up at once; the server catches up, and a failure puts it back.
  const five = useCallback((id: string) => {
    if (!api) return;
    const on = !postsRef.current.find((x) => x.id === id)?.iFived;
    postsRef.current = toggleFive(postsRef.current, id);
    setS((p) => ({ ...p, posts: toggleFive(p.posts, id) }));
    api.five(id, on).catch(() => void reload());
  }, [api, reload]);
  return { ...s, reload, five };
}

export function TeamStatus({ data }: { data: TeamData }) {
  if (data.status === "loading") return <div className="card small">Loading…</div>;
  if (data.status === "needs-update") return <div className="card small">The team needs a quick database update before it can work. Run the team SQL in Supabase, then reload.</div>;
  if (data.status === "error") return <div className="card small" style={{ borderColor: "var(--crit)" }}>Couldn't load the team: {data.error}</div>;
  return null;
}

/** Things the client could post right now, from what they've already done. Nothing goes without them tapping Post. */
export function useTeamSuggestions(): { icon: IconName; label: string; draft: TeamDraft }[] {
  const { history } = useApexState(useStore());
  const { activities } = useActivitiesIfAny();
  const { level, list } = useLevels();
  return useMemo(() => {
    const out: { icon: IconName; label: string; draft: TeamDraft }[] = [];
    const last = history.sessions?.[0];
    if (last) out.push({ icon: "train", label: last.workoutName, draft: workoutDraft({ workoutName: last.workoutName, sets: last.sets, minutes: last.minutes, prs: last.bests.length }) });
    const newest = list.filter((m) => m.earned).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0];
    if (newest) out.push({ icon: "trophy", label: newest.title, draft: milestoneDraft(newest) });
    const km = distanceDraft(cardioWeek(activities, mondayOf(localDate(new Date()))), effortWeekLabel());
    if (km) out.push({ icon: "run", label: "This week's distance", draft: km });
    if (level.level > 1) out.push({ icon: "spark", label: `Level ${level.level}`, draft: levelDraft(level.level, level.name) });
    return out;
  }, [history.sessions, activities, level.level, level.name, list]);
}

/** Shows the post as the team will see it. Joining, if needed, happens here too, so nothing is shared by surprise. */
export function PostToTeam({ draft, onClose, say }: { draft: TeamDraft; onClose: () => void; say?: (m: string) => void }) {
  const api = useTeamApi();
  const { clientName, coachName } = useAppInfo();
  const [joined, setJoined] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => { api?.joined().then(setJoined, () => setJoined(false)); }, [api]);
  if (!api) return null;
  const post = async () => {
    setBusy(true);
    setProblem(null);
    try {
      if (!joined) await api.join();
      await api.post(draft);
      setDone(true);
      say?.("Posted to your team");
      setTimeout(onClose, 900);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setProblem(msg === TEAM_NEEDS_UPDATE ? "The team isn't set up yet. Ask your coach to run the team update." : msg);
    }
    setBusy(false);
  };
  return (
    <Sheet onClose={onClose} label="Post to your team">
      <div className="sect"><h3 className="h3">Post to your team</h3><button className="btn ghost sm" onClick={onClose}>Cancel</button></div>
      <p className="small" style={{ margin: 0 }}>This is exactly what {coachName}'s team will see.</p>
      <TeamDraftPreview draft={draft} author={teamName(clientName)} />
      {joined === false && <div className="tiny">You'll join {coachName}'s team. Only what you choose to post is shared, never weight, measurements or photos. Leave any time.</div>}
      {problem && <div className="small" style={{ color: "var(--crit)" }}>{problem}</div>}
      <button className="btn act block" style={{ minHeight: 50 }} disabled={busy || done || joined === null} onClick={() => void post()}>
        {done ? <><Icons.check width={18} height={18} /> Posted</> : joined === false ? "Join the team and post" : "Post"}
      </button>
    </Sheet>
  );
}

/** A slim row on Today: who posted last and how many high fives are waiting, or an invite to join. */
export function TeamPeek({ onOpen }: { onOpen: () => void }) {
  const api = useTeamApi();
  const data = useTeam(api);
  const { coachName } = useAppInfo();
  if (!api || data.status !== "ready") return null;
  const latest = data.posts[0];
  const faces = [...new Map(data.posts.map((p) => [p.author, p])).values()].slice(0, 3);
  const mine = data.posts.filter((p) => p.isMe).reduce((a, p) => a + p.fives, 0);
  return (
    <button className="tm-peek poster" onClick={onOpen}>
      <img src={TEAM_ART.src} alt="" />
      <span className="tm-peek-word" aria-hidden="true">TEAM</span>
      {data.joined && faces.length ? (
        <span className="tm-avs" aria-hidden="true">{faces.map((p, i) => <span key={p.author} className={`tm-av${p.isCoach ? " coach" : ""}`} style={{ ["--i" as string]: i }}>{teamInitials(p.author)}</span>)}</span>
      ) : (
        <span className="tm-peek-ico" aria-hidden="true"><Icons.five width={18} height={18} /></span>
      )}
      <span className="grow">
        <b>{data.joined ? "Your team" : `Join ${coachName}'s team`}</b>
        <small>{data.joined ? (latest ? `${latest.isMe ? "You" : latest.author}: ${latest.title}` : "Be the first to post") : "High fives and a weekly effort board. You choose what to share."}</small>
      </span>
      {data.joined && mine > 0 && <span className="chip num" style={{ flex: "none", color: "var(--act)" }}><Icons.five width={13} height={13} /> {mine}</span>}
      <Icons.forward width={16} height={16} style={{ flex: "none", color: "var(--text3)" }} />
    </button>
  );
}
