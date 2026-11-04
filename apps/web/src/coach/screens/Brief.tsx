import { CLIENTS, HERO_IMAGES, firstName, heroForWorkout, newestFirst, type Client } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Avatar, Icons, Label, Sheet } from "@apex/ui";
import { useState } from "react";
import { SampleNote, useAppInfo } from "../../app/AppContext";
import { WorkoutSummaryCard } from "../../app/WorkoutSummary";
import { useStore } from "../../data/StoreContext";
import { CoachCardio, CoachRecovery } from "./CoachCardio";
import { PlateauFixes, usePlateaus } from "./Plateaus";
import { Calendar, CalendarCard } from "./Calendar";
import { TwinCard, TwinQueue } from "./Twin";
import type { LiveClient } from "../../data/coach";

interface TriageItem {
  id: string;
  clientId: number;
  severity: "crit" | "warn";
  label: "Insight" | "Data";
  title: string;
  evidence: string;
  action: string;
  /** AI-drafted message. When missing, the action opens the client instead. */
  draft: string | null;
}

/* Sample triage. In the real build these are ranked server-side from logged sessions and check-ins. */
const TRIAGE: TriageItem[] = [
  { id: "t1", clientId: 1, severity: "crit", label: "Insight", title: "Sarah Mitchell has missed 3 sessions", evidence: "Last session 14 Oct · check-in mood 2/5 · adherence 42% (was 81% in September)", action: "Message", draft: "Hi Sarah, I noticed the last couple of weeks have been tough to fit in. No pressure at all. Would a shorter 30-minute version of your sessions help this week?" },
  { id: "t2", clientId: 2, severity: "warn", label: "Insight", title: "James's bench has stalled for 3 weeks", evidence: "e1RM 96 → 96 → 95 kg · every top set at RPE 9–9.5", action: "Review", draft: null },
  { id: "t3", clientId: 3, severity: "warn", label: "Data", title: "Lena's check-in is 2 days overdue", evidence: "Weekly check-in due Thu 23 Oct · no reply to reminder", action: "Nudge", draft: "Hey Lena, quick reminder that your weekly check-in is ready. It takes about two minutes and helps me adjust next week's plan." },
];

const PROGRESSIONS = [
  { clientId: 2, exercise: "Back squat", from: "100 kg", to: "102.5 kg", why: "All 4×5 sets at RPE 7 for two sessions" },
  { clientId: 4, exercise: "Bench press", from: "110 kg", to: "112.5 kg", why: "Top set RPE 7.5, target 8" },
  { clientId: 5, exercise: "Trap bar deadlift", from: "67.5 kg", to: "70 kg", why: "4×5 at RPE 7, target 8" },
];

const clientById = (id: number): Client => {
  const c = CLIENTS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown client ${id}`);
  return c;
};

export function Brief({ openClient, say, clientCount, clients }: { openClient: (id: number) => void; say: (m: string) => void; clientCount?: number; clients?: LiveClient[] | null }) {
  const store = useStore();
  const { coachName, clientName, mode } = useAppInfo();
  const clientFirst = firstName(clientName);
  const clientInitials = clientName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const { log, progress, workout } = useApexState(store);
  const hero = HERO_IMAGES[heroForWorkout(workout)];
  const newCheckIn = mode === "live" ? newestFirst(progress.checkIns).find((c) => !c.reviewedAt) : undefined;
  const plateaus = usePlateaus();
  const [handled, setHandled] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<TriageItem | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({ 2: true, 4: true, 5: true });
  const pending = TRIAGE.filter((i) => !handled[i.id]);
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const handle = (id: string) => setHandled((d) => ({ ...d, [id]: true }));
  const [calendar, setCalendar] = useState(false);
  const [twin, setTwin] = useState(false);
  if (calendar) return <Calendar clients={clients} onBack={() => setCalendar(false)} say={say} />;
  if (twin) return <TwinQueue onBack={() => setTwin(false)} say={say} />;

  return (
    <>
      <div className="full hello">
        <div>
          <p className="sub">Saturday 25 October</p>
          <h1 className="h1">Morning, {coachName}.{mode === "demo" && (pending.length ? ` ${pending.length} clients need you.` : " Everyone's on track.")}</h1>
        </div>
      </div>
      <SampleNote />
      <div className="tiles full">
        <div className="tile c1"><span className="ic"><Icons.clients /></span><b>{clientCount ?? CLIENTS.length}</b><span>Active clients{mode === "demo" && <><br /><i style={{ color: "var(--good)", fontStyle: "normal", fontWeight: 600 }}>+2 this month</i></>}</span></div>
        <div className="tile c3"><span className="ic"><Icons.check /></span><b>74<small>%</small></b><span>Sessions done, 7 days<br /><i style={{ color: "var(--good)", fontStyle: "normal", fontWeight: 600 }}>+4 pts</i></span></div>
        <div className="tile c2"><span className="ic"><Icons.target /></span><b style={{ color: "var(--act)" }}>{pending.length}</b><span>Need you today<br /><i style={{ color: "var(--text3)", fontStyle: "normal" }}>{TRIAGE.length - pending.length} handled</i></span></div>
      </div>
      <div className="hero side short">
        <img className="hero-img" src={hero.src} alt="" style={{ objectPosition: hero.focus.replace("center", "70%") }} />
        <div className="hero-body" style={{ maxWidth: 280 }}>
          <span className="gpill caps" style={{ alignSelf: "flex-start" }}>{log ? "Trained today" : "Training today"}</span>
          <h2 className="hero-title" style={{ fontSize: 22 }}>{clientFirst}: {log ? log.workoutName : workout.name}</h2>
          <div className="gpills">
            {log ? (
              <>
                <span className="gpill num">{log.sets} sets</span>
                <span className="gpill num">{log.volumeKg.toLocaleString("en-GB")} kg</span>
                {log.prs ? <span className="gpill num">{log.prs} PR</span> : <span className="gpill num">RPE {log.rpe}</span>}
              </>
            ) : (
              <>
                <span className="gpill num">{workout.items.length} exercises</span>
                <span className="gpill num">{workout.minutes} min</span>
                <span className="gpill num">Week {workout.week} of {workout.ofWeeks}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="stack" style={{ gap: 18 }}>
        <TwinCard onOpen={() => setTwin(true)} />
        <CalendarCard clients={clients} onOpen={() => setCalendar(true)} />
      </div>

      <section>
        <div className="sect"><h2 className="h2">Needs you today</h2><span className="tiny">Ranked by urgency</span></div>
        <div className="card flat list">
          {pending.length === 0 && (
            <div className="li"><div className="grow"><div className="h3">All clear</div><div className="small">New flags appear here as clients log, skip or check in.</div></div></div>
          )}
          {pending.map((it) => {
            const c = clientById(it.clientId);
            const tone = it.severity === "crit" ? "var(--crit)" : "var(--warn)";
            return (
              <div key={it.id} className="tri">
                <div className="stripe" style={{ background: tone }} />
                <div>
                  <div className="row" style={{ gap: 10 }}><Avatar initials={c.initials} size={32} tone={tone} /><div className="grow"><div className="h3">{it.title}</div></div></div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Label kind={it.label === "Data" ? "data" : "insight"}>{it.label}</Label>
                    <span className="small">{it.evidence}</span>
                  </div>
                  <div className="acts">
                    <button className="btn act sm" onClick={() => (it.draft ? setDraft(it) : openClient(it.clientId))}>{it.action}</button>
                    <button className="btn ghost sm" onClick={() => openClient(it.clientId)}>Open client</button>
                    <button className="btn ghost sm" onClick={() => { handle(it.id); say("Dismissed for today"); }}>Dismiss</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="sect"><h2 className="h2">Progressions ready</h2><Label kind="insight">Rule-based</Label></div>
        <div className="card flat list">
          {PROGRESSIONS.map((p) => (
            <label key={p.clientId} className="li" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={!!selected[p.clientId]} onChange={(e) => setSelected((s) => ({ ...s, [p.clientId]: e.target.checked }))} style={{ width: 20, height: 20, accentColor: "var(--act)" }} />
              <div className="grow">
                <div className="h3">{firstName(clientById(p.clientId).name)} · {p.exercise}</div>
                <div className="small"><span className="num">{p.from} → <b style={{ color: "var(--act)" }}>{p.to}</b></span> · {p.why}</div>
              </div>
            </label>
          ))}
          <div style={{ padding: 12 }}>
            <button className="btn act block" disabled={selectedCount === 0} onClick={() => { say(`${selectedCount} progressions applied to next session`); setSelected({}); }}>Apply selected</button>
          </div>
        </div>
      </section>

      {plateaus.length > 0 && (
        <section>
          <div className="sect"><h2 className="h2">Plateau watch</h2><Label kind="insight">Rule-based</Label></div>
          <div className="card flat list">
            {plateaus.map((p) => (
              <div key={p.exercise.id} className="li" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                <div className="h3">{clientFirst} · {p.exercise.name} has stalled</div>
                <PlateauFixes plateau={p} say={say} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="sect"><h2 className="h2">Latest activity</h2></div>
        <div className="card flat list">
          {log && (
            <div className="li" style={{ flexWrap: "wrap" }}>
              <Avatar initials={clientInitials} size={34} tone="var(--good)" />
              <div className="grow">
                <div className="h3">{clientFirst} finished {log.workoutName}</div>
                <div className="small"><Label kind="data">Data</Label> <span className="num">{log.sets} sets{log.summary?.totalReps ? ` · ${log.summary.totalReps} reps` : ""} · {log.volumeKg.toLocaleString()} kg · {log.minutes} min · RPE {log.rpe}</span>{log.prs > 0 ? ` · ${log.prs} PR` : ""}</div>
                {log.note && <div className="small" style={{ marginTop: 4, color: "var(--text)" }}><Icons.note width={13} height={13} style={{ verticalAlign: -2, color: "var(--text3)" }} /> "{log.note}"</div>}
              </div>
              <span className="tiny">Today</span>
              {log.summary && <div style={{ flexBasis: "100%", marginTop: 8 }}><WorkoutSummaryCard summary={log.summary} compact /></div>}
            </div>
          )}
          {newCheckIn && (
            <div className="li">
              <Avatar initials={clientInitials} size={34} />
              <div className="grow">
                <div className="h3">{clientFirst} sent a check-in</div>
                <div className="small"><Label kind="data">Data</Label> <span className="num">{[newCheckIn.sleepHours !== null && `Sleep ${newCheckIn.sleepHours} h`, newCheckIn.energy && `energy ${newCheckIn.energy}/5`, newCheckIn.weightKg !== null && `weight ${newCheckIn.weightKg} kg`].filter(Boolean).join(" · ")}</span></div>
              </div>
              <span className="tiny">Clients › Check-ins</span>
            </div>
          )}
          {mode === "demo" && <>
          <div className="li"><Avatar initials="OT" size={34} tone="var(--good)" /><div className="grow"><div className="h3">Omar hit a 100 kg squat PR</div><div className="small">Send a congratulations?</div></div><button className="btn ghost sm" onClick={() => say("Message sent to Omar")}>Send</button></div>
          <div className="li"><Avatar initials="PS" size={34} /><div className="grow"><div className="h3">Priya submitted a check-in</div><div className="small">Sleep 7.5 h · energy 4/5 · weight 62.3 kg</div></div><button className="btn ghost sm" onClick={() => openClient(5)}>View</button></div>
          </>}
          {mode === "live" && !log && !newCheckIn && <div className="li"><div className="small">Nothing yet today. Finished sessions show up here as soon as they are saved.</div></div>}
        </div>
      </section>

      <CoachRecovery />
      <CoachCardio />

      {draft && (
        <Sheet onClose={() => setDraft(null)} label="Draft message">
          <div className="row"><Label kind="ai">AI suggestion</Label><span className="tiny">Drafted in your tone · nothing sent yet</span></div>
          <h2 className="h2">Message to {firstName(clientById(draft.clientId).name)}</h2>
          <textarea id="draftmsg" className="field" rows={5} defaultValue={draft.draft ?? ""} style={{ resize: "vertical", lineHeight: 1.5 }} />
          <div className="row">
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn act" style={{ flex: 2 }} onClick={() => { handle(draft.id); setDraft(null); say("Sent · logged as your decision"); }}>Approve and send</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
