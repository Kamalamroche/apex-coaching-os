import { CLIENTS, dayTotals, goalProgress, habitsOn, isDone, localDate } from "@apex/core";
import { Avatar, BackLink, Icons, type IconName, ScriptTitle, useT, useUnits } from "@apex/ui";
import { useState } from "react";
import { SampleNote } from "../../app/AppContext";
import { useAppInfo } from "../../app/AppContext";
import { useLifestyle } from "../../data/LifestyleContext";
import { ConnectedApps } from "./ConnectedApps";
import { Habits } from "./Habits";
import { Intake } from "./Intake";
import { ClientNutrition } from "./Nutrition";
import { FormCheckList } from "./FormCheck";
import { AssessmentList } from "./Assessment";
import { useAssessments } from "../../data/AssessmentContext";
import { useFormChecks } from "../../data/FormCheckContext";
import { useGoals } from "../../data/GoalContext";
import { useGoalInputs } from "../../app/GoalParts";
import { Goals } from "./Goals";
import { Book } from "./Book";
import { Challenges } from "./Challenges";
import { Resources } from "./Resources";
import { Programmes } from "./Programmes";
import { useProgrammesApi } from "../../app/ProgrammeParts";
import { Team } from "./Team";
import { useTeamApi } from "../../data/team";
import { InviteFriend, useFriendInvite } from "../../app/GrowthParts";
import { useGrowApi } from "../../data/grow";
import { MyReview } from "../Review";
import { useResourceApi } from "../../data/resources";
import { useChallengeApi } from "../../data/challenges";
import { useBookingApi } from "../../data/bookings";
import { useBookings } from "../../app/BookingParts";
import { upcomingBookings, whenLabel } from "@apex/core";
import { AccountScreen } from "../../app/Privacy";
import { UnitsAndLanguage } from "../../app/Settings";
import { useExtras } from "../../data/extras";
import { Classes } from "./Classes";
import { MyAgreements } from "./Agreements";
import { useFeatures } from "../../data/features";
import type { ClientFeature } from "@apex/core";

/* Which coach switch each screen sits behind. Screens not listed always show. */
const FEATURE_OF: Partial<Record<View, ClientFeature>> = {
  food: "nutrition", habits: "habits", goals: "goals", form: "form", challenges: "challenges", team: "community", community: "community",
  programmes: "programmes", book: "book", classes: "classes", invite: "invite", review: "invite",
};

type View = "account" | "settings" | "programmes" | "resources" | "challenges" | "book" | "goals" | "food" | "habits" | "community" | "team" | "invite" | "apps" | "intake" | "form" | "assess" | "classes" | "agreements" | "review";

export type MoreView = View;

export function More({ say, start, goTrain }: { say: (m: string) => void; start?: View | null; goTrain?: () => void }) {
  const on = useFeatures();
  const shown = (k: View) => { const f = FEATURE_OF[k]; return !f || on(f); };
  const [view, setView] = useState<View | null>(start && shown(start) ? start : null);
  const t = useT();
  const teamApi = useTeamApi();
  const growApi = useGrowApi();
  const friend = useFriendInvite();
  const { coachName } = useAppInfo();
  const life = useLifestyle();
  const form = useFormChecks();
  const assess = useAssessments();
  const replied = form.checks.filter((c) => c.coachReply).length;
  const goals = useGoals();
  const inputs = useGoalInputs();
  const bookingApi = useBookingApi();
  const extras = useExtras();
  const challengeApi = useChallengeApi();
  const resourceApi = useResourceApi();
  const programmeApi = useProgrammesApi("client");
  const bookingData = useBookings(bookingApi);
  const nextBooking = bookingApi ? upcomingBookings(bookingData.bookings.filter((b) => b.clientId === bookingApi.me), new Date())[0] : undefined;
  const reached = goals.goals.filter((g) => goalProgress(g, inputs).achieved).length;
  const today = localDate(new Date());
  const due = habitsOn(life.habits, today);
  const kcal = Math.round(dayTotals(life.food, today).kcal);
  const MENU: [View, string, string][] = [
    ...(bookingApi ? [["book", `Book with ${coachName}`, nextBooking ? `Next: ${whenLabel(nextBooking.startsAt)}` : "A call or a training session"] as [View, string, string]] : []),
    ...(extras ? [["classes", "Group classes", `Book a place in ${coachName}'s classes`] as [View, string, string]] : []),
    ...(teamApi ? [["team", "Team", `${coachName}'s private team: high fives and the weekly effort board`] as [View, string, string]] : []),
    ...(friend ? [["invite", "Invite a friend", friend.summary.joined ? `${friend.summary.joined} joined ${coachName} through you` : `Bring a friend to train with ${coachName}`] as [View, string, string]] : []),
    ...(growApi ? [["review", `Review ${coachName}`, "A few words for their page, and Google if you like"] as [View, string, string]] : []),
    ...(challengeApi ? [["challenges", "Challenges", `Join ${coachName}'s challenges and climb the leaderboard`] as [View, string, string]] : []),
    ...(programmeApi ? [["programmes", "Programmes", `Ready-made plans from ${coachName}. Start any time`] as [View, string, string]] : []),
    ...(resourceApi ? [["resources", "Resources", `Guides, videos and links from ${coachName}`] as [View, string, string]] : []),
    ["goals", "Goals", goals.goals.length ? `${goals.goals.length - reached} on the go${reached ? ` · ${reached} reached` : ""} · badges` : "Set a goal and earn badges"],
    ["food", "Nutrition", life.targets ? `${kcal.toLocaleString()} of ${life.targets.kcal.toLocaleString()} kcal logged today` : kcal ? `${kcal.toLocaleString()} kcal logged today` : "Log what you eat"],
    ["habits", "Habits", due.length ? `${due.filter((h) => isDone(life.ticks, h.id, today)).length} of ${due.length} done today` : life.habits.length ? "Nothing due today" : `None yet. ${coachName} will add some`],
    ["intake", "About you", life.intake ? "Your answers for " + coachName + ". Update any time" : `Health check and goals for ${coachName}`],
    ["assess", "Assessments", assess.list.length ? `${assess.list.filter((a) => a.status === "requested").length ? "One to do · " : ""}${assess.list.length} so far` : `Posture and mobility checks from ${coachName}`],
    ["form", "Form checks", form.checks.length ? `${form.checks.length} video${form.checks.length === 1 ? "" : "s"}${replied ? ` · ${replied} with notes from ${coachName}` : ""}` : `Film a set and ${coachName} checks your technique`],
    ...(extras ? [["agreements", "Contracts and waivers", "What you've signed with " + coachName] as [View, string, string]] : []),
    ...(teamApi ? [] : [["community", "Community", "Leaderboard and team feed"] as [View, string, string]]),
  ];
  const ICON: Record<View, [IconName, string]> = {
    book: ["today", "c1"], programmes: ["train", "c2"], challenges: ["trophy", "c2"], resources: ["file", "c4"], goals: ["target", "c2"], food: ["food", "c3"],
    habits: ["check", "c3"], intake: ["note", "c1"], form: ["camera", "c4"], assess: ["mobility", "c3"], community: ["clients", "c1"], team: ["five", "c2"], invite: ["mail", "c1"], apps: ["link", "c3"], account: ["info", "c4"], settings: ["more", "c2"], classes: ["clients", "c3"], agreements: ["edit", "c4"], review: ["star", "c2"],
  };
  const chip = (k: View) => { const [n, c] = ICON[k]; const I = Icons[n]; return <span className={`mi ${c}`}><I /></span>; };
  if (view === "intake") return <Intake onExit={() => setView(null)} onDone={() => { setView(null); say(`Sent · ${coachName} can see your answers`); }} />;
  if (view) {
    return (
      <>
        <BackLink onClick={() => setView(null)}>{t("More")}</BackLink>
        {view === "book" && <Book say={say} />}
        {view === "classes" && <Classes say={say} />}
        {view === "agreements" && <MyAgreements say={say} />}
        {view === "team" && <Team say={say} />}
        {view === "invite" && <InviteFriend say={say} />}
        {view === "review" && <MyReview say={say} />}
        {view === "challenges" && <Challenges say={say} />}
        {view === "programmes" && <Programmes say={say} onTrain={goTrain} />}
        {view === "resources" && <Resources />}
        {view === "goals" && <Goals say={say} />}
        {view === "food" && <ClientNutrition />}
        {view === "habits" && <Habits />}
        {view === "form" && <FormCheckList say={say} />}
        {view === "assess" && <AssessmentList />}
        {view === "community" && <><SampleNote /><Community /></>}
        {view === "apps" && <ConnectedApps say={say} />}
        {view === "account" && <AccountScreen say={say} />}
        {view === "settings" && <UnitsAndLanguage />}
      </>
    );
  }
  // Grouped so each thing has one obvious home: what comes from the coach, the client's own daily tracking, training with others, and settings.
  const GROUPS: [string, View[]][] = [
    [`From ${coachName}`, ["book", "classes", "programmes", "resources", "assess", "form", "intake", "agreements"]],
    ["Your day", ["food", "habits", "goals"]],
    ["Together", ["team", "community", "challenges", "invite", "review"]],
  ];
  const SETTINGS: [View, string, string][] = [
    ["apps", "Connected apps", "Strava, watch files, and what's coming next"],
    ["account", "Privacy and account", "Privacy consents, download your data, delete your account"],
    ["settings", "Settings", "Units and language"],
  ];
  const row = ([k, title, s]: [View, string, string]) => (
    <button key={k} className="li" onClick={() => setView(k)}>{chip(k)}<div className="grow"><div className="h3">{t(title)}</div><div className="small">{t(s)}</div></div><Icons.forward width={18} height={18} style={{ color: "var(--text3)" }} /></button>
  );
  return (
    <>
      <div><p className="sub" style={{ margin: 0 }}>{t("More")}</p><ScriptTitle script={t("Everything")} className="sm">{t("else")}</ScriptTitle></div>
      {GROUPS.map(([label, keys]) => {
        const items = keys.filter(shown).map((k) => MENU.find((m) => m[0] === k)).filter((m): m is [View, string, string] => !!m);
        return items.length ? (
          <section key={label} className="stack" style={{ gap: 8 }}>
            <h2 className="eyebrow" style={{ margin: 0 }}>{t(label)}</h2>
            <div className="card flat list">{items.map(row)}</div>
          </section>
        ) : null;
      })}
      <section className="stack" style={{ gap: 8 }}>
        <h2 className="eyebrow" style={{ margin: 0 }}>{t("Settings")}</h2>
        <div className="card flat list">{SETTINGS.map(row)}</div>
      </section>
    </>
  );
}

const POSTS = [
  { user: "Omar T.", text: "New squat PR today, 100 kg! Eight weeks of steady work.", likes: 24 },
  { user: "James K.", text: "Four strict pull-ups in a row. Six months ago I couldn't do one.", likes: 31 },
];

function Community() {
  const u = useUnits();
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
          <p className="small" style={{ margin: "6px 0 10px", color: "var(--text)" }}>{u.kt(p.text)}</p>
          <button className="chip" onClick={() => setLiked((s) => ({ ...s, [i]: !s[i] }))} style={liked[i] ? { borderColor: "var(--act)", color: "var(--act)" } : undefined} aria-pressed={!!liked[i]}><Icons.heart width={13} height={13} fill={liked[i] ? "currentColor" : "none"} /> {p.likes + (liked[i] ? 1 : 0)}</button>
        </div>
      ))}
    </>
  );
}
