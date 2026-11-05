import { freshMilestone, goalProgress, levelState, localDate, milestones, nextMilestones, type LevelInput, type LevelState, type Milestone } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Celebrate, LevelCard, MilestoneList, MilestoneMoment, Sheet, drawStorySlide, loadStoryFonts } from "@apex/ui";
import { useMemo, useState } from "react";
import { useActivitiesIfAny } from "../data/ActivityContext";
import { useFormChecks } from "../data/FormCheckContext";
import { useGoals } from "../data/GoalContext";
import { useLifestyle } from "../data/LifestyleContext";
import { useStore } from "../data/StoreContext";
import { useAppInfo } from "./AppContext";
import { useGoalInputs } from "./GoalParts";
import { shareCards, siteName } from "./shareImage";
import { milestoneDraft } from "@apex/core";
import { PostToTeam } from "./TeamParts";
import { useTeamApi } from "../data/team";

const SEEN_KEY = "apex-milestones-seen-v1";
const readSeen = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]; } catch { return []; }
};
const writeSeen = (ids: string[]) => {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200))); } catch { /* private mode: shown again next time */ }
};

/** The client's level and milestones, worked out from what they've already done. */
export function useLevels(): { level: LevelState; list: Milestone[]; today: string } {
  const { history, progress } = useApexState(useStore());
  const { activities } = useActivitiesIfAny();
  const life = useLifestyle();
  const form = useFormChecks();
  const { goals } = useGoals();
  const inputs = useGoalInputs();
  const today = localDate(new Date());
  return useMemo(() => {
    const input: LevelInput = {
      sessions: history.sessions ?? [], activities, habits: life.habits, ticks: life.ticks, water: life.water, food: life.food, targets: life.targets,
      checkIns: progress.checkIns.map((c) => c.submittedAt), formChecks: form.checks.length, goalsReached: goals.filter((g) => goalProgress(g, inputs).achieved).length, today,
    };
    return { level: levelState(input), list: milestones(input), today };
  }, [history.sessions, activities, life.habits, life.ticks, life.water, life.food, life.targets, progress.checkIns, form.checks.length, goals, inputs, today]);
}

/** Shares a milestone as a story card. */
export async function shareMilestone(m: Milestone, coach: string | null): Promise<string> {
  await loadStoryFonts();
  const cv = document.createElement("canvas");
  const site = siteName();
  drawStorySlide(cv, { slide: { kind: "milestone", title: m.title, value: m.value, unit: m.unit, sub: m.sub }, format: "story", t: 1, week: "", coach, site });
  return shareCards([cv], `apex-${m.id}`, `${m.title}. ${coach ? `Coached by ${coach} on APEX.` : "Tracked on APEX."} https://${site}`);
}

/** A milestone reached in the last few days, shown once on Today with a little confetti. */
export function FreshMilestone({ list, today, say }: { list: Milestone[]; today: string; say?: (m: string) => void }) {
  const { coachName } = useAppInfo();
  const [seen, setSeen] = useState(readSeen);
  const [posting, setPosting] = useState(false);
  const team = useTeamApi();
  const m = freshMilestone(list, today, seen);
  if (!m) return null;
  const done = () => { const next = [...seen, m.id]; writeSeen(next); setSeen(next); };
  return (
    <>
      <Celebrate />
      <MilestoneMoment m={m} onClose={done} onShare={() => void shareMilestone(m, coachName || null).then((s) => { if (s) say?.(s); done(); })} onPost={team ? () => setPosting(true) : undefined} />
      {posting && <PostToTeam draft={milestoneDraft(m)} say={say} onClose={() => { setPosting(false); done(); }} />}
    </>
  );
}

/** The levels sheet: level up close, how points are earned, next and reached milestones. */
export function LevelsSheet({ onClose, say }: { onClose: () => void; say?: (m: string) => void }) {
  const { level, list } = useLevels();
  const { coachName } = useAppInfo();
  const next = nextMilestones(list, 4);
  const earned = list.filter((m) => m.earned).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  const share = (id: string) => {
    const m = list.find((x) => x.id === id);
    if (m) void shareMilestone(m, coachName || null).then((s) => s && say?.(s));
  };
  return (
    <Sheet onClose={onClose} label="Your level">
      <div className="sect"><h3 className="h3">Your level</h3><button className="btn ghost sm" onClick={onClose}>Close</button></div>
      <LevelCard level={level} />
      {next.length > 0 && (
        <section>
          <div className="sect" style={{ marginBottom: 2 }}><h3 className="h3">Next milestones</h3></div>
          <MilestoneList list={next} />
        </section>
      )}
      {earned.length > 0 && (
        <section>
          <div className="sect" style={{ marginBottom: 2 }}><h3 className="h3">Reached · <span className="num">{earned.length}</span></h3></div>
          <MilestoneList list={earned} onShare={(m) => share(m.id)} />
        </section>
      )}
      <section>
        <div className="sect" style={{ marginBottom: 6 }}><h3 className="h3">How you earn points</h3></div>
        <ul className="lv-lines">
          {level.lines.map((l) => (
            <li key={l.key}><span>{l.label} · {l.count}</span><b className="num">{l.points.toLocaleString("en-GB")}</b></li>
          ))}
          {!level.lines.length && <li>Finish a workout, close a ring or send a check-in to earn your first points.</li>}
        </ul>
        <div className="tiny" style={{ marginTop: 8 }}>Workouts 100 · personal bests 40 · cardio 40 · each ring 10 · all three rings +20 · check-ins 50 · form checks 30 · goals 150.</div>
      </section>
    </Sheet>
  );
}
