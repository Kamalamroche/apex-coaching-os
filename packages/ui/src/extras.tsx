import type { ReactNode } from "react";
import "./extras.css";

const dayOf = (iso: string) => new Date(iso);

/** One group class: date block, time and place, and a strip with a mark for each place (filled = booked). */
export function ClassCard({ title, startsAt, minutes, place, capacity, booked, waiting, cancelled, line, i = 0, children }: {
  title: string; startsAt: string; minutes: number; place: string; capacity: number; booked: number; waiting: number; cancelled: boolean; line: string; i?: number; children?: ReactNode;
}) {
  const d = dayOf(startsAt);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const marks = Math.min(capacity, 24);
  const filled = Math.round((Math.min(booked, capacity) / capacity) * marks);
  const full = booked >= capacity;
  return (
    <div className={`xc-card ${cancelled ? "off" : ""}`} style={{ ["--i" as string]: i }}>
      <div className="xc-date" aria-hidden><small>{d.toLocaleDateString("en-GB", { weekday: "short" })}</small><b>{d.getDate()}</b><small>{d.toLocaleDateString("en-GB", { month: "short" })}</small></div>
      <div className="xc-body">
        <div className="xc-title">{title}</div>
        <div className="xc-meta num">{time} · {minutes} min{place ? ` · ${place}` : ""}</div>
        {!cancelled && (
          <div className="xc-fill" role="img" aria-label={`${booked} of ${capacity} places booked${waiting ? `, ${waiting} waiting` : ""}`}>
            {Array.from({ length: marks }, (_, k) => <i key={k} className={k < filled ? (full ? "wait" : "on") : ""} />)}
          </div>
        )}
        <div className="xc-foot">
          <span className={`xc-spots ${full && !cancelled ? "full" : ""}`}>{line}</span>
          {children}
        </div>
      </div>
    </div>
  );
}

/** An agreement laid out like a document, with the typed signature underneath. */
export function AgreementPaper({ title, body, version, signature, children }: { title: string; body: string; version: number; signature?: ReactNode; children?: ReactNode }) {
  return (
    <div className="xa-paper">
      <h3>{title}</h3>
      <div className="ver">Version {version}</div>
      <div className="xa-text" tabIndex={0}>{body.split(/\n{2,}/).map((p, k) => <p key={k}>{p}</p>)}</div>
      {(signature !== undefined || children) && (
        <div className="xa-sign">
          {signature !== undefined && <div className="xa-sigline" aria-label="Signature">{signature}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

/** One of the coach's own written answers, shown to a client who asked something close to it. */
export function AnswerHit({ question, answer, i = 0 }: { question: string; answer: string; i?: number }) {
  return <div className="xq-hit" style={{ ["--i" as string]: i }}><b>{question}</b><p>{answer}</p></div>;
}

/** A message in the gym's team inbox. */
export function TeamBubble({ who, body, at, mine, tools }: { who: string; body: string; at: string; mine: boolean; tools?: ReactNode }) {
  return (
    <div className={`xt-msg ${mine ? "mine" : ""}`}>
      {!mine && <div className="who">{who}</div>}
      <p>{body}</p>
      <div className="at">{new Date(at).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}{tools}</div>
    </div>
  );
}
