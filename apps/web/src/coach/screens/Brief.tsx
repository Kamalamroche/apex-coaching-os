import { CLIENTS, DEMO_CLIENT_ID, HERO_IMAGES, exerciseFor, progressWorkout, type RosterRow, businessGlance, businessSummary, firstName, heroForWorkout, newestFirst, sampleBusiness, type Client, type GlanceTile } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Avatar, BusinessGlance, CountUp, Icons, Label, Sheet, EditorialTitle, HeroBackdrop, useUnits } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { loadBusiness } from "../../data/business";
import { SampleNote, useAppInfo } from "../../app/AppContext";
import { WorkoutSummaryCard } from "../../app/WorkoutSummary";
import { useStore } from "../../data/StoreContext";
import { PlateauFixes, usePlateaus } from "./Plateaus";
import { Calendar, CalendarCard } from "./Calendar";
import { TwinCard, TwinQueue } from "./Twin";
import type { LiveClient } from "../../data/coach";
import { PushPrompt } from "../../app/PushParts";
import { GoingQuiet } from "./Quiet";
import { ClientHealthCard } from "./ClientHealth";
import { demoRosterHealth, useRosterHealth, type HealthClient } from "../../data/health";
import type { CoachLiveProps } from "../CoachApp";

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

export function Brief({ openClient, openLiveClient, openClients, openBusiness, say, clientCount, clients, live }: { openClient: (id: number, tab?: string) => void; openLiveClient?: (id: string, tab?: string) => void; openClients?: () => void; openBusiness?: () => void; say: (m: string) => void; clientCount?: number; clients?: LiveClient[] | null; live?: CoachLiveProps }) {
  const u = useUnits();
  const store = useStore();
  const { coachName, clientName, mode } = useAppInfo();
  const clientFirst = firstName(clientName);
  const clientInitials = clientName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const { log, progress, workout } = useApexState(store);
  const hero = HERO_IMAGES[heroForWorkout(workout)];
  const newCheckIn = mode === "live" ? newestFirst(progress.checkIns).find((c) => !c.reviewedAt) : undefined;
  const plateaus = usePlateaus();
  const liveHealth = useRosterHealth(mode === "live" ? live?.db : undefined, live?.coachId, clients);
  const demoHealth = useMemo(() => (mode === "demo" ? demoRosterHealth() : null), [mode]);
  const health: RosterRow<HealthClient>[] | null = mode === "live" ? liveHealth : demoHealth;
  const scored = (health ?? []).filter((r) => r.health.score !== null);
  const avgHealth = scored.length ? Math.round(scored.reduce((a, r) => a + r.health.score!, 0) / scored.length) : null;
  const [handled, setHandled] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<TriageItem | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({ 2: true, 4: true, 5: true });
  const pending = TRIAGE.filter((i) => !handled[i.id]);
  // Live: the clients whose health score says they need you, from their real training, check-ins and messages.
  const liveNeed = mode === "live" ? (health ?? []).filter((r) => r.health.band === "low" && !handled[r.client.id]) : [];
  const needCount = mode === "live" ? liveNeed.length : pending.length;
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const handle = (id: string) => setHandled((d) => ({ ...d, [id]: true }));
  const glance = useBusinessGlance(mode === "live" ? live : undefined);
  const openToday = (tab?: string) => (mode === "live" ? (live?.activeClientId ? openLiveClient?.(live.activeClientId, tab) : undefined) : openClient(DEMO_CLIENT_ID, tab));
  const [calendar, setCalendar] = useState(false);
  const [twin, setTwin] = useState(false);
  if (calendar) return <Calendar clients={clients} onBack={() => setCalendar(false)} say={say} />;
  if (twin) return <TwinQueue onBack={() => setTwin(false)} say={say} />;

  return (
    <>
      <section className="hero cover short full br-cover" aria-label="Your morning brief">
        <HeroBackdrop art={HERO_IMAGES.coach} word={null} />
        <div className="cv-title">
          <EditorialTitle as="h1" text={coachName} caption={mode === "demo" ? (pending.length ? `Morning brief · ${pending.length} need you` : "Morning brief · all on track") : "Morning brief"} />
        </div>
        <div className="hero-body">
          <div className="cv-stats three">
            <div style={{ ["--i" as string]: 0 }}><b><CountUp value={clientCount ?? CLIENTS.length} /></b><small>Active clients</small>{mode === "demo" && <i>+2 this month</i>}</div>
            {mode === "live" ? (
              <div style={{ ["--i" as string]: 1 }}><b>{avgHealth === null ? "–" : <CountUp value={avgHealth} />}</b><small>Average client health</small>{scored.length > 0 && <i>{scored.filter((r) => r.health.band === "low").length} need you</i>}</div>
            ) : (
              <div style={{ ["--i" as string]: 1 }}><b><CountUp value={74} />%</b><small>Sessions done, 7 days</small><i>+4 pts</i></div>
            )}
            <div style={{ ["--i" as string]: 2 }}><b><CountUp value={needCount} /></b><small>Need you today</small><i>{mode === "live" ? "From client health" : `${TRIAGE.length - pending.length} handled`}</i></div>
          </div>
        </div>
      </section>
      <SampleNote />
      <PushPrompt say={say} full />
      <section>
        <div className="sect"><h2 className="h2">Needs you today</h2><span className="tiny">Ranked by urgency</span></div>
        {mode === "live" ? (
          <div className="card flat list">
            {health === null && <div className="li"><div className="small">Working out who needs you…</div></div>}
            {health !== null && liveNeed.length === 0 && (
              <div className="li"><div className="grow"><div className="h3">All clear</div><div className="small">Clients show here when their health score drops below 50: missed sessions, no check-in, gone quiet.</div></div></div>
            )}
            {liveNeed.map((r) => (
              <div key={r.client.id} className="tri">
                <div className="stripe" style={{ background: "var(--crit)" }} />
                <div>
                  <div className="row" style={{ gap: 10 }}><Avatar initials={r.client.name.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase()} size={32} tone="var(--crit)" /><div className="grow"><div className="h3">{r.client.name} needs you</div></div></div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Label kind="insight">Insight</Label>
                    <span className="small">Health {r.health.score ?? "–"} · {r.health.reasons.join(" · ") || "Below 50 this fortnight"}</span>
                  </div>
                  <div className="acts">
                    <button className="btn act sm" onClick={() => openLiveClient?.(r.client.id)}>Open client</button>
                    <button className="btn ghost sm" onClick={() => { handle(r.client.id); say("Dismissed for today"); }}>Dismiss</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
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
                    <span className="small">{u.kt(it.evidence)}</span>
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
        )}
      </section>

      <div className="stack" style={{ gap: 8 }}>
        <ClientHealthCard rows={health} open={(c) => (mode === "live" ? openLiveClient?.(c.id) : openClient(Number(c.id)))} />
        {openClients && <button className="link" style={{ alignSelf: "flex-start" }} onClick={openClients}>See every client in the table ›</button>}
      </div>
      {glance && <BusinessGlance tiles={glance} sample={mode === "demo"} onOpen={openBusiness} />}
      <div className="stack" style={{ gap: 18 }}>
        <TwinCard onOpen={() => setTwin(true)} />
        <CalendarCard clients={clients} onOpen={() => setCalendar(true)} />
      </div>

      <GoingQuiet live={live} say={say} />


      {mode === "live" ? <LiveProgressions say={say} /> : <section>
        <div className="sect"><h2 className="h2">Progressions ready</h2><Label kind="insight">Rule-based</Label></div>
        <div className="card flat list">
          {PROGRESSIONS.map((p) => (
            <label key={p.clientId} className="li" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={!!selected[p.clientId]} onChange={(e) => setSelected((s) => ({ ...s, [p.clientId]: e.target.checked }))} style={{ width: 20, height: 20, accentColor: "var(--act)" }} />
              <div className="grow">
                <div className="h3">{firstName(clientById(p.clientId).name)} · {p.exercise}</div>
                <div className="small"><span className="num">{u.kt(p.from)} → <b style={{ color: "var(--act)" }}>{u.kt(p.to)}</b></span> · {p.why}</div>
              </div>
            </label>
          ))}
          <div style={{ padding: 12 }}>
            <button className="btn act block" disabled={selectedCount === 0} onClick={() => { say(`${selectedCount} progressions applied to next session`); setSelected({}); }}>Apply selected</button>
          </div>
        </div>
      </section>}

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
                <div className="small"><Label kind="data">Data</Label> <span className="num">{log.sets} sets{log.summary?.totalReps ? ` · ${log.summary.totalReps} reps` : ""} · {u.fw(log.volumeKg, 0)} · {log.minutes} min · RPE {log.rpe}</span>{log.prs > 0 ? ` · ${log.prs} PR` : ""}</div>
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
                <div className="small"><Label kind="data">Data</Label> <span className="num">{[newCheckIn.sleepHours !== null && `Sleep ${newCheckIn.sleepHours} h`, newCheckIn.energy && `energy ${newCheckIn.energy}/5`, newCheckIn.weightKg !== null && `weight ${u.fw(newCheckIn.weightKg)}`].filter(Boolean).join(" · ")}</span></div>
              </div>
              <span className="tiny">Clients › Check-ins</span>
            </div>
          )}
          {mode === "demo" && <>
          <div className="li"><Avatar initials="OT" size={34} tone="var(--good)" /><div className="grow"><div className="h3">{u.kt("Omar hit a 100 kg squat PR")}</div><div className="small">Send a congratulations?</div></div><button className="btn ghost sm" onClick={() => say("Message sent to Omar")}>Send</button></div>
          <div className="li"><Avatar initials="PS" size={34} /><div className="grow"><div className="h3">Priya submitted a check-in</div><div className="small">{u.kt("Sleep 7.5 h · energy 4/5 · weight 62.3 kg")}</div></div><button className="btn ghost sm" onClick={() => openClient(5)}>View</button></div>
          </>}
          {mode === "live" && !log && !newCheckIn && <div className="li"><div className="small">Nothing yet today. Finished sessions show up here as soon as they are saved.</div></div>}
        </div>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <div className="sect"><h2 className="h2">{clientFirst} today</h2><button className="link" onClick={() => openToday("Recovery")}>Recovery and cardio ›</button></div>
      <div className="hero side short" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => openToday()} onKeyDown={(e) => { if (e.key === "Enter") openToday(); }}>
        <HeroBackdrop art={hero} />
        <div className="hero-body" style={{ maxWidth: 280 }}>
          <span className="gpill caps" style={{ alignSelf: "flex-start" }}>{log ? "Trained today" : "Training today"}</span>
          <h2 className="hero-title" style={{ fontSize: 22 }}>{clientFirst}: {log ? log.workoutName : workout.name}</h2>
          <div className="gpills">
            {log ? (
              <>
                <span className="gpill num">{log.sets} sets</span>
                <span className="gpill num">{u.fw(log.volumeKg, 0)}</span>
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
      </section>

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

/** The four business numbers for the Brief: the coach's own records when live, sample figures in the demo. */
function useBusinessGlance(live: CoachLiveProps | undefined): GlanceTile[] | null {
  const [tiles, setTiles] = useState<GlanceTile[] | null>(() => (live ? null : businessGlance(businessSummary(sampleBusiness(new Date())))));
  useEffect(() => {
    if (!live) return;
    let on = true;
    loadBusiness(live.db, live.coachId).then((r) => { if (on) setTiles(businessGlance(businessSummary(r.input))); }, (e: unknown) => console.error("Couldn't load the business glance", e));
    return () => { on = false; };
  }, [live?.db, live?.coachId]); // eslint-disable-line react-hooks/exhaustive-deps
  return tiles;
}

/** Live: next-session loads for the open client from what they actually logged. Nothing changes until the coach applies. */
function LiveProgressions({ say }: { say: (m: string) => void }) {
  const u = useUnits();
  const store = useStore();
  const { workout } = useApexState(store);
  const { clientName } = useAppInfo();
  const next = useMemo(() => progressWorkout(workout), [workout]);
  const changes = workout.items.flatMap((it) => {
    const to = next.workout.items.find((x) => x.key === it.key);
    return to && (to.kg !== it.kg || to.reps !== it.reps) ? [{ it, to, why: next.reasons[it.key] ?? "" }] : [];
  });
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const on = (key: string) => picked[key] ?? true;
  const count = changes.filter((c) => on(c.it.key)).length;
  if (changes.length === 0) return null;
  const apply = () => {
    const chosen = new Map(changes.filter((c) => on(c.it.key)).map((c) => [c.it.key, c.to]));
    store.saveWorkout({ ...workout, items: workout.items.map((it) => chosen.get(it.key) ?? it) });
    say(`${count} change${count === 1 ? "" : "s"} saved to ${firstName(clientName)}'s next ${workout.name}`);
    setPicked({});
  };
  const show = (it: { kg: number; reps: string }) => `${it.kg ? `${u.fw(it.kg)} × ` : ""}${it.reps}`;
  return (
    <section>
      <div className="sect"><h2 className="h2">Progressions ready · {firstName(clientName)}</h2><Label kind="ai">AI suggestion</Label></div>
      <div className="card flat list">
        {changes.map(({ it, to, why }) => (
          <label key={it.key} className="li" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={on(it.key)} onChange={(e) => setPicked((s) => ({ ...s, [it.key]: e.target.checked }))} style={{ width: 20, height: 20, accentColor: "var(--act)" }} />
            <div className="grow">
              <div className="h3">{exerciseFor(it).name}</div>
              <div className="small"><span className="num">{show(it)} → <b style={{ color: "var(--act)" }}>{show(to)}</b></span> · {u.kt(why)}</div>
            </div>
          </label>
        ))}
        <div style={{ padding: 12 }}>
          <button className="btn act block" disabled={count === 0} onClick={apply}>Apply {count} to {workout.name}</button>
          <div className="tiny" style={{ marginTop: 6 }}>Worked out from the sets {firstName(clientName)} logged last time. Pick another client on Clients to see theirs.</div>
        </div>
      </div>
    </section>
  );
}
