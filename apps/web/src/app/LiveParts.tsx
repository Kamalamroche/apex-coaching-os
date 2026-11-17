import { LIVE_PRESETS, buildIntervals, endLive, liveClock, liveView, pauseLive, planSeconds, resumeLive, skipLive, startLive, type LiveState, type LiveView } from "@apex/core";
import { Icons, LiveTimerFace, type LiveFace } from "@apex/ui";
import { useEffect, useRef, useState } from "react";
import { useLiveLink, useLivePeople, useLiveState } from "../data/live";

/* Live sessions: the coach's control screen, the client's follow screen, and the "live now" banner. */

/** Ticks four times a second while a session runs. */
function useLiveView(state: LiveState | null, offset: number): LiveView | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state || state.status !== "live") return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [state]);
  return state ? liveView(state, now, offset) : null;
}

/** Spoken cues: the move at the start of each block, then 3, 2, 1. */
function useLiveVoice(v: LiveView | null, on: boolean) {
  const last = useRef<{ index: number; left: number }>({ index: -1, left: -1 });
  useEffect(() => {
    if (!on || !v?.block || v.status !== "live" || typeof speechSynthesis === "undefined") return;
    const say = (t: string) => { const u = new SpeechSynthesisUtterance(t); u.lang = "en-GB"; speechSynthesis.cancel(); speechSynthesis.speak(u); };
    if (v.index !== last.current.index) say(v.block.kind === "work" ? v.block.name : v.next ? `${v.block.name}. Next, ${v.next.name}` : v.block.name);
    else if (v.left !== last.current.left && v.left >= 1 && v.left <= 3) say(String(v.left));
    last.current = { index: v.index, left: v.left };
  }, [v?.index, v?.left, v?.status, on]); // eslint-disable-line react-hooks/exhaustive-deps
}

const faceOf = (v: LiveView, s: LiveState): LiveFace => ({
  title: s.plan.title,
  name: v.block?.name ?? "Done",
  kind: v.block?.kind ?? "rest",
  clock: liveClock(v.left),
  progress: v.progress,
  round: v.round,
  next: v.next?.name ?? null,
  paused: v.status === "paused",
});

/** Coach: build the intervals, start, and run the timer for everyone. */
export function CoachLiveSession({ coach, onBack, say }: { coach: string; onBack: () => void; say: (m: string) => void }) {
  const link = useLiveLink();
  const { state } = useLiveState();
  const people = useLivePeople();
  const v = useLiveView(state, 0);
  const [voice, setVoice] = useState(true);
  useLiveVoice(v, voice);
  const [preset, setPreset] = useState(LIVE_PRESETS[0]!);
  const [form, setForm] = useState(() => ({ title: preset.title, work: String(preset.work), rest: String(preset.rest), rounds: String(preset.rounds), moves: preset.moves.join("\n") }));
  // The session runs out on its own: tell everyone it's over.
  useEffect(() => { if (link && state && v?.status === "done") link.send(endLive(state, Date.now())); }, [v?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!link) return null;

  const plan = buildIntervals({ title: form.title, work: Number(form.work) || 0, rest: Number(form.rest) || 0, rounds: Number(form.rounds) || 1, moves: form.moves.split(/\n|,/) });
  const send = (s: LiveState) => link.send(s);
  const now = () => Date.now();

  if (state && v) {
    return (
      <>
        <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={onBack}>← Back</button>
        <LiveTimerFace f={faceOf(v, state)} top={<div className="row" style={{ justifyContent: "space-between" }}><span className="live-dot">Live</span><span className="tiny">{people.length ? `${people.length} following` : "Waiting for clients"}</span></div>}>
          <div className="live-ctrl">
            <button className="btn ghost" aria-label="Back one block" onClick={() => send(skipLive(state, now(), -1))}><Icons.prev width={18} height={18} /></button>
            {state.status === "paused"
              ? <button className="btn act" onClick={() => send(resumeLive(state, now()))}>Resume</button>
              : <button className="btn act" onClick={() => send(pauseLive(state, now()))}>Pause</button>}
            <button className="btn ghost" aria-label="Skip to next block" onClick={() => send(skipLive(state, now()))}><Icons.next width={18} height={18} /></button>
          </div>
        </LiveTimerFace>
        <div className="card stack" style={{ gap: 8 }}>
          <div className="h3">Following now</div>
          <div className="small">{people.length ? people.join(", ") : "No one yet. Clients see a Live now banner on their Today screen."}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className={`chip ${voice ? "on" : ""}`} aria-pressed={voice} onClick={() => setVoice(!voice)}><Icons.headphones width={14} height={14} /> Voice cues</button>
          <button className="btn ghost grow" onClick={() => { send(endLive(state, now())); say("Live session ended"); }}>End session</button>
        </div>
      </>
    );
  }

  const pick = (p: (typeof LIVE_PRESETS)[number]) => { setPreset(p); setForm({ title: p.title, work: String(p.work), rest: String(p.rest), rounds: String(p.rounds), moves: p.moves.join("\n") }); };
  const field = (k: "work" | "rest" | "rounds", label: string, unit: string) => (
    <label className="stack" style={{ gap: 4 }}><span className="tiny">{label}</span><span className="row" style={{ gap: 6 }}><input className="field num" inputMode="numeric" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value.replace(/\D/g, "").slice(0, 3) })} />{unit && <span className="tiny">{unit}</span>}</span></label>
  );
  return (
    <>
      <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={onBack}>← Back</button>
      <div><div className="eyebrow">Live session</div><h1 className="h1">Train together, live</h1></div>
      <div className="small">You run one timer and your clients follow it on their phones, in step, wherever they are. Pair it with a video call from a class if you like.</div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {LIVE_PRESETS.map((p) => <button key={p.key} type="button" className={`chip ${preset.key === p.key ? "on" : ""}`} aria-pressed={preset.key === p.key} onClick={() => pick(p)}>{p.title}</button>)}
      </div>
      <section className="card stack">
        <input className="field" maxLength={60} aria-label="Session name" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>{field("work", "Work", "s")}{field("rest", "Rest", "s")}{field("rounds", "Rounds", "")}</div>
        <label className="stack" style={{ gap: 4 }}><span className="tiny">Moves, one per line. They rotate through the rounds.</span><textarea className="field" rows={4} value={form.moves} onChange={(e) => setForm({ ...form, moves: e.target.value })} /></label>
        <div className="tiny">{plan.blocks.filter((b) => b.kind === "work").length} rounds · {liveClock(planSeconds(plan))} in all, with a 10 second get ready.</div>
        <button className="btn act block" onClick={() => { send(startLive(plan, coach, Date.now())); say("You're live · clients can join now"); }}><Icons.play width={18} height={18} /> Go live</button>
      </section>
    </>
  );
}

/** Client: on Today while the coach is live. */
export function LiveNowBanner({ onJoin }: { onJoin: () => void }) {
  const { state } = useLiveState();
  if (!state) return null;
  return (
    <button className="card live-banner" onClick={onJoin}>
      <span className="live-dot">Live now</span>
      <span className="grow" style={{ textAlign: "left" }}><span className="h3">{state.plan.title}</span><span className="tiny" style={{ display: "block" }}>{state.coach} is running it. Tap to train along.</span></span>
      <Icons.forward width={18} height={18} />
    </button>
  );
}

/** Client: follow the coach's timer. Leaving never stops it for anyone else. */
export function LiveFollow({ onClose }: { onClose: () => void }) {
  const link = useLiveLink();
  const { state, offset } = useLiveState();
  const v = useLiveView(state, offset);
  const [voice, setVoice] = useState(true);
  useLiveVoice(v, voice);
  useEffect(() => { link?.follow(true); return () => link?.follow(false); }, [link]);
  return (
    <div className="live-follow">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="live-dot">{state ? "Live" : "Ended"}</span>
        <button className="btn ghost" onClick={onClose}>Leave</button>
      </div>
      {state && v ? (
        <LiveTimerFace f={faceOf(v, state)}>
          <button type="button" className={`chip ${voice ? "on" : ""}`} aria-pressed={voice} onClick={() => setVoice(!voice)}><Icons.headphones width={14} height={14} /> Voice cues</button>
          <div className="tiny">{state.coach} runs the timer. Your phone stays in step.</div>
        </LiveTimerFace>
      ) : (
        <div className="card stack" style={{ margin: "auto 0" }}><div className="h2">That's a wrap.</div><div className="small">The live session has finished. Nice work.</div><button className="btn act" onClick={onClose}>Done</button></div>
      )}
    </div>
  );
}
