import { CLIENTS, FOODS, type Food } from "@apex/core";
import { Avatar, BackLink, Bar } from "@apex/ui";
import { useState } from "react";

type View = "food" | "habits" | "community";
const MENU: [View, string, string][] = [
  ["food", "Nutrition", "1,432 of 1,900 kcal logged today"],
  ["habits", "Habits", "2 of 3 done today"],
  ["community", "Community", "Leaderboard and team feed"],
];

export function More() {
  const [view, setView] = useState<View | null>(null);
  if (view) {
    return (
      <>
        <BackLink onClick={() => setView(null)}>More</BackLink>
        {view === "food" && <ClientNutrition />}
        {view === "habits" && <Habits />}
        {view === "community" && <Community />}
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
        {[["Goals", "Trap bar 80 kg × 5 by 20 December"], ["Settings", "Units, notifications, connected apps"]].map(([t, s]) => (
          <div key={t} className="li"><div className="grow"><div className="h3">{t}</div><div className="small">{s}</div></div></div>
        ))}
      </div>
    </>
  );
}

const TARGET = { kcal: 1900, protein: 120, carbs: 210, fat: 60 };

function ClientNutrition() {
  const [log, setLog] = useState<Food[]>(() => [4, 3, 0, 1].map((i) => FOODS[i]).filter((f): f is Food => !!f));
  const [q, setQ] = useState("");
  const tot = log.reduce((a, f) => ({ kcal: a.kcal + f.kcal, protein: a.protein + f.protein, carbs: a.carbs + f.carbs, fat: a.fat + f.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const hits = FOODS.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
  const macros = [["Protein", tot.protein, TARGET.protein, "var(--crit)"], ["Carbs", tot.carbs, TARGET.carbs, "var(--data)"], ["Fat", tot.fat, TARGET.fat, "var(--warn)"]] as const;
  return (
    <>
      <div><div className="eyebrow">Nutrition</div><h1 className="h1"><span className="num">{tot.kcal.toLocaleString()}</span> / {TARGET.kcal.toLocaleString()} kcal</h1></div>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {macros.map(([l, v, t, c]) => (
          <div key={l}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}><span className="small">{l}</span><span className="num small" style={{ fontWeight: 700, color: "var(--text)" }}>{v} / {t} g</span></div>
            <Bar pct={(v / t) * 100} color={c} />
          </div>
        ))}
      </div>
      <div className="card flat list">
        {log.map((f, i) => (
          <div key={f.id} className="li">
            <div className="grow"><div className="h3">{f.name}</div><div className="tiny num">P {f.protein} · C {f.carbs} · F {f.fat}</div></div>
            <span className="num small">{f.kcal}</span>
            <button className="iconbtn" aria-label={`Remove ${f.name}`} onClick={() => setLog((l) => l.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
      </div>
      <input id="foodsearch" className="field" placeholder="Search foods or scan a barcode" value={q} onChange={(e) => setQ(e.target.value)} />
      {q && (
        <div className="card flat list">
          {hits.length === 0 ? <div className="li small">No match in the sample list.</div> : hits.map((f) => {
            const added = log.some((l) => l.id === f.id);
            return (
              <div key={f.id} className="li">
                <div className="grow"><div className="h3">{f.name}</div><div className="tiny num">{f.kcal} kcal</div></div>
                <button className={`btn sm ${added ? "ghost" : "act"}`} disabled={added} onClick={() => setLog((l) => [...l, f])}>{added ? "Added" : "Add"}</button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

const HABITS = [["water", "Drink 2.5 L water"], ["steps", "8,000 steps"], ["sleep", "In bed by 10:30 pm"]] as const;

function Habits() {
  const [done, setDone] = useState<Record<string, boolean>>({ water: true, steps: true, sleep: false });
  return (
    <>
      <div><div className="eyebrow">Habits</div><h1 className="h1">{Object.values(done).filter(Boolean).length} of {HABITS.length} today</h1></div>
      <div className="card flat list">
        {HABITS.map(([k, t]) => (
          <label key={k} className="li" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={!!done[k]} onChange={(e) => setDone((s) => ({ ...s, [k]: e.target.checked }))} style={{ width: 22, height: 22, accentColor: "var(--good)" }} />
            <span className="h3">{t}</span>
          </label>
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
              <div className="grow"><div className="h3">{first} {last[0]}.</div><div className="tiny">🔥 {c.streak} days</div></div>
              <span className="num" style={{ fontWeight: 700 }}>{c.adherence}%</span>
            </div>
          );
        })}
      </div>
      {POSTS.map((p, i) => (
        <div key={p.user} className="card">
          <div className="h3">{p.user}</div>
          <p className="small" style={{ margin: "6px 0 10px", color: "var(--text)" }}>{p.text}</p>
          <button className="chip" onClick={() => setLiked((s) => ({ ...s, [i]: !s[i] }))} style={liked[i] ? { borderColor: "var(--act)", color: "var(--act)" } : undefined} aria-pressed={!!liked[i]}>♥ {p.likes + (liked[i] ? 1 : 0)}</button>
        </div>
      ))}
    </>
  );
}
