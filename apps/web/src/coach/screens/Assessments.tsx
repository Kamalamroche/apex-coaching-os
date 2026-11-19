import {
  ASSESSMENT_SETS, ASSESSMENT_TESTS, CORRECTIVES, RETEST_WEEKS, addCorrectives, assessmentPercent, assessmentProfile, compareAssessments, correctivesFor, exerciseById, firstName,
  previousReviewed, retestDue, reviewMessage, shortDate, sideGap, suggestFocus, testByKey, testAnswerText, type Assessment, type TestKey,
} from "@apex/core";
import { useApexState } from "@apex/core/react";
import { AssessmentProfile, CompareTable, Icons, Label, PostureView, ScoreScale } from "@apex/ui";
import { useState } from "react";
import { useAppInfo, useStoreStatus } from "../../app/AppContext";
import { useAssessmentStore, useAssessments } from "../../data/AssessmentContext";
import { useStore } from "../../data/StoreContext";

/* Coach: posture and mobility assessments for one client. Send one, see APEX's score on every test, add feedback,
   choose the focus areas, put correctives into the programme, and compare each re-test with the one before. */

const ALL_FOCUS = [...new Set(ASSESSMENT_TESTS.map((t) => t.focus))];
const VIEW: Partial<Record<TestKey, "front" | "side" | "back">> = { "posture-front": "front", "posture-side": "side", "posture-back": "back" };

const statusText = (a: Assessment, name: string) =>
  a.status === "requested" ? `Waiting for ${name}` : a.status === "submitted" ? "Ready for your feedback" : `Reviewed · ${assessmentPercent(a.items) ?? "–"} / 100`;

export function ClientAssessments({ clientName, say }: { clientName: string; say: (m: string) => void }) {
  const coach = useAppInfo().coachName;
  const { list, status, error } = useAssessments();
  const [open, setOpen] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const name = firstName(clientName) || "Your client";
  if (status === "loading") return <div className="card small">Loading…</div>;
  if (status === "needs-update") return <div className="card small">This needs a quick database update first. Run the assessments SQL in Supabase, then reload.</div>;
  if (status === "error") return <div className="card small">Couldn't load assessments: {error}</div>;

  const current = list.find((a) => a.id === open);
  if (current) return <AssessmentDetail a={current} list={list} name={name} coach={coach} onBack={() => setOpen(null)} say={say} />;
  if (sending) return <SendAssessment name={name} retest={list.some((a) => a.status === "reviewed")} onDone={() => setSending(false)} say={say} />;

  const due = retestDue(list);
  return (
    <>
      {due && (
        <section className="card stack" style={{ gap: 8, borderColor: due.due ? "color-mix(in srgb,var(--act) 45%,var(--line))" : undefined }}>
          <div className="row" style={{ justifyContent: "space-between" }}><span className="h3">{due.due ? "Re-test due" : "Next re-test"}</span><span className="tiny">{shortDate(due.at)}</span></div>
          <div className="small">You asked for a re-test {due.from.retestWeeks} weeks after {name}'s {due.from.title.toLowerCase()}.</div>
          {due.due && <button className="btn act" onClick={() => setSending(true)}>Send the re-test</button>}
        </section>
      )}
      {!list.length && <div className="card stack" style={{ gap: 8 }}><div className="h3">No assessments yet</div><div className="small">Send {name} a posture and mobility assessment. They take the photos and short videos at home, step by step, and APEX scores every test. You add your feedback and choose what to work on.</div></div>}
      <button className="btn act block" onClick={() => setSending(true)}><Icons.plus width={18} height={18} /> Send an assessment</button>
      {list.length > 0 && (
        <div className="card flat list">
          {list.map((a) => (
            <button key={a.id} className="li" onClick={() => setOpen(a.id)}>
              <div className="grow"><div className="h3">{a.title}</div><div className="small">{shortDate(a.createdAt)} · {statusText(a, name)}</div></div>
              {a.status === "submitted" && <span className="tag" style={{ color: "var(--act)" }}>New</span>}
              <span className="tiny">›</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function SendAssessment({ name, retest, onDone, say }: { name: string; retest: boolean; onDone: () => void; say: (m: string) => void }) {
  const store = useAssessmentStore();
  const [set, setSet] = useState(ASSESSMENT_SETS[0]!.key);
  const [tests, setTests] = useState<TestKey[]>(ASSESSMENT_SETS[0]!.tests);
  const [weeks, setWeeks] = useState(8);
  const [busy, setBusy] = useState(false);
  const pick = (k: string) => { const s = ASSESSMENT_SETS.find((x) => x.key === k)!; setSet(k); setTests(s.tests); };
  const toggle = (k: TestKey) => setTests((t) => (t.includes(k) ? t.filter((x) => x !== k) : ASSESSMENT_TESTS.map((x) => x.key).filter((x) => x === k || t.includes(x))));
  const send = async () => {
    setBusy(true);
    try {
      const title = retest ? "Re-test" : ASSESSMENT_SETS.find((s) => s.key === set)!.title;
      await store.request({ title, tests, retestWeeks: weeks });
      say(`Assessment sent · ${name} sees it on Today`);
      onDone();
    } catch (e) { say(e instanceof Error ? e.message : "Couldn't send it"); }
    setBusy(false);
  };
  return (
    <>
      <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={onDone}>← Assessments</button>
      <div><div className="eyebrow">Assessment</div><h2 className="h1" style={{ fontSize: 26 }}>Send an assessment</h2></div>
      <div className="small">{name} takes the photos and videos at home, step by step. APEX scores each test; you add your feedback and choose what to work on.</div>
      <div className="stack" style={{ gap: 8 }}>
        {ASSESSMENT_SETS.map((s) => (
          <button key={s.key} type="button" className={`card row ${set === s.key ? "on" : ""}`} aria-pressed={set === s.key} onClick={() => pick(s.key)} style={{ textAlign: "left", gap: 12, borderColor: set === s.key ? "var(--act)" : undefined, background: set === s.key ? "var(--act-soft)" : undefined }}>
            <span className="grow"><span className="h3" style={{ display: "block" }}>{s.title}</span><span className="tiny">{s.hint}</span></span>
            {set === s.key && <Icons.check width={18} height={18} />}
          </button>
        ))}
      </div>
      <section className="card stack" style={{ gap: 0 }}>
        {ASSESSMENT_TESTS.map((t) => (
          <label key={t.key} className="row" style={{ gap: 10, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
            <input type="checkbox" checked={tests.includes(t.key)} onChange={() => toggle(t.key)} />
            <span className="grow small" style={{ color: "var(--text)" }}>{t.title}</span>
            <span className="tiny">{t.media === "photo" ? "Photo" : t.media === "video" ? "Video" : t.input?.kind === "number" ? t.input.unit === "cm" ? "cm" : "seconds" : ""}</span>
          </label>
        ))}
      </section>
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <span className="small">Re-test every</span>
        <span className="row" style={{ gap: 6 }}>{[...RETEST_WEEKS, 0].map((w) => <button key={w} type="button" className={`chip ${weeks === w ? "on" : ""}`} aria-pressed={weeks === w} onClick={() => setWeeks(w)}>{w ? `${w} wks` : "No re-test"}</button>)}</span>
      </div>
      <button className="btn act block" disabled={!tests.length || busy} onClick={() => void send()}>{busy ? "Sending…" : `Send to ${name}`}</button>
    </>
  );
}

function AssessmentDetail({ a, list, name, coach, onBack, say }: { a: Assessment; list: Assessment[]; name: string; coach: string; onBack: () => void; say: (m: string) => void }) {
  const store = useAssessmentStore();
  const apex = useStore();
  const { workout } = useApexState(apex);
  const { status: programme } = useStoreStatus();
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(a.items.map((i) => [i.key, i.note])));
  const [summary, setSummary] = useState(a.summary);
  const suggested = suggestFocus(a.items);
  const [focus, setFocus] = useState<string[]>(a.focus.length ? a.focus : suggested);
  const [picked, setPicked] = useState<number[]>(() => correctivesFor(a.focus.length ? a.focus : suggested).slice(0, 4));
  const [busy, setBusy] = useState(false);
  const before = previousReviewed(list, a);
  const pct = assessmentPercent(a.items);

  if (a.status === "requested") {
    return (
      <>
        <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={onBack}>← Assessments</button>
        <section className="card stack">
          <div className="h3">{a.title}</div>
          <div className="small">Sent {shortDate(a.createdAt)}. Waiting for {name} to take the photos and answer the tests.</div>
          <div className="small">{a.items.filter((i) => i.media || i.answer).length} of {a.items.length} tests done so far.</div>
          <button className="btn ghost" onClick={() => void store.remove(a.id).then(() => { say("Assessment taken back"); onBack(); }, (e: Error) => say(e.message))}>Take it back</button>
        </section>
      </>
    );
  }

  const toggleFocus = (f: string) => {
    const next = focus.includes(f) ? focus.filter((x) => x !== f) : [...focus, f];
    setFocus(next);
    setPicked((p) => p.filter((id) => correctivesFor(next).includes(id)));
  };
  const save = async (done: boolean) => {
    setBusy(true);
    try {
      await store.review(a.id, { reviews: Object.fromEntries(a.items.map((i) => [i.key, { note: (notes[i.key] ?? "").trim() }])), summary, focus, done });
      if (done) apex.sendMessage("coach", reviewMessage({ ...a, focus, summary }, firstName(coach) || "Your coach"));
      say(done ? `Feedback sent · ${name} sees the results now` : "Saved");
      if (done) onBack();
    } catch (e) { say(e instanceof Error ? e.message : "Couldn't save"); }
    setBusy(false);
  };
  const addToProgramme = () => {
    if (!picked.length) return;
    apex.saveWorkout(addCorrectives(workout, picked));
    say(`${picked.length} correctives added to the top of ${workout.name}`);
  };
  const sideNow = a.items.find((i) => i.key === "posture-side");
  const sideBefore = before?.items.find((i) => i.key === "posture-side");
  const reviewed = a.status === "reviewed";

  return (
    <>
      <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={onBack}>← Assessments</button>
      <div><div className="eyebrow">{name} · {shortDate(a.submittedAt ?? a.createdAt)}</div><h2 className="h1" style={{ fontSize: 26 }}>{a.title}</h2></div>
      <AssessmentProfile
        percent={pct}
        headline={pct === null ? "Not scored yet" : pct >= 80 ? "Moving well" : pct >= 60 ? `Good base, ${suggested.length} to work on` : `${suggested.length} areas to work on`}
        sub={`APEX's score from ${name}'s photos and answers, out of 3 for each of ${a.items.length} tests.`}
        rows={assessmentProfile(a)}
        label={<Label kind="data">APEX score</Label>}
      />
      {before && (
        <section className="card stack">
          <div className="sect" style={{ marginBottom: 0 }}><span className="h3">Before and after</span><Label kind="data">Data</Label></div>
          {sideNow?.points && sideBefore?.points && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div className="stack" style={{ gap: 4 }}><span className="tiny">{shortDate(before.createdAt)}</span><PostureView url={sideBefore.media?.url ?? null} points={sideBefore.points} aspect={sideBefore.aspect} view="side" measures={sideBefore.measures} height={220} /></div>
              <div className="stack" style={{ gap: 4 }}><span className="tiny">{shortDate(a.createdAt)}</span><PostureView url={sideNow.media?.url ?? null} points={sideNow.points} aspect={sideNow.aspect} view="side" measures={sideNow.measures} height={220} /></div>
            </div>
          )}
          <CompareTable rows={compareAssessments(before, a)} before={shortDate(before.createdAt)} after={shortDate(a.createdAt)} />
        </section>
      )}
      {a.items.map((it) => {
        const t = testByKey(it.key);
        const view = VIEW[it.key];
        const gap = sideGap(it);
        return (
          <section key={it.key} className="card stack" style={{ gap: 10 }}>
            <div className="sect" style={{ marginBottom: 0 }}><span className="h3">{t.title}</span>{it.pain && <Label kind="crit">Pain</Label>}</div>
            {view ? <PostureView url={it.media?.url ?? null} points={it.points} aspect={it.aspect} view={view} measures={it.measures} height={260} />
              : it.media?.kind === "video" && it.media.url ? <video src={it.media.url} controls playsInline style={{ width: "100%", borderRadius: "var(--r-sm)", background: "#000", maxHeight: 320 }} />
              : it.media?.kind === "photo" && it.media.url ? <img src={it.media.url} alt={t.title} style={{ width: "100%", borderRadius: "var(--r-sm)" }} /> : null}
            {it.measures.length > 0 && (
              <div className="stack" style={{ gap: 6 }}>
                {it.measures.map((m) => <div key={m.label} className="row" style={{ justifyContent: "space-between" }}><span><span className="small" style={{ color: "var(--text)" }}>{m.label}</span><span className="tiny" style={{ display: "block", color: m.flag ? "var(--act)" : "var(--good)" }}>{m.note}</span></span><b className="num" style={{ color: m.flag ? "var(--act)" : "var(--text)" }}>{m.value}°</b></div>)}
              </div>
            )}
            {t.group === "mobility" && <div className="row" style={{ justifyContent: "space-between" }}><span className="small">{name}'s answer</span><b className="small num" style={{ color: "var(--text)" }}>{testAnswerText(it)}</b></div>}
            {gap && <div className="row" style={{ gap: 8 }}><Label kind="insight">Insight</Label><span className="small">{gap}</span></div>}
            <div className="row" style={{ justifyContent: "space-between" }}><span className="tiny">APEX score</span><Label kind="data">Data</Label></div>
            <ScoreScale value={it.score} />
            <div className="tiny">Look for: {t.lookFor}</div>
            <label className="stack" style={{ gap: 4 }}>
              <span className="row" style={{ justifyContent: "space-between" }}><span className="tiny">Your feedback</span><Label kind="dec">Coach decision</Label></span>
              <textarea className="field" rows={2} maxLength={600} placeholder="What you see and the one thing to work on" value={notes[it.key] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [it.key]: e.target.value }))} />
            </label>
          </section>
        );
      })}
      <section className="card stack">
        <div className="sect" style={{ marginBottom: 0 }}><span className="h3">Focus for the next block</span><Label kind="ai">AI suggestion</Label></div>
        <div className="tiny">Suggested from the lowest scores. Tap to keep, drop or add.</div>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {ALL_FOCUS.map((f) => <button key={f} type="button" className={`chip ${focus.includes(f) ? "on" : ""}`} aria-pressed={focus.includes(f)} onClick={() => toggleFocus(f)}>{focus.includes(f) ? "✓ " : "+ "}{f}</button>)}
        </div>
        {focus.length > 0 && programme === "ready" && (
          <>
            <div className="tiny" style={{ marginTop: 6 }}>Correctives from the library for these. Pick the ones you want at the top of {workout.name}.</div>
            <div className="stack" style={{ gap: 0 }}>
              {correctivesFor(focus).map((id) => (
                <label key={id} className="row" style={{ gap: 10, padding: "7px 0" }}>
                  <input type="checkbox" checked={picked.includes(id)} onChange={() => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))} />
                  <span className="grow small" style={{ color: "var(--text)" }}>{exerciseById(id).name}</span>
                  <span className="tiny">{Object.entries(CORRECTIVES).find(([, ids]) => ids.includes(id))?.[0]}</span>
                </label>
              ))}
            </div>
            <button className="btn ghost block" disabled={!picked.length} onClick={addToProgramme}>Add {picked.length || ""} correctives to {name}'s programme</button>
          </>
        )}
      </section>
      <section className="card stack">
        <div className="sect" style={{ marginBottom: 0 }}><span className="h3">Note to {name}</span><Label kind="dec">Coach decision</Label></div>
        <textarea className="field" rows={3} maxLength={2000} placeholder="What the results mean and what you'll work on together" value={summary} onChange={(e) => setSummary(e.target.value)} />
      </section>
      <button className="btn act block" disabled={busy} onClick={() => void save(true)}>{busy ? "Sending…" : reviewed ? `Update ${name}'s results` : `Send results to ${name}`}</button>
      {!reviewed && <button className="btn ghost block" disabled={busy} onClick={() => void save(false)}>Save for later</button>}
    </>
  );
}
