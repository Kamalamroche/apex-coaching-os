import { CLIENTS, dayTotals, habitsOn, isDone, localDate } from "@apex/core";
import { Avatar, BackLink, Icons } from "@apex/ui";
import { useState } from "react";
import { SampleNote } from "../../app/AppContext";
import { useAppInfo } from "../../app/AppContext";
import { useLifestyle } from "../../data/LifestyleContext";
import { ConnectedApps } from "./ConnectedApps";
import { Habits } from "./Habits";
import { Intake } from "./Intake";
import { ClientNutrition } from "./Nutrition";

type View = "food" | "habits" | "community" | "apps" | "intake";

export function More({ say }: { say: (m: string) => void }) {
  const [view, setView] = useState<View | null>(null);
  const { coachName } = useAppInfo();
  const life = useLifestyle();
  const today = localDate(new Date());
  const due = habitsOn(life.habits, today);
  const kcal = Math.round(dayTotals(life.food, today).kcal);
  const MENU: [View, string, string][] = [
    ["food", "Nutrition", life.targets ? `${kcal.toLocaleString()} of ${life.targets.kcal.toLocaleString()} kcal logged today` : kcal ? `${kcal.toLocaleString()} kcal logged today` : "Log what you eat"],
    ["habits", "Habits", due.length ? `${due.filter((h) => isDone(life.ticks, h.id, today)).length} of ${due.length} done today` : life.habits.length ? "Nothing due today" : `None yet. ${coachName} will add some`],
    ["intake", "About you", life.intake ? "Your answers for " + coachName + ". Update any time" : `Health check and goals for ${coachName}`],
    ["community", "Community", "Leaderboard and team feed"],
  ];
  if (view === "intake") return <Intake onExit={() => setView(null)} onDone={() => { setView(null); say(`Sent · ${coachName} can see your answers`); }} />;
  if (view) {
    return (
      <>
        <BackLink onClick={() => setView(null)}>More</BackLink>
        {view === "food" && <ClientNutrition />}
        {view === "habits" && <Habits />}
        {view === "community" && <><SampleNote /><Community /></>}
        {view === "apps" && <ConnectedApps say={say} />}
      </>
    );
  }
  return (
    <>
      <div><div className="eyebrow">More</div><h1 className="h1">Everything else</h1></div>
      <div className="card flat list">
        {MENU.map(([k, t, s]) => (
          <button key={k} className="li" onClick={() => setView(k)}><div className="grow"><div className="h3">{t}</div><div className="small">{s}</div></div><span className="tiny">›</span></button>
        ))}
        <button className="li" onClick={() => setView("apps")}><div className="grow"><div className="h3">Connected apps</div><div className="small">Strava, watch files, and what's coming next</div></div><span className="tiny">›</span></button>
        {[["Goals", "Trap bar 80 kg × 5 by 20 December"], ["Settings", "Units and notifications"]].map(([t, s]) => (
          <div key={t} className="li"><div className="grow"><div className="h3">{t}</div><div className="small">{s}</div></div></div>
        ))}
      </div>
    </>
  );
}

const POSTS = [
  { user: "Omar T.", text: "New squat PR today, 100 kg! Eight weeks of steady work.", likes: 24 },
  { user: "James K.", text: "Four strict pull-ups in a row. Six months ago I couldn't do one.", likes: 31 },
];

function Community() {
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const board = [...CLIENTS].sort((a, b) => b.adherence - a.adherence).slice(0, 4);
  return (
    <>
      <div><div className="eyebrow">Community</div><h1 className="h1">This week</h1></div>
      <div className="card flat list">
        {board.map((c, i) => {
          const [first, last = ""] = c.name.split(" ");
          return (
            <div key={c.id} className="li">
              <span className="num" style={{ width: 20, fontWeight: 800, color: i === 0 ? "var(--act)" : "var(--text3)" }}>{i + 1}</span>
              <Avatar initials={c.initials} size={32} />
              <div className="grow"><div className="h3">{first} {last[0]}.</div><div className="tiny"><Icons.flame width={12} height={12} style={{ verticalAlign: -2, color: "var(--act)" }} /> {c.streak} days</div></div>
              <span className="num" style={{ fontWeight: 700 }}>{c.adherence}%</span>
            </div>
          );
        })}
      </div>
      {POSTS.map((p, i) => (
        <div key={p.user} className="card">
          <div className="h3">{p.user}</div>
          <p className="small" style={{ margin: "6px 0 10px", color: "var(--text)" }}>{p.text}</p>
          <button className="chip" onClick={() => setLiked((s) => ({ ...s, [i]: !s[i] }))} style={liked[i] ? { borderColor: "var(--act)", color: "var(--act)" } : undefined} aria-pressed={!!liked[i]}><Icons.heart width={13} height={13} fill={liked[i] ? "currentColor" : "none"} /> {p.likes + (liked[i] ? 1 : 0)}</button>
        </div>
      ))}
    </>
  );
}
