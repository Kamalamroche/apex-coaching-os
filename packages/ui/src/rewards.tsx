import type { CarsLifted, LaurelBoardLine, LaurelId, LaurelState, TopSet } from "@apex/core";
import { CAR_KG, LAUREL_RANKS } from "@apex/core";
import type { ReactNode } from "react";
import { Icons } from "./icons";
import { useUnits } from "./prefs";
import "./rewards.css";

/* Fun rewards: "You lifted three cars" after a workout, and Laurel ranks with the team board. Our own drawings. */

const METAL: Record<LaurelId, string> = { bronze: "var(--bronze)", silver: "var(--silver)", gold: "var(--gold)", marble: "var(--marble)", olympian: "var(--act)" };

/** A laurel wreath: two branches of leaves climbing round a Roman numeral. Faded when not reached yet. */
export function Wreath({ rank, size = 62, earned = true }: { rank: LaurelId; size?: number; earned?: boolean }) {
  const r = LAUREL_RANKS.find((x) => x.id === rank)!;
  const colour = METAL[rank];
  const leaves: ReactNode[] = [];
  const R = 34;
  for (let i = 0; i < 8; i++) {
    const th = (18 + i * 17) * Math.PI / 180; // 0 = bottom, climbing each side
    for (const side of [-1, 1]) {
      const x = 50 + side * R * Math.sin(th);
      const y = 54 + R * Math.cos(th);
      const rot = side < 0 ? th * 180 / Math.PI + 25 : -(th * 180 / Math.PI) - 25;
      leaves.push(<ellipse key={`${i}${side}`} cx={x.toFixed(1)} cy={y.toFixed(1)} rx="3.6" ry="8.5" transform={`rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})`} fill={colour} opacity={earned ? 0.95 - i * 0.04 : 0.32} />);
    }
  }
  return (
    <svg className="rw-wreath" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${r.name} laurel`}>
      {leaves}
      <text x="50" y="63" textAnchor="middle" fontFamily="var(--serif)" fontSize="28" fontWeight="600" fill={earned ? colour : "var(--text3)"}>{r.numeral}</text>
    </svg>
  );
}

/* Thin ribbons placed by hand so they look thrown, not tiled. */
const RIBBONS: [number, number, number, string][] = [[8, 6, 18, "--act"], [22, 12, -30, "--viz-1"], [38, 4, 50, "--viz-3"], [55, 10, -12, "--warn"], [70, 5, 35, "--act"], [86, 14, -48, "--viz-4"], [14, 22, 62, "--warn"], [30, 26, -20, "--act"], [64, 24, 15, "--viz-1"], [80, 30, -60, "--viz-3"], [92, 20, 28, "--act"], [46, 30, -40, "--viz-4"], [6, 36, 10, "--viz-3"], [96, 40, -15, "--warn"]];

/** The moment after a workout: today's total as cars, then share or carry on. */
export function CarsMoment({ eyebrow, cars, totalKg, vsLastKg, vsLastLabel, top, onShare, onContinue, continueLabel = "Continue" }: {
  eyebrow: string; cars: CarsLifted; totalKg: number; vsLastKg: number | null; vsLastLabel: string; top: TopSet | null;
  onShare: () => void; onContinue: () => void; continueLabel?: string;
}) {
  const u = useUnits();
  const shown = Math.min(cars.cars, 5);
  const iconSize = shown <= 3 ? 74 : shown === 4 ? 60 : 50;
  const n = (kg: number) => u.w(kg, 0).toLocaleString("en-GB");
  return (
    <section className="rw-cars" aria-label={cars.title}>
      <div className="rw-ribbons" aria-hidden="true">
        {RIBBONS.map(([x, y, r, c], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%`, transform: `rotate(${r}deg)`, background: `var(${c})`, opacity: i % 3 ? 0.9 : 0.6 }} />)}
      </div>
      <div className="rw-eyebrow">{eyebrow}</div>
      <div className="rw-head">
        <h1 className="rw-ed">{cars.title.replace(/ (\S+ cars?)$/, "\n$1").split("\n").map((l) => <span key={l}>{l}</span>)}</h1>
        <div className="rw-cap">{n(totalKg)} {u.weight} in total</div>
      </div>
      <div className="card rw-carcard">
        <div className="rw-carrow" aria-hidden="true">
          {Array.from({ length: shown }, (_, i) => <Icons.car key={i} width={iconSize} height={iconSize} strokeWidth={1.5} />)}
          {cars.cars > shown && <b className="num">+{cars.cars - shown}</b>}
        </div>
        <div className="small" style={{ textAlign: "center" }}>
          An average car weighs about {u.fw(CAR_KG, 0)}.<br />
          <b style={{ color: "var(--text)" }}>{u.fw(cars.toNext, 0)} more next time and it's {cars.nextWord}.</b>
        </div>
      </div>
      {(vsLastKg !== null || top) && (
        <div className="card rw-stats">
          {vsLastKg !== null && <div><div className="num rw-big">{vsLastKg > 0 ? "+" : vsLastKg < 0 ? "−" : ""}{n(Math.abs(vsLastKg))}<small> {u.weight}</small></div><div className="small">vs last {vsLastLabel}</div></div>}
          {top && <div><div className="num rw-big">{n(top.kg)}<small> {u.weight}</small></div><div className="small">Top set · {top.exercise} × {top.reps}</div></div>}
        </div>
      )}
      <div style={{ flex: 1 }} />
      <button className="btn act block rw-btn" onClick={onShare}><Icons.share width={18} height={18} /> Share it</button>
      <button className="btn ghost block rw-btn" onClick={onContinue}>{continueLabel}</button>
    </section>
  );
}

/** The five ranks with mine lit, and how far to the next. */
export function LaurelLadder({ state }: { state: LaurelState }) {
  return (
    <div className="card rw-ladder">
      <div className="rw-tiers">
        {LAUREL_RANKS.map((r) => {
          const got = state.workouts >= r.at;
          return (
            <div key={r.id} className={got ? "" : "off"}>
              <Wreath rank={r.id} size={62} earned={got} />
              <b>{r.name}</b>
              <span className="num">{r.at}</span>
            </div>
          );
        })}
      </div>
      <div className="rw-next">
        <div className="rw-nextrow">
          <span><b className="num">{state.workouts}</b> <span className="small">workout{state.workouts === 1 ? "" : "s"}</span></span>
          <span className="small">{state.next ? <><b style={{ color: "var(--text)" }}>{state.toNext} more</b> to {state.next.name}</> : <b style={{ color: "var(--text)" }}>Top rank reached</b>}</span>
        </div>
        <div className="rw-bar"><i style={{ width: `${Math.round(state.progress * 100)}%` }} /></div>
      </div>
    </div>
  );
}

export type LaurelLine = LaurelBoardLine;

const initials = (n: string) => n.replace(/\./g, "").split(/\s+/).map((x) => x[0] ?? "").join("").slice(0, 2).toUpperCase();

/** The team, by lifetime workouts, each with their wreath. */
export function LaurelBoard({ lines }: { lines: LaurelLine[] }) {
  return (
    <div className="card rw-board">
      {lines.map((l) => (
        <div key={l.name + l.place} className="rw-line">
          <span className={`num rw-place${l.place === 1 ? " first" : ""}`}>{l.place}</span>
          <span className="rw-av">{initials(l.name)}</span>
          <span className="rw-who">
            <b>{l.name}{l.isMe && <span className="rw-you"> · you</span>}</b>
            <span className="small">{l.workouts} workout{l.workouts === 1 ? "" : "s"}</span>
          </span>
          {l.rank && <Wreath rank={l.rank} size={34} />}
        </div>
      ))}
    </div>
  );
}

/** A slim row that opens the ranks: my wreath, my rank and how far to the next. */
export function LaurelPeek({ state, onOpen }: { state: LaurelState; onOpen: () => void }) {
  return (
    <button className="card rw-peek" onClick={onOpen}>
      {state.rank ? <Wreath rank={state.rank.id} size={44} /> : <Wreath rank="bronze" size={44} earned={false} />}
      <span className="rw-who">
        <b>Laurel ranks{state.rank ? ` · ${state.rank.name}` : ""}</b>
        <span className="small">{state.next ? `${state.toNext} more workout${state.toNext === 1 ? "" : "s"} to ${state.next.name}` : "Top rank reached"}</span>
      </span>
      <Icons.forward width={16} height={16} style={{ flex: "none", color: "var(--text3)" }} />
    </button>
  );
}

/** The full Laurel ranks page: the ladder, then the team board when there is one. */
export function LaurelPage({ state, lines, teamTitle, onBack }: { state: LaurelState; lines: LaurelLine[] | null; teamTitle: string; onBack: () => void }) {
  return (
    <div className="rw-page" role="dialog" aria-label="Laurel ranks">
      <div className="rw-page-in">
        <div className="rw-top">
          <button onClick={onBack} aria-label="Back"><Icons.back width={22} height={22} /></button>
          {lines && <span className="rw-pill">Team challenge</span>}
        </div>
        <div>
          <h1 className="rw-title">Laurel ranks</h1>
          <div className="rw-cap" style={{ letterSpacing: ".42em" }}>Every workout counts</div>
        </div>
        <LaurelLadder state={state} />
        {lines && lines.length > 0 && (
          <>
            <div className="rw-sect">{teamTitle}</div>
            <LaurelBoard lines={lines} />
          </>
        )}
      </div>
    </div>
  );
}
