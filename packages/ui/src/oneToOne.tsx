import type { SessionNote } from "@apex/core";
import type { ReactNode } from "react";
import { Icons } from "./icons";
import "./oneToOne.css";

const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

/** "Only you" or "Shared with Priya", so the coach always knows who can read a note. */
export function NoteAudience({ shared, client }: { shared: boolean; client: string }) {
  return shared
    ? <span className="oo-who shared"><Icons.eye width={13} height={13} />Shared with {client}</span>
    : <span className="oo-who private"><Icons.eyeOff width={13} height={13} />Only you</span>;
}

/** Session notes on a line, newest first, grouped "This week", "Last week", then by month.
    A filled dot is a note the client can read too. */
export function NoteTimeline({ groups, client, actions, showAudience = true }: {
  groups: { label: string; notes: SessionNote[] }[];
  client: string;
  /** Buttons under each note (share, delete). */
  actions?: (n: SessionNote) => ReactNode;
  showAudience?: boolean;
}) {
  let i = 0;
  return (
    <div className="oo-tl">
      {groups.map((g) => (
        <section key={g.label} className="oo-tl-group" aria-label={g.label}>
          <div className="oo-tl-label">{g.label}</div>
          <div className="oo-tl-list">
            {g.notes.map((n) => (
              <article key={n.id} className={`oo-note ${n.shared ? "shared" : ""}`} style={{ ["--i" as string]: Math.min(i++, 8) }}>
                <div className="oo-note-meta">
                  <span className="num">{when(n.createdAt)}</span>
                  {showAudience && <NoteAudience shared={n.shared} client={client} />}
                </div>
                {n.session && <div style={{ marginBottom: 6 }}><span className="oo-note-session"><Icons.train width={12} height={12} />{n.session}</span></div>}
                <p>{n.body}</p>
                {actions && <div className="oo-note-foot">{actions(n)}</div>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Private or shared, as a two-way switch. */
export function ShareSwitch({ shared, onChange, client }: { shared: boolean; onChange: (shared: boolean) => void; client: string }) {
  return (
    <div className="oo-switch" role="radiogroup" aria-label="Who can read this note">
      <button role="radio" aria-checked={!shared} className={!shared ? "on" : ""} onClick={() => onChange(false)}><Icons.eyeOff width={14} height={14} />Only me</button>
      <button role="radio" aria-checked={shared} className={shared ? "on" : ""} onClick={() => onChange(true)}><Icons.eye width={14} height={14} />Share with {client}</button>
    </div>
  );
}

/** Sets, volume and time across the top of a session the coach is running, with a thin progress line. */
export function RunStats({ done, total, volume, minutes }: { done: number; total: number; volume: string; minutes: number }) {
  return (
    <div className="oo-stats">
      <div className="oo-stat"><b>{done}/{total}</b><small>Sets</small></div>
      <div className="oo-stat"><b>{volume}</b><small>Volume</small></div>
      <div className="oo-stat"><b>{minutes}</b><small>Min</small></div>
    </div>
  );
}

export function RunProgress({ pct }: { pct: number }) {
  return <div className="oo-progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>;
}
