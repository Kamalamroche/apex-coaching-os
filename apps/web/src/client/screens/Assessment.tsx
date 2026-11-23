import { assessmentPercent, assessmentProfile, emptyAnswer, firstName, postureMeasures, shortDate, submitProblem, testByKey, type Assessment, type AssessmentItem, type BodyPoint, type ClientAnswer, type TestKey } from "@apex/core";
import { AssessmentProfile, CameraGuide, Icons, Label, PostureView, ScoreScale, TestDemo } from "@apex/ui";
import { useEffect, useRef, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { loadPose } from "../../app/pose";
import { useAssessmentStore, useAssessments } from "../../data/AssessmentContext";
import { useViewScroll } from "../../app/useViewScroll";

/* Client: the assessment the coach sent. Each test explains where to put the phone, then the camera (with a grid,
   an outline and a timer) takes the photo, or the phone films a short video, or the client answers a simple
   measure. Posture photos are measured on the phone. APEX scores each test; the coach adds feedback. */

const VIEW: Partial<Record<TestKey, "front" | "side" | "back">> = { "posture-front": "front", "posture-side": "side", "posture-back": "back" };
const SEEN_KEY = "apex-assess-seen";
const seenGet = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]; } catch { return []; } };
const seenAdd = (id: string) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seenGet(), id].slice(-20))); } catch { /* this visit only */ } };
const done = (it: AssessmentItem) => {
  const t = testByKey(it.key);
  if (t.media && !it.media) return false;
  if (!t.input) return true;
  const a = it.answer;
  if (t.input.kind === "checks") return Array.isArray(a?.value) && a.value.length > 0;
  return t.input.perSide ? a?.left !== undefined && a.left !== "" && a?.right !== undefined && a.right !== "" : a?.value !== undefined && a.value !== "";
};

/** Today: the assessment waiting to be done, or fresh results. */
export function AssessmentBanner() {
  const { list } = useAssessments();
  const { coachName } = useAppInfo();
  const [open, setOpen] = useState<string | null>(null);
  const waiting = list.find((a) => a.status === "requested");
  const fresh = list.find((a) => a.status === "reviewed" && a.reviewedAt && Date.now() - Date.parse(a.reviewedAt) < 14 * 86400000 && !seenGet().includes(a.id));
  const show = waiting ?? fresh;
  const current = list.find((a) => a.id === open);
  return (
    <>
      {show && (
        <button className="card as-banner" onClick={() => { setOpen(show.id); if (show.status === "reviewed") seenAdd(show.id); }}>
          <span className="as-ico"><Icons.camera width={20} height={20} /></span>
          <span className="grow"><span className="h3" style={{ display: "block" }}>{show.status === "requested" ? `${coachName} sent you an assessment` : "Your assessment results are in"}</span><span className="tiny">{show.status === "requested" ? `${show.title} · ${show.tests.length} tests · ${show.items.filter(done).length ? `${show.items.filter(done).length} done` : `about ${Math.max(5, show.tests.length * 2)} minutes`}` : `${show.title} · ${assessmentPercent(show.items) ?? "–"} / 100 · with ${coachName}'s feedback`}</span></span>
          <Icons.forward width={18} height={18} />
        </button>
      )}
      {current && <div className="as-page"><div className="as-page-in"><AssessmentScreen a={current} onClose={() => setOpen(null)} /></div></div>}
    </>
  );
}

/** More: every assessment, newest first. */
export function AssessmentList() {
  const { list, status } = useAssessments();
  const { coachName } = useAppInfo();
  const [open, setOpen] = useState<string | null>(null);
  const current = list.find((a) => a.id === open);
  useViewScroll(current ? open : null);
  if (current) return <AssessmentScreen a={current} onClose={() => setOpen(null)} />;
  const title = <div><div className="eyebrow">From {coachName}</div><h1 className="h1">Assessments</h1></div>;
  if (status === "loading") return <>{title}<div className="card small">Loading…</div></>;
  if (!list.length) return <>{title}<div className="card small">No assessments yet. When {coachName} sends you a posture and mobility check, it shows up here and on Today.</div></>;
  return (
    <>{title}
    <div className="card flat list">
      {list.map((a) => (
        <button key={a.id} className="li" onClick={() => setOpen(a.id)}>
          <div className="grow"><div className="h3">{a.title}</div><div className="small">{shortDate(a.createdAt)} · {a.status === "requested" ? "To do" : a.status === "submitted" ? `With ${coachName}` : `${assessmentPercent(a.items) ?? "–"} / 100`}</div></div>
          <span className="tiny">›</span>
        </button>
      ))}
    </div>
    </>
  );
}

function AssessmentScreen({ a, onClose }: { a: Assessment; onClose: () => void }) {
  const store = useAssessmentStore();
  const { coachName } = useAppInfo();
  const [test, setTest] = useState<TestKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (test) return <TestStep a={a} k={test} onDone={(next) => setTest(next)} />;
  if (a.status !== "requested") return <Results a={a} onClose={onClose} />;
  const next = a.items.find((i) => !done(i));
  const send = async () => {
    const p = submitProblem(a);
    if (p) return setProblem(p);
    setBusy(true);
    try { await store.submit(a.id); onClose(); } catch (e) { setProblem(e instanceof Error ? e.message : "Couldn't send it"); }
    setBusy(false);
  };
  return (
    <>
      <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={onClose}>← Back</button>
      <div><div className="eyebrow">From {coachName}</div><h1 className="h1">{a.title}</h1></div>
      <div className="small">Do the tests in any order. Wear fitted clothes, and find a spot with space and good light. If anything hurts, stop and tick "It hurt".</div>
      <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {a.items.map((it, n) => (
          <button key={it.key} className="as-test" onClick={() => setTest(it.key)}>
            <span className={`as-dot ${done(it) ? "done" : ""}`}>{done(it) ? <Icons.check width={14} height={14} /> : n + 1}</span>
            <span className="grow"><span className="small" style={{ color: "var(--text)", display: "block" }}>{testByKey(it.key).title}</span><span className="tiny">{testByKey(it.key).media === "photo" ? "Photo" : testByKey(it.key).media === "video" ? "Short video" : "Measure"}</span></span>
            <Icons.forward width={16} height={16} />
          </button>
        ))}
      </section>
      {problem && <div className="small" style={{ color: "var(--crit)" }}>{problem}</div>}
      {next ? <button className="btn act block" onClick={() => setTest(next.key)}>{a.items.some(done) ? "Next test" : "Start"}</button> : <button className="btn act block" disabled={busy} onClick={() => void send()}>{busy ? "Sending…" : `Send to ${coachName}`}</button>}
    </>
  );
}

function TestStep({ a, k, onDone }: { a: Assessment; k: TestKey; onDone: (next: TestKey | null) => void }) {
  const store = useAssessmentStore();
  const t = testByKey(k);
  const it = a.items.find((i) => i.key === k)!;
  const n = a.tests.indexOf(k);
  const [ans, setAns] = useState<Omit<ClientAnswer, "media">>(() => ({ ...emptyAnswer(), points: it.points, aspect: it.aspect, measures: it.measures, answer: it.answer, pain: it.pain }));
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(it.media?.url ?? null);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const view = VIEW[k];
  useEffect(() => () => { if (preview?.startsWith("blob:") && file) URL.revokeObjectURL(preview); }, [preview, file]);

  const took = (blob: Blob, points: BodyPoint[] | null, aspect: number) => {
    setCamera(false);
    setFile(blob);
    setPreview(URL.createObjectURL(blob));
    const measures = view ? postureMeasures(view, points, aspect) : [];
    setAns((x) => ({ ...x, points, aspect, measures }));
    setProblem(view && !measures.length ? "APEX couldn't see your whole body in that photo. Take it again with your feet and head in the frame." : null);
  };
  const picked = async (f: File | undefined) => {
    if (!f) return;
    if (view) {
      const img = await createImageBitmap(f).catch(() => null);
      const points = img ? await findBody(img) : null;
      took(f, points, img ? img.width / img.height : 0.75);
    } else { setFile(f); setPreview(URL.createObjectURL(f)); setProblem(null); }
  };
  const has = !!(file || it.media);
  const input = t.input;
  const setA = (patch: NonNullable<ClientAnswer["answer"]>) => setAns((x) => ({ ...x, answer: { ...(x.answer ?? {}), ...patch } }));
  const ready = (!t.media || has) && done({ ...it, ...ans, media: has ? it.media ?? { path: "", kind: t.media ?? "photo", url: null } : null });
  const save = async () => {
    setBusy(true);
    try {
      await store.saveAnswer(a.id, k, ans, file);
      const next = a.tests.slice(n + 1).concat(a.tests.slice(0, n)).find((x) => x !== k && !done(a.items.find((i) => i.key === x)!));
      onDone(next ?? null);
    } catch (e) { setProblem(e instanceof Error ? e.message : "Couldn't save"); }
    setBusy(false);
  };

  return (
    <>
      <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={() => onDone(null)}>← All tests</button>
      <div><div className="eyebrow">Test {n + 1} of {a.tests.length}</div><h2 className="h1" style={{ fontSize: 26 }}>{t.title}</h2></div>
      <TestDemo test={k} />
      <ol className="as-steps small">{t.how.map((h) => <li key={h}>{h}</li>)}</ol>
      {t.media === "photo" && (
        <section className="card stack">
          {preview && view ? <PostureView url={preview} points={ans.points} aspect={ans.aspect} view={view} measures={ans.measures} height={320} /> : preview ? <img src={preview} alt="" style={{ width: "100%", borderRadius: "var(--r-sm)" }} /> : null}
          {ans.measures.length > 0 && <div className="stack" style={{ gap: 4 }}><Label kind="data">Measured on your photo</Label>{ans.measures.map((m) => <div key={m.label} className="row" style={{ justifyContent: "space-between" }}><span className="small">{m.label}</span><b className="num small">{m.value}°</b></div>)}</div>}
          <div className="row" style={{ gap: 8 }}>
            {typeof navigator.mediaDevices?.getUserMedia === "function" && <button className="btn act grow" onClick={() => setCamera(true)}><Icons.camera width={18} height={18} /> {preview ? "Take it again" : "Open the camera"}</button>}
            <label className="btn ghost grow" style={{ textAlign: "center" }}>Choose a photo<input type="file" accept="image/*" hidden onChange={(e) => void picked(e.target.files?.[0])} /></label>
          </div>
        </section>
      )}
      {t.media === "video" && (
        <section className="card stack">
          {preview && <video src={preview} controls playsInline style={{ width: "100%", borderRadius: "var(--r-sm)", background: "#000", maxHeight: 320 }} />}
          <label className="btn act block" style={{ textAlign: "center" }}><Icons.camera width={18} height={18} /> {preview ? "Film it again" : "Film it"}<input type="file" accept="video/*" capture="environment" hidden onChange={(e) => void picked(e.target.files?.[0])} /></label>
          <div className="tiny">Keep it short: the reps, nothing else. Up to 50 MB.</div>
        </section>
      )}
      {input && (
        <section className="card stack">
          <div className="h3">{input.label}</div>
          {input.kind === "choice" && (input.perSide ? (["left", "right"] as const) : (["value"] as const)).map((side) => (
            <div key={side} className="stack" style={{ gap: 6 }}>
              {input.perSide && <span className="tiny">{side === "left" ? "Left hand on top" : "Right hand on top"}</span>}
              <div className="as-choice">{input.options.map((o) => <button key={o} type="button" className={`chip ${ans.answer?.[side] === o ? "on" : ""}`} aria-pressed={ans.answer?.[side] === o} onClick={() => setA({ [side]: o })}>{o}</button>)}</div>
            </div>
          ))}
          {input.kind === "number" && (
            <div style={{ display: "grid", gridTemplateColumns: input.perSide ? "1fr 1fr" : "1fr", gap: 10 }}>
              {(input.perSide ? (["left", "right"] as const) : (["value"] as const)).map((side) => (
                <label key={side} className="stack" style={{ gap: 4 }}><span className="tiny">{side === "left" ? "Left" : side === "right" ? "Right" : "Result"}</span>
                  <span className="row" style={{ gap: 6 }}><input className="field num" inputMode="numeric" value={String(ans.answer?.[side] ?? "")} onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, "").slice(0, 2); setA({ [side]: v === "" ? "" : Math.min(input.max, Number(v)) }); }} /><span className="tiny">{input.unit === "s" ? "seconds" : "cm"}</span></span>
                </label>
              ))}
            </div>
          )}
          {input.kind === "checks" && (
            <div className="as-choice">
              {[...input.options, input.none].map((o) => {
                const cur = Array.isArray(ans.answer?.value) ? ans.answer.value : [];
                const on = cur.includes(o);
                const nextVal = o === input.none ? (on ? [] : [o]) : on ? cur.filter((x) => x !== o) : [...cur.filter((x) => x !== input.none), o];
                return <button key={o} type="button" className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setA({ value: nextVal })}>{o}</button>;
              })}
            </div>
          )}
        </section>
      )}
      <label className="row" style={{ gap: 10 }}><input type="checkbox" checked={ans.pain} onChange={(e) => setAns((x) => ({ ...x, pain: e.target.checked }))} /><span className="small">It hurt</span></label>
      {problem && <div className="small" style={{ color: "var(--crit)" }}>{problem}</div>}
      <button className="btn act block" disabled={!ready || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save and continue"}</button>
      {camera && view && <PostureCamera view={view} title={t.title} step={`Test ${n + 1} of ${a.tests.length}`} onTake={took} onClose={() => setCamera(false)} />}
    </>
  );
}

/** Body points on a still photo, or null when the pose model can't load or no one is in it. */
async function findBody(src: ImageBitmap | HTMLCanvasElement): Promise<BodyPoint[] | null> {
  try {
    const pose = await loadPose();
    const r = pose.detectForVideo(src as HTMLCanvasElement, performance.now());
    const lm = r.landmarks[0];
    return lm ? lm.map((p) => ({ x: p.x, y: p.y, visibility: p.visibility ?? 1 })) : null;
  } catch { return null; }
}

/** Full-screen camera with the guide drawn over it and a timer, so the client can stand back and pose. */
function PostureCamera({ view, title, step, onTake, onClose }: { view: "front" | "side" | "back"; title: string; step: string; onTake: (b: Blob, points: BodyPoint[] | null, aspect: number) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [timer, setTimer] = useState(5);
  const [count, setCount] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  useEffect(() => {
    let stream: MediaStream | null = null;
    let gone = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false }).then((s) => {
      if (gone) { s.getTracks().forEach((x) => x.stop()); return; }
      stream = s;
      if (video.current) { video.current.srcObject = s; void video.current.play(); }
    }, () => setProblem("APEX can't use the camera. Allow it in your browser settings, or choose a photo instead."));
    void loadPose().catch(() => null);
    return () => { gone = true; stream?.getTracks().forEach((x) => x.stop()); };
  }, [facing]);
  const snap = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const points = await findBody(c);
    c.toBlob((b) => { if (b) onTake(b, points, c.width / c.height); }, "image/jpeg", 0.88);
  };
  const shoot = () => {
    if (!timer) return void snap();
    let n = timer;
    setCount(n);
    const id = window.setInterval(() => {
      n -= 1;
      if (n <= 0) { window.clearInterval(id); setCount(null); void snap(); } else setCount(n);
    }, 1000);
  };
  return (
    <div className="as-cam" role="dialog" aria-label={`Camera: ${title}`}>
      <video ref={video} playsInline muted style={facing === "user" ? { transform: "scaleX(-1)" } : undefined} />
      <CameraGuide view={view} />
      {count !== null && <div className="as-count" aria-live="assertive">{count}</div>}
      <div className="as-cam-top"><span className="as-pill">{step}</span><button className="as-pill" onClick={onClose} aria-label="Close the camera">✕</button></div>
      <div className="as-cam-bottom">
        <div className="eyebrow" style={{ color: "rgba(255,255,255,.8)" }}>{title}</div>
        <div className="row" style={{ gap: 8 }}><span className="as-pill">Whole body in the outline</span><span className="as-pill">Phone upright</span></div>
        {problem && <div className="small" style={{ color: "#fff" }}>{problem}</div>}
        <div className="row" style={{ justifyContent: "space-between", width: "100%", maxWidth: 360 }}>
          <button className="as-pill" onClick={() => setTimer(timer === 5 ? 10 : timer === 10 ? 0 : 5)}>Timer {timer ? `${timer} s` : "off"}</button>
          <button className="as-shutter" aria-label="Take the photo" disabled={count !== null || !!problem} onClick={shoot} />
          <button className="as-pill" onClick={() => setFacing(facing === "user" ? "environment" : "user")}>Flip</button>
        </div>
      </div>
    </div>
  );
}

function Results({ a, onClose }: { a: Assessment; onClose: () => void }) {
  const { coachName } = useAppInfo();
  const pct = assessmentPercent(a.items);
  return (
    <>
      <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={onClose}>← Back</button>
      <div><div className="eyebrow">{shortDate(a.createdAt)}</div><h1 className="h1">{a.title}</h1></div>
      {a.status === "submitted" && <div className="card small">Sent. {coachName} is looking at it and will add feedback. Your scores are below.</div>}
      <AssessmentProfile percent={pct} headline={pct === null ? "Scoring…" : pct >= 80 ? "Moving well" : pct >= 60 ? "A good base" : "Plenty to work on"} sub={`Out of 3 for each of ${a.items.length} tests.`} rows={assessmentProfile(a)} label={<Label kind="data">APEX score</Label>} />
      {a.status === "reviewed" && (a.summary || a.focus.length > 0) && (
        <section className="card stack">
          <div className="sect" style={{ marginBottom: 0 }}><span className="h3">From {coachName}</span><Label kind="dec">Coach decision</Label></div>
          {a.summary && <div className="small" style={{ color: "var(--text)", whiteSpace: "pre-wrap" }}>{a.summary}</div>}
          {a.focus.length > 0 && <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{a.focus.map((f) => <span key={f} className="chip on">{f}</span>)}</div>}
        </section>
      )}
      {a.items.map((it) => (
        <section key={it.key} className="card stack" style={{ gap: 8 }}>
          <div className="h3">{testByKey(it.key).title}</div>
          {VIEW[it.key] && it.points && <PostureView url={it.media?.url ?? null} points={it.points} aspect={it.aspect} view={VIEW[it.key]!} measures={it.measures} height={220} />}
          <ScoreScale value={it.score} />
          {a.status === "reviewed" && it.note && <div className="small" style={{ color: "var(--text)" }}><b>{firstName(coachName)}:</b> {it.note}</div>}
        </section>
      ))}
    </>
  );
}
