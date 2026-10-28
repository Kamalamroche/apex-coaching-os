import { applyPlateauFix, programPlateaus, type Plateau, type PlateauFix } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Label } from "@apex/ui";
import { useStore } from "../../data/StoreContext";

/** The open client's stalled exercises this week. */
export function usePlateaus(): Plateau[] {
  const { program, workout, history } = useApexState(useStore());
  return programPlateaus(program, workout.week, history.trend);
}

/** The evidence and the two ways out. Nothing changes until the coach picks one. */
export function PlateauFixes({ plateau: p, say, onDone }: { plateau: Plateau; say: (m: string) => void; onDone?: () => void }) {
  const store = useStore();
  const { program, workout, activeDay } = useApexState(store);
  const apply = (fix: PlateauFix, msg: string) => {
    store.saveProgram(applyPlateauFix(program, workout.week, p.exercise.id, fix), activeDay);
    say(msg);
    onDone?.();
  };
  return (
    <div className="plat">
      <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
        <Label kind="insight">Insight</Label>
        <span className="small">{p.reason}</span>
      </div>
      <div className="row" style={{ gap: 8 }}><Label kind="ai">AI suggestion</Label><span className="tiny">Pick one, or leave it as it is</span></div>
      <div className="plat-acts">
        {p.item.kg > 0 && (
          <button className="btn ghost sm" onClick={() => apply({ kind: "deload" }, `${p.exercise.name} deloaded to ${p.deload.kg} kg this week`)}>
            Deload this week: <span className="num">{p.item.kg} → {p.deload.kg} kg</span>
          </button>
        )}
        {p.swaps.map((s) => (
          <button key={s.id} className="btn ghost sm" onClick={() => apply({ kind: "swap", to: s.id }, `${p.exercise.name} swapped for ${s.name} from week ${workout.week}`)}>
            Swap for {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
