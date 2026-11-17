import { noteTimeline, type SessionNote } from "@apex/core";
import { NoteTimeline } from "@apex/ui";
import { useEffect, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { useExtras } from "../../data/extras";

/** Notes the coach chose to share after a session, newest first. Hidden until there is one. */
export function CoachNotes() {
  const api = useExtras();
  const { coachName } = useAppInfo();
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let on = true;
    // A client whose coach hasn't run the new SQL yet simply sees nothing here.
    api?.notes.list("").then((n) => { if (on) setNotes(n); }, () => undefined);
    return () => { on = false; };
  }, [api]);
  if (!notes.length) return null;
  const shown = all ? notes : notes.slice(0, 3);
  return (
    <section>
      <div className="sect"><h2 className="h2">Notes from {coachName}</h2>{notes.length > 3 && <button className="link" onClick={() => setAll((a) => !a)}>{all ? "Fewer" : `All ${notes.length}`}</button>}</div>
      <NoteTimeline groups={noteTimeline(shown)} client="" showAudience={false} />
    </section>
  );
}
