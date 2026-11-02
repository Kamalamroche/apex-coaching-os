import { WEEKDAY_NAMES, checkInDue, checkInFlags, compareCheckIns, firstName, newestFirst, shortDate, type CheckIn, type ProgressPhoto } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Label, PhotoFrame } from "@apex/ui";
import { useState } from "react";
import { POSE_LABEL, ProgressNotice, ProgressSection } from "../../app/ProgressParts";
import { useStore } from "../../data/StoreContext";

/** The coach's view of one client's check-ins, measurements and photos, with a reply box on each check-in. */
export function ClientCheckIns({ clientName, say }: { clientName: string; say: (m: string) => void }) {
  const store = useStore();
  const { progress } = useApexState(store);
  const first = firstName(clientName);
  const checkIns = newestFirst(progress.checkIns);
  const due = checkInDue(checkIns[0]?.submittedAt ?? null, progress.checkInDay);

  const setDay = (day: number) => {
    store.setCheckInDay(day).then(() => say(`${first} now checks in on ${WEEKDAY_NAMES[day]}s`), (e: unknown) => say(e instanceof Error ? e.message : "Couldn't change the day"));
  };

  const waiting = checkIns.filter((c) => !c.reviewedAt);
  const earlier = checkIns.filter((c) => c.reviewedAt);
  const previousOf = (c: CheckIn) => checkIns[checkIns.indexOf(c) + 1];
  const card = (c: CheckIn, open: boolean) => (
    <CheckInCard key={c.id} checkIn={c} previous={previousOf(c)} photos={progress.photos.filter((p) => p.checkInId === c.id)} first={first} say={say} startOpen={open} />
  );

  return (
    <>
      <ProgressNotice />

      <section>
        <div className="sect"><h2 className="h2">To review</h2><span className="tiny">{waiting.length ? `${waiting.length} waiting` : "All caught up"}</span></div>
        <div className="stack">
          {waiting.length === 0 && (
            <div className="card small">
              {checkIns.length === 0
                ? `No check-ins yet. ${first} gets a prompt on their Today screen every ${WEEKDAY_NAMES[progress.checkInDay]}.`
                : due.due ? `Nothing new. ${first}'s check-in ${due.daysLate > 0 ? `was due ${due.daysLate} day${due.daysLate === 1 ? "" : "s"} ago` : "is due today"}.` : `Nothing new. Next check-in is due ${WEEKDAY_NAMES[progress.checkInDay]}.`}
            </div>
          )}
          {waiting.map((c) => card(c, true))}
        </div>
      </section>

      <ProgressSection progress={progress} />

      <section>
        <div className="sect"><h2 className="h2">Earlier check-ins</h2><span className="tiny">{earlier.length} reviewed</span></div>
        <div className="stack">
          {earlier.length === 0 && <div className="card small">Reviewed check-ins move here.</div>}
          {earlier.map((c) => card(c, false))}
        </div>
      </section>

      <div className="card row" style={{ flexWrap: "wrap" }}>
        <div className="grow">
          <div className="h3">Weekly check-in day</div>
          <div className="small">{first} is asked to check in every {WEEKDAY_NAMES[progress.checkInDay]}.</div>
        </div>
        <select className="field" style={{ width: "auto" }} aria-label="Check-in day" value={progress.checkInDay} onChange={(e) => setDay(Number(e.target.value))}>
          {WEEKDAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
      </div>
    </>
  );
}

function CheckInCard({ checkIn: c, previous, photos, first, say, startOpen }: { checkIn: CheckIn; previous?: CheckIn; photos: ProgressPhoto[]; first: string; say: (m: string) => void; startOpen: boolean }) {
  const store = useStore();
  const [open, setOpen] = useState(startOpen);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const flags = checkInFlags(c, previous);
  const rows = compareCheckIns(c, previous);
  const words = ([["Wins", c.wins], ["Hard this week", c.struggles], ["Also", c.note]] as const).filter(([, t]) => t);

  const send = async () => {
    setBusy(true);
    try {
      await store.reviewCheckIn(c.id, reply);
      if (reply.trim()) store.sendMessage("coach", reply.trim());
      say(reply.trim() ? `Reply sent to ${first}` : "Marked as reviewed");
      setReply("");
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn't save the reply");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flat">
      <button className="li" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="grow">
          <div className="h3">{shortDate(c.submittedAt)}{c.weightKg !== null && <> · <span className="num">{c.weightKg} kg</span></>}</div>
          <div className="small">{flags.length ? `${flags.length} thing${flags.length === 1 ? "" : "s"} to look at` : "Nothing flagged"}{photos.length ? ` · ${photos.length} photo${photos.length === 1 ? "" : "s"}` : ""}</div>
        </div>
        {c.reviewedAt ? <Label kind="dec">Reviewed</Label> : <Label kind="crit">New</Label>}
        <span className="h2">{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="stack" style={{ padding: "0 14px 14px" }}>
          {flags.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              {flags.map((f) => (
                <div key={f.text} className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                  <Label kind={f.severity === "crit" ? "crit" : "insight"}>Insight</Label>
                  <span className="small">{f.text}</span>
                </div>
              ))}
              <div className="tiny">Rule-based flags from this check-in and the one before. No AI.</div>
            </div>
          )}
          {rows.length > 0 && (
            <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))" }}>
              {rows.map((r) => (
                <div key={r.label} className="kpi" style={{ padding: 10 }}>
                  <b style={{ fontSize: 17 }}>{r.now}</b><small>{r.label}</small>
                  {r.change !== null && r.change !== "0" && <i style={{ color: "var(--data)" }}>{r.change} vs last</i>}
                </div>
              ))}
            </div>
          )}
          {words.map(([label, text]) => (
            <div key={label}><div className="tiny" style={{ fontWeight: 700 }}>{label}</div><div className="small" style={{ color: "var(--text)" }}>“{text}”</div></div>
          ))}
          {photos.length > 0 && (
            <div className="poses">{photos.map((p) => <PhotoFrame key={p.id} url={p.url} label={POSE_LABEL[p.pose]} />)}</div>
          )}
          {c.reviewedAt && (
            <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
              <Label kind="dec">Coach decision</Label>
              <span className="small">{c.coachReply ? `You replied: “${c.coachReply}”` : `Reviewed ${shortDate(c.reviewedAt)}, no reply`}</span>
            </div>
          )}
          {!c.reviewedAt && (
            <>
              <textarea className="field" rows={3} maxLength={4000} placeholder={`Reply to ${first}. It also goes to your message thread.`} value={reply} onChange={(e) => setReply(e.target.value)} aria-label={`Reply to ${first}`} />
              <button className="btn act block" disabled={busy} onClick={() => void send()}>{busy ? "Saving…" : reply.trim() ? "Send reply and mark reviewed" : "Mark as reviewed"}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
