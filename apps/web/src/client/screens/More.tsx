import { CLIENTS, dayTotals, goalProgress, habitsOn, isDone, localDate } from "@apex/core";
import { Avatar, BackLink, Icons, type IconName } from "@apex/ui";
import { useState } from "react";
import { SampleNote } from "../../app/AppContext";
import { useAppInfo } from "../../app/AppContext";
import { useLifestyle } from "../../data/LifestyleContext";
import { ConnectedApps } from "./ConnectedApps";
import { Habits } from "./Habits";
import { Intake } from "./Intake";
import { ClientNutrition } from "./Nutrition";
import { FormCheckList } from "./FormCheck";
import { useFormChecks } from "../../data/FormCheckContext";
import { useGoals } from "../../data/GoalContext";
import { useGoalInputs } from "../../app/GoalParts";
import { Goals } from "./Goals";
import { Book } from "./Book";
import { Challenges } from "./Challenges";
import { Resources } from "./Resources";
import { useResourceApi } from "../../data/resources";
import { useChallengeApi } from "../../data/challenges";
import { useBookingApi } from "../../data/bookings";
import { useBookings } from "../../app/BookingParts";
import { upcomingBookings, whenLabel } from "@apex/core";
import { AccountScreen } from "../../app/Privacy";

type View = "account" | "resources" | "challenges" | "book" | "goals" | "food" | "habits" | "community" | "apps" | "intake" | "form";

export function More({ say }: { say: (m: string) => void }) {
  const [view, setView] = useState<View | null>(null);
  const { coachName } = useAppInfo();
  const life = useLifestyle();
  const form = useFormChecks();
  const replied = form.checks.filter((c) => c.coachReply).length;
  const goals = useGoals();
  const inputs = useGoalInputs();
  const bookingApi = useBookingApi();
  const challengeApi = useChallengeApi();
  const resourceApi = useResourceApi();
  const bookingData = useBookings(bookingApi);
  const nextBooking = bookingApi ? upcomingBookings(bookingData.bookings.filter((b) => b.clientId === bookingApi.me), new Date())[0] : undefined;
  const reached = goals.goals.filter((g) => goalProgress(g, inputs).achieved).length;
  const today = localDate(new Date());
  const due = habitsOn(life.habits, today);
  const kcal = Math.round(dayTotals(life.food, today).kcal);
  const MENU: [View, string, string][] = [
    ...(bookingApi ? [["book", `Book with ${coachName}`, nextBooking ? `Next: ${whenLabel(nextBooking.startsAt)}` : "A call or a training session"] as [View, string, string]] : []),
    ...(challengeApi ? [["challenges", "Challenges", `Join ${coachName}'s challenges and climb the leaderboard`] as [View, string, string]] : []),
    ...(resourceApi ? [["resources", "Resources", `Guides, videos and links from ${coachName}`] as [View, string, string]] : []),
    ["goals", "Goals", goals.goals.length ? `${goals.goals.length - reached} on the go${reached ? ` · ${reached} reached` : ""} · badges` : "Set a goal and earn badges"],
    ["food", "Nutrition", life.targets ? `${kcal.toLocaleString()} of ${life.targets.kcal.toLocaleString()} kcal logged today` : kcal ? `${kcal.toLocaleString()} kcal logged today` : "Log what you eat"],
    ["habits", "Habits", due.length ? `${due.filter((h) => isDone(life.ticks, h.id, today)).length} of ${due.length} done today` : life.habits.length ? "Nothing due today" : `None yet. ${coachName} will add some`],
    ["intake", "About you", life.intake ? "Your answers for " + coachName + ". Update any time" : `Health check and goals for ${coachName}`],
    ["form", "Form checks", form.checks.length ? `${form.checks.length} video${form.checks.length === 1 ? "" : "s"}${replied ? ` · ${replied} with notes from ${coachName}` : ""}` : `Film a set and ${coachName} checks your technique`],
    ["community", "Community", "Leaderboard and team feed"],
  ];
  const ICON: Record<View, [IconName, string]> = {
    book: ["today", "c1"], challenges: ["trophy", "c2"], resources: ["file", "c4"], goals: ["target", "c2"], food: ["food", "c3"],
    habits: ["check", "c3"], intake: ["note", "c1"], form: ["camera", "c4"], community: ["clients", "c1"], apps: ["link", "c3"], account: ["info", "c4"],
  };
  const chip = (k: View) => { const [n, c] = ICON[k]; const I = Icons[n]; return <span className={`mi ${c}`}><I /></span>; };
  if (view === "intake") return <Intake onExit={() => setView(null)} onDone={() => { setView(null); say(`Sent · ${coachName} can see your answers`); }} />;
  if (view) {
    return (
      <>
        <BackLink onClick={() => setView(null)}>More</BackLink>
        {view === "book" && <Book say={say} />}
        {view === "challenges" && <Challenges say={say} />}
        {view === "resources" && <Resources />}
        {view === "goals" && <Goals say={say} />}
        {view === "food" && <ClientNutrition />}
        {view === "habits" && <Habits />}
        {view === "form" && <FormCheckList say={say} />}
        {view === "community" && <><SampleNote /><Community /></>}
        {view === "apps" && <ConnectedApps say={say} />}
        {view === "account" && <AccountScreen say={say} />}
      </>
    );
  }
  return (
    <>
      <div><p className="sub" style={{ margin: 0 }}>More</p><h1 className="h1">Everything else</h1></div>
      <div className="card flat list">
        {MENU.map(([k, t, s]) => (
          <button key={k} className="li" onClick={() => setView(k)}>{chip(k)}<div className="grow"><div className="h3">{t}</div><div className="small">{s}</div></div><Icons.forward width={18} height={18} style={{ color: "var(--text3)" }} /></button>
        ))}
        <button className="li" onClick={() => setView("apps")}>{chip("apps")}<div className="grow"><div className="h3">Connected apps</div><div className="small">Strava, watch files, and what's coming next</div></div><Icons.forward width={18} height={18} style={{ color: "var(--text3)" }} /></button>
        <button className="li" onClick={() => setView("account")}>{chip("account")}<div className="grow"><div className="h3">Privacy and account</div><div className="small">Your agreements, download your data, delete your account</div></div><Icons.forward width={18} height={18} style={{ color: "var(--text3)" }} /></button>
        {[["Settings", "Units and notifications"]].map(([t, s]) => (
          <div key={t} className="li"><span className="mi"><Icons.more /></span><div className="grow"><div className="h3">{t}</div><div className="small">{s}</div></div></div>
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
