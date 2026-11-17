import {
  GOAL_KINDS, badges, bestHabitRun, daysToGo, exerciseById, goalProblem, goalProgress, goalTitle, localDate, measurementSeries, newGoal, parseNumber, searchExercises, shortDate,
  type Badge, type Goal, type GoalInputs, type GoalKind, type GoalState,
} from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Bar, Icons, Label, LiquidPill, NumberField, useUnits } from "@apex/ui";
import { useMemo, useState } from "react";
import { useFormChecks } from "../data/FormCheckContext";
import { useGoals } from "../data/GoalContext";
import { useLifestyle } from "../data/LifestyleContext";
import { useStore } from "../data/StoreContext";

/** Best lifts and body weight of the client in view: what lift and body weight goals read from. */
export function useGoalInputs(): GoalInputs {
  const { history, progress } = useApexState(useStore());
  return useMemo(() => ({ bestKg: history.bestKg, weights: measurementSeries(progress.measurements, "weightKg") }), [history.bestKg, progress.measurements]);
}

/** Badges of the client in view, worked out from what they've already done. */
export function useBadges(): Badge[] {
  const { history, progress } = useApexState(useStore());
  const life = useLifestyle();
  const form = useFormChecks();
  const { goals } = useGoals();
  const inputs = useGoalInputs();
  return badges({
    checkIns: progress.checkIns.length,
    bestHabitRun: bestHabitRun(life.habits, life.ticks, localDate(new Date())),
    goalsReached: goals.filter((g) => goalProgress(g, inputs).achieved).length,
    formChecks: form.checks.length,
    liftsLogged: Object.keys(history.bestKg).length,
  });
}

export function GoalStatus({ state }: { state: GoalState }) {
  if (state.status === "loading") return <div className="card small">Loading…</div>;
  if (state.status === "needs-update") return <div className="card small">Goals need a quick database update before they can save. Run the goals SQL in Supabase, then reload.</div>;
  if (state.status === "error") return <div className="card small" style={{ borderColor: "var(--crit)" }}>Couldn't load goals: {state.error}</div>;
  return null;
}

const exerciseName = (id: number | null): string | undefined => {
  if (id === null) return undefined;
  try {
    return exerciseById(id).name;
  } catch {
    return undefined;
  }
};
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const KIND_ICON: Record<GoalKind, keyof typeof Icons> = { lift: "train", bodyweight: "progress", custom: "target" };

/** One goal: where they are, how far is left, and the date. */
export function GoalCard({ goal, inputs, onEdit, onLog }: { goal: Goal; inputs: GoalInputs; onEdit?: () => void; onLog?: () => void }) {
  const u = useUnits();
  const p = goalProgress(goal, inputs);
  const days = daysToGo(goal, localDate(new Date()));
  const I = Icons[KIND_ICON[goal.kind]];
  const colour = p.achieved ? "var(--good)" : goal.kind === "lift" ? "var(--viz-1)" : goal.kind === "bodyweight" ? "var(--viz-2)" : "var(--viz-3)";
  const gu = u.unit(goal.unit);
  const where = p.current === null ? "No number yet" : `${fmt(u.show(p.current, goal.unit))} ${gu}`;
  const left = p.achieved ? "Reached" : p.left === null ? null : `${fmt(u.show(p.left, goal.unit))} ${gu} to go`;
  const when = !goal.dueOn ? null : p.achieved ? null : days === null ? null : days < 0 ? `Due ${shortDate(goal.dueOn)}, passed` : days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} left · ${shortDate(goal.dueOn)}`;
  return (
    <div className="card stack goal" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <span className="hb-ico" aria-hidden style={p.achieved ? { background: "var(--good-soft)", color: "var(--good)" } : undefined}>{p.achieved ? <Icons.trophy /> : <I />}</span>
        <div className="grow">
          <div className="h3">{u.kt(goalTitle(goal, exerciseName(goal.exerciseId), p.direction))}</div>
          <div className="tiny">{GOAL_KINDS.find((k) => k.kind === goal.kind)?.title}{goal.kind === "lift" && exerciseName(goal.exerciseId) && goal.title ? ` · ${exerciseName(goal.exerciseId)}` : ""}{goal.kind !== "custom" ? " · updates itself" : ""}</div>
        </div>
        {onEdit && <button className="iconbtn" onClick={onEdit} aria-label={`Edit ${goalTitle(goal, exerciseName(goal.exerciseId), p.direction)}`}>Edit</button>}
      </div>
      <LiquidPill value={p.pct} colour={colour} size="sm" label={`${Math.round(p.pct)}% of the way`} />
      <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span className="small"><span className="num" style={{ color: "var(--text)", fontWeight: 700 }}>{where}</span> · target {fmt(u.show(goal.target, goal.unit))} {gu}{left ? ` · ${left}` : ""}</span>
        <span className="row" style={{ gap: 8 }}>
          {when && <span className="tiny" style={days !== null && days < 0 ? { color: "var(--warn)" } : undefined}>{when}</span>}
          {onLog && goal.kind === "custom" && !p.achieved && <button className="chip" onClick={onLog}><Icons.plus width={12} height={12} /> Update</button>}
        </span>
      </div>
    </div>
  );
}

/** Add or edit a goal. Used by the coach and the client. */
export function GoalEditor({ initial, inputs, who, onSave, onRemove, onCancel }: {
  initial: Goal | null;
  inputs: GoalInputs;
  /** "client" words it as "you", "coach" as the client's first name. */
  who: { side: "coach" | "client"; name: string };
  onSave: (g: Goal) => Promise<void>;
  onRemove?: () => Promise<void>;
  onCancel: () => void;
}) {
  // The boxes are in the person's units (kg or lb); built() turns them back into what's stored.
  const u = useUnits();
  const [g, setG] = useState<Goal>(() => initial ?? newGoal("lift", inputs));
  const shown = (n: number, unit = g.unit) => fmt(u.show(n, unit));
  const [target, setTarget] = useState(initial ? shown(initial.target) : "");
  const [start, setStart] = useState(initial?.startValue != null ? shown(initial.startValue) : g.startValue != null ? shown(g.startValue) : "");
  const [current, setCurrent] = useState(initial?.currentValue != null ? shown(initial.currentValue) : "");
  const stored = (raw: string) => { const n = parseNumber(raw); return n === null ? null : u.store(n, g.unit); };
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hits = useMemo(() => searchExercises(query, 6), [query]);
  const you = who.side === "client" ? "you" : who.name;

  const pickKind = (kind: GoalKind) => {
    const fresh = newGoal(kind, inputs);
    setG({ ...fresh, id: g.id, createdAt: g.createdAt, title: kind === g.kind ? g.title : "" });
    setStart(fresh.startValue != null ? shown(fresh.startValue, fresh.unit) : "");
    setCurrent("");
  };
  const pickExercise = (id: number) => {
    const best = inputs.bestKg[id];
    setG({ ...g, exerciseId: id, startValue: best ?? null });
    setStart(best !== undefined ? shown(best) : "");
    setQuery("");
  };
  const built = (): Goal => ({
    ...g,
    target: stored(target) ?? 0,
    startValue: stored(start) ?? (g.kind === "lift" ? 0 : null),
    currentValue: g.kind === "custom" ? stored(current) : null,
  });
  const save = async () => {
    const next = built();
    const problem = goalProblem(next);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await onSave(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  const ex = exerciseName(g.exerciseId);

  return (
    <section className="stack">
      <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">{initial ? "Edit goal" : "New goal"}</h2>{who.side === "coach" && <Label kind="dec">Coach decision</Label>}</div>
      {!initial && (
        <div className="chips" role="group" aria-label="Kind of goal" style={{ flexWrap: "wrap" }}>
          {GOAL_KINDS.map((k) => <button key={k.kind} type="button" className={`chip ${g.kind === k.kind ? "on" : ""}`} aria-pressed={g.kind === k.kind} onClick={() => pickKind(k.kind)}>{k.title}</button>)}
        </div>
      )}
      <div className="tiny">{GOAL_KINDS.find((k) => k.kind === g.kind)?.hint}.</div>

      {g.kind === "lift" && (
        <div className="stack" style={{ gap: 6 }}>
          <label className="small" htmlFor="goal-ex">Exercise</label>
          {ex && !query ? (
            <div className="row" style={{ gap: 8 }}><span className="h3 grow">{ex}</span>{!initial && <button className="iconbtn" onClick={() => setQuery(" ")}>Change</button>}</div>
          ) : (
            <>
              <input id="goal-ex" className="field" autoFocus={!!query} placeholder="Search, e.g. trap bar or squat" value={query.trimStart()} onChange={(e) => setQuery(e.target.value)} />
              {hits.length > 0 && (
                <div className="card flat list">
                  {hits.map(({ exercise }) => (
                    <button key={exercise.id} className="li" onClick={() => pickExercise(exercise.id)}>
                      <div className="grow"><div className="h3">{exercise.name}</div><div className="tiny">{inputs.bestKg[exercise.id] !== undefined ? `Best so far ${u.fw(inputs.bestKg[exercise.id]!)}` : "Nothing logged yet"}</div></div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {g.kind === "custom" && (
        <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          What's the goal?
          <input className="field" maxLength={120} placeholder="e.g. Strict pull-ups, or 5 km run" value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} />
        </label>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10 }}>
        <NumberField id="goal-target" label="Target" unit={u.unit(g.unit)} value={target} onChange={setTarget} />
        <NumberField id="goal-start" label={g.kind === "bodyweight" ? "Starting weight" : "Starting from"} unit={u.unit(g.unit)} value={start} onChange={setStart} />
        {g.kind === "custom" && <NumberField id="goal-now" label="Now" unit={u.unit(g.unit)} value={current} onChange={setCurrent} />}
        {g.kind === "custom" && (
          <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Unit
            <input className="field" maxLength={16} value={g.unit} onChange={(e) => setG({ ...g, unit: e.target.value })} />
          </label>
        )}
      </div>

      {g.kind !== "custom" && (
        <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Name (optional)
          <input className="field" maxLength={120} placeholder={parseNumber(target) ? u.kt(goalTitle({ ...built(), title: "" }, ex, (parseNumber(target) ?? 0) < (parseNumber(start) ?? 0) ? "down" : "up")) : "e.g. Wedding fit"} value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} />
        </label>
      )}

      <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        By when (optional)
        <input type="date" className="field" min={initial ? undefined : localDate(new Date())} value={g.dueOn ?? ""} onChange={(e) => setG({ ...g, dueOn: e.target.value || null })} />
      </label>

      {g.kind === "bodyweight" && start === "" && <div className="tiny">No weigh-in yet. Add the starting weight, and progress fills in from {you === "you" ? "your" : `${you}'s`} next check-ins.</div>}
      {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn act grow" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : initial ? "Save goal" : "Set goal"}</button>
      </div>
      {onRemove && (
        <button className="btn ghost block" style={{ color: "var(--crit)" }} disabled={busy} onClick={() => { setBusy(true); void onRemove().catch((e: unknown) => { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }); }}>
          <Icons.trash width={15} height={15} /> Remove goal
        </button>
      )}
    </section>
  );
}

/** Quick update of a custom goal's number. */
export function GoalLog({ goal, onSave, onCancel }: { goal: Goal; onSave: (g: Goal) => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState(goal.currentValue != null ? fmt(goal.currentValue) : "");
  const [error, setError] = useState<string | null>(null);
  const n = parseNumber(v);
  return (
    <section className="stack">
      <h2 className="h2">{goal.title}</h2>
      <NumberField id="goal-log" label={`Where are you now? Target ${fmt(goal.target)} ${goal.unit}`} unit={goal.unit} value={v} onChange={setV} />
      {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn act grow" disabled={n === null || n < 0} onClick={() => void onSave({ ...goal, currentValue: n }).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))}>Save</button>
      </div>
    </section>
  );
}

const BADGE_ICON: Record<Badge["icon"], keyof typeof Icons> = { check: "check", flame: "flame", trophy: "trophy", form: "form", grip: "train" };

/** Badge grid: earned ones in colour, the rest muted with how close they are. */
export function BadgeGrid({ list }: { list: Badge[] }) {
  const earned = list.filter((b) => b.earned).length;
  return (
    <section className="card stack">
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Badges · <span className="num">{earned}</span> of <span className="num">{list.length}</span></h3><Label kind="data">Data</Label></div>
      <div className="badge-grid">
        {list.map((b) => {
          const I = Icons[BADGE_ICON[b.icon]];
          return (
            <div key={b.key} className={`badge ${b.earned ? "on" : ""}`} title={b.detail}>
              <span className="badge-ico" aria-hidden><I /></span>
              <div className="h3" style={{ fontSize: 13 }}>{b.title}</div>
              <div className="tiny">{b.earned ? b.detail : `${b.have} of ${b.need}`}</div>
              {!b.earned && <Bar pct={(b.have / b.need) * 100} color="var(--text3)" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
