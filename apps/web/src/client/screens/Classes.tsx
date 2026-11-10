import { classAvailability, myClassLine, type ClassView } from "@apex/core";
import { ClassCard } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { useExtras } from "../../data/extras";

/** Client: the coach's group classes. Book a place, join the waitlist when full, or drop out. */
export function Classes({ say }: { say: (m: string) => void }) {
  const api = useExtras();
  const { coachName } = useAppInfo();
  const [list, setList] = useState<ClassView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!api) return;
    try { setList(await api.classes.list()); setError(null); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);
  if (!api) return null;

  const act = async (c: ClassView, action: "join" | "wait" | "leave") => {
    if (action === "leave" && !confirm(c.myStatus === "booked" ? `Give up your place in ${c.title}?` : `Leave the waitlist for ${c.title}?`)) return;
    setBusy(c.id);
    try {
      if (action === "leave") { await api.classes.leave(c.id); say(c.myStatus === "booked" ? "Place given up" : "Off the waitlist"); }
      else { const r = await api.classes.join(c.id); say(r === "booked" ? `Booked · ${c.title}` : "You're on the waitlist. You'll move up automatically"); }
    } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
    await reload();
  };

  return (
    <>
      <div><div className="eyebrow">More</div><h1 className="h1">Group classes</h1></div>
      {error && <div className="card small">{error}</div>}
      {!list && !error && <div className="card small">Loading…</div>}
      {list && list.length === 0 && <div className="card small">No classes coming up. When {coachName} adds one, you can book it here.</div>}
      {list && list.map((c, i) => {
        const me = myClassLine(c);
        return (
          <div key={c.id} className="stack" style={{ gap: 6 }}>
            <ClassCard i={i} {...c} line={me.line && c.myStatus === "booked" ? me.line : classAvailability(c)}>
              {me.action && (
                <button className={`btn sm ${me.action === "leave" ? "ghost" : "act"}`} disabled={busy === c.id} onClick={() => void act(c, me.action!)}>
                  {me.action === "join" ? "Book a place" : me.action === "wait" ? "Join the waitlist" : c.myStatus === "booked" ? "Give up place" : "Leave waitlist"}
                </button>
              )}
            </ClassCard>
            {(c.myStatus === "waitlist" || c.cancelled) && me.line && <div className="tiny" style={{ paddingLeft: 4 }}>{me.line}</div>}
            {c.note && !c.cancelled && c.myStatus === "booked" && <div className="tiny" style={{ paddingLeft: 4 }}>{c.note}</div>}
          </div>
        );
      })}
    </>
  );
}
