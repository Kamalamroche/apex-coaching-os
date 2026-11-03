import { firstName, sortGoals, type Goal } from "@apex/core";
import { Icons } from "@apex/ui";
import { useState } from "react";
import { BadgeGrid, GoalCard, GoalEditor, GoalStatus, useBadges, useGoalInputs } from "../../app/GoalParts";
import { useGoalStore, useGoals } from "../../data/GoalContext";

/** Coach: the client's goals (set, edit, remove) and the badges they've earned. */
export function ClientGoals({ clientName, say }: { clientName: string; say: (m: string) => void }) {
  const s = useGoals();
  const store = useGoalStore();
  const inputs = useGoalInputs();
  const list = useBadges();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const name = firstName(clientName) || "Your client";
  const goals = sortGoals(s.goals, inputs);

  if (editing) {
    return (
      <div className="card">
        <GoalEditor
          initial={editing === "new" ? null : editing}
          inputs={inputs}
          who={{ side: "coach", name }}
          onCancel={() => setEditing(null)}
          onSave={async (g) => { await store.save(g); setEditing(null); say(editing === "new" ? `Goal set · ${name} sees it now` : "Goal saved"); }}
          onRemove={editing === "new" ? undefined : async () => { await store.remove(editing.id); setEditing(null); say("Goal removed"); }}
        />
      </div>
    );
  }
  return (
    <>
      <GoalStatus state={s} />
      {s.status === "ready" && goals.length === 0 && <div className="card small">No goals yet. One or two clear goals with a date help {name} stay focused.</div>}
      {goals.map((g) => <GoalCard key={g.id} goal={g} inputs={inputs} onEdit={() => setEditing(g)} />)}
      {s.status === "ready" && <button className="btn ghost block" onClick={() => setEditing("new")}><Icons.plus width={15} height={15} /> Set a goal for {name}</button>}
      <BadgeGrid list={list} />
    </>
  );
}
