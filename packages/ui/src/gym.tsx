import { HERO_IMAGES, ROLE_LABEL, ROLE_RIGHTS, lastSeenText, type GymClient, type GymRole, type TrainerLine } from "@apex/core";
import type { ReactNode } from "react";
import { Icons, type IconName } from "./icons";
import { CountUp } from "./motion";
import { EditorialTitle, HeroBackdrop } from "./primitives";
import { teamInitials } from "./team";

/* Gym: the same poster language as Team and Train with me. The gym's name in Roman capitals on the coach studio photo,
   trainers as a ranked roster with a quiet bar of their week, clients as cards that say who coaches them. */

const GYM_ART = { ...HERO_IMAGES.coach, word: "Gym" };

export function GymHero({ name, role, pills, children }: { name: string; role: GymRole | null; pills: { icon: IconName; text: string }[]; children?: ReactNode }) {
  return (
    <div className="hero gy-hero">
      <HeroBackdrop art={GYM_ART} word={null} />
      <div className="hero-top"><span className="gpill dim caps">{role ? ROLE_LABEL[role] : "Gym"}</span></div>
      <div className="hero-body">
        <EditorialTitle as="h1" text={name} caption={role ? "Your gym · your trainers" : "Trainers under one roof"} />
        {pills.length > 0 && (
          <div className="gpills">
            {pills.map((p, i) => { const I = Icons[p.icon]; return <span key={p.text} className="gpill num" style={{ ["--i" as string]: i }}><I /> {p.text}</span>; })}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function RoleBadge({ role }: { role: GymRole }) {
  return <span className={`gy-role r-${role}`}>{ROLE_LABEL[role]}</span>;
}

/** The roster: one row per trainer, with their clients and a bar of this week's sessions against the busiest trainer. */
export function TrainerRoster({ lines, onOpen }: { lines: TrainerLine[]; onOpen?: (id: string) => void }) {
  const top = Math.max(1, ...lines.map((l) => l.sessions7));
  return (
    <ol className="gy-roster">
      {lines.map((l, i) => {
        const m = l.member;
        const body = (
          <>
            <span className={`tm-av${m.isMe ? " me" : ""}`} aria-hidden="true">{teamInitials(m.name)}</span>
            <span className="grow">
              <span className="gy-name"><b>{m.name}{m.isMe ? " (you)" : ""}</b><RoleBadge role={m.role} /></span>
              <small>{l.clients} {l.clients === 1 ? "client" : "clients"} · {l.sessions7} sessions this week{l.quiet ? ` · ${l.quiet} quiet` : ""}</small>
              <span className="gy-bar" aria-hidden="true"><i style={{ width: `${(l.sessions7 / top) * 100}%`, ["--i" as string]: i }} /></span>
            </span>
            {onOpen && <span className="gy-chev" aria-hidden="true">›</span>}
          </>
        );
        return (
          <li key={m.id} style={{ ["--i" as string]: Math.min(i, 8) }}>
            {onOpen ? <button className="gy-row" onClick={() => onOpen(m.id)}>{body}</button> : <div className="gy-row">{body}</div>}
          </li>
        );
      })}
    </ol>
  );
}

/** One client card: who coaches them, how their week is going, who else follows them. */
export function GymClientItem({ c, i = 0, myId, onOpen, now }: { c: GymClient; i?: number; myId: string; onOpen?: () => void; now?: Date }) {
  const quiet = c.sessions7 === 0;
  const sharedToMe = c.trainerId !== myId && c.sharedWith.some((s) => s.id === myId);
  const body = (
    <>
      <header>
        <span className="tm-av" aria-hidden="true">{teamInitials(c.name)}</span>
        <span className="grow">
          <b>{c.name}</b>
          <small>{c.trainerId === myId ? "Your client" : `With ${c.trainerName}`} · {c.mode}</small>
        </span>
        <span className={`gy-state${quiet ? " quiet" : ""}`}>{quiet ? "Quiet" : `${c.sessions7} this week`}</span>
      </header>
      <dl className="gy-facts">
        <div><dt>Last session</dt><dd>{lastSeenText(c.lastSession, now)}</dd></div>
        <div><dt>28 days</dt><dd>{c.sessions28} sessions</dd></div>
        <div><dt>Programme</dt><dd>{c.programName ?? "None yet"}</dd></div>
      </dl>
      {(c.sharedWith.length > 0 || sharedToMe) && (
        <p className="gy-shared"><Icons.share width={13} height={13} /> {sharedToMe ? "Shared with you" : `Shared with ${c.sharedWith.map((s) => s.name.split(" ")[0]).join(", ")}`}</p>
      )}
    </>
  );
  return onOpen
    ? <button className="gy-client" style={{ ["--i" as string]: Math.min(i, 8) }} onClick={onOpen}>{body}</button>
    : <article className="gy-client" style={{ ["--i" as string]: Math.min(i, 8) }}>{body}</article>;
}

/** What each role can do. */
export function RoleGuide({ mine }: { mine: GymRole | null }) {
  const roles: GymRole[] = ["owner", "manager", "trainer"];
  return (
    <section className="gy-roles">
      <span className="gr-eyebrow">Roles</span>
      <ul>
        {roles.map((r, i) => (
          <li key={r} className={r === mine ? "on" : undefined} style={{ ["--i" as string]: i }}>
            <span className="gy-name"><b>{ROLE_LABEL[r]}</b>{r === mine && <small>You</small>}</span>
            {ROLE_RIGHTS[r].map((t) => <span key={t} className="gy-right"><Icons.check width={12} height={12} /> {t}</span>)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A big light number with a label, for the gym's week. */
export function GymStat({ value, label, i = 0 }: { value: number; label: string; i?: number }) {
  return (
    <div className="gy-stat" style={{ ["--i" as string]: i }}>
      <b><CountUp value={value} duration={900} /></b>
      <span>{label}</span>
    </div>
  );
}
