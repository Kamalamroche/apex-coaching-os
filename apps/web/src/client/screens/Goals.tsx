import { sortGoals, type Goal } from "@apex/core";
import { Icons, Sheet } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { BadgeGrid, GoalCard, GoalEditor, GoalLog, GoalStatus, useBadges, useGoalInputs } from "../../app/GoalParts";
import { useGoalStore, useGoals } from "../../data/GoalContext";

/** Client: goals with progress, and badges earned so far. */
export function Goals({ say }: { say: (m: string) => void }) {
  const { coachName } = useAppInfo();
  const s = useGoals();
  const store = useGoalStore();
  const inputs = useGoalInputs();
  const list = useBadges();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const [logging, setLogging] = useState<Goal | null>(null);
  const goals = sortGoals(s.goals, inputs);

  return (
    <>
      <div><div className="eyebrow">Goals</div><h1 className="h1">What you're working towards</h1></div>
      <GoalStatus state={s} />
      {s.status === "ready" && goals.length === 0 && (
        <div className="card small">No goals yet. Set one yourself, or {coachName} will add some. Lift and body weight goals fill themselves in as you train and check in.</div>
      )}
      {goals.map((g) => <GoalCard key={g.id} goal={g} inputs={inputs} onEdit={() => setEditing(g)} onLog={() => setLogging(g)} />)}
      {s.status === "ready" && <button className="btn ghost block" onClick={() => setEditing("new")}><Icons.plus width={15} height={15} /> Add a goal</button>}
      <BadgeGrid list={list} />

      {editing && (
        <Sheet label={editing === "new" ? "New goal" : "Edit goal"} onClose={() => setEditing(null)}>
          <GoalEditor
            initial={editing === "new" ? null : editing}
            inputs={inputs}
            who={{ side: "client", name: "" }}
            onCancel={() => setEditing(null)}
            onSave={async (g) => { await store.save(g); setEditing(null); say(editing === "new" ? `Goal set · ${coachName} can see it` : "Goal saved"); }}
            onRemove={editing === "new" ? undefined : async () => { await store.remove(editing.id); setEditing(null); say("Goal removed"); }}
          />
        </Sheet>
      )}
      {logging && (
        <Sheet label="Update goal" onClose={() => setLogging(null)}>
          <GoalLog goal={logging} onCancel={() => setLogging(null)} onSave={async (g) => { await store.save(g); setLogging(null); say("Updated"); }} />
        </Sheet>
      )}
    </>
  );
}
