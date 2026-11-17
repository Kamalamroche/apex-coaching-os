import type { ReportClient, WeeklyReport } from "@apex/core";
import { Avatar, Label } from "./primitives";
import "./weeklyReport.css";

/* The coach's Monday report on the Brief: last week in one card. Data only, nothing changes from here. */

const pounds = (p: number) => `£${Math.round(p / 100).toLocaleString("en-GB")}`;
const initials = (n: string) => n.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();

export function WeeklyReportCard({ report, sample, onClient, onNudge }: { report: WeeklyReport; sample?: boolean; onClient?: (c: ReportClient) => void; onNudge?: (c: ReportClient) => void }) {
  const r = report;
  const tiles: [string, string, string?][] = [
    [String(r.sessions), r.sessions === 1 ? "session" : "sessions"],
    [`${r.trained}/${r.coached}`, "clients trained", r.coached ? `${r.onPlan} hit their plan` : undefined],
    [String(r.checkIns), r.checkIns === 1 ? "check-in" : "check-ins"],
    [String(r.newLeads), r.newLeads === 1 ? "new enquiry" : "new enquiries", r.newClients ? `${r.newClients} new client${r.newClients === 1 ? "" : "s"}` : undefined],
    [pounds(r.moneyInPence), "packs and sales"],
  ];
  return (
    <section className="wr-card" aria-label={`Last week, ${r.label}`}>
      <div className="sect"><h2 className="h2">Last week</h2><span className="row" style={{ gap: 6 }}><span className="tiny num">{r.label}</span><Label kind="data">Data</Label></span></div>
      <p className="wr-headline">{r.headline}</p>
      <div className="wr-tiles">
        {tiles.map(([v, l, n], i) => (
          <div key={l} className="wr-tile" style={{ ["--i" as string]: i }}>
            <b className="num">{v}</b><span>{l}</span>{n && <small>{n}</small>}
          </div>
        ))}
      </div>
      {r.top && (
        <button type="button" className="wr-row" onClick={() => onClient?.(r.top!.client)}>
          <Avatar initials={initials(r.top.client.name)} size={30} tone="var(--good)" />
          <span className="grow"><b>{r.top.client.name}</b><small>Most sessions: {r.top.sessions}. Worth a well done.</small></span>
        </button>
      )}
      {r.quiet.length > 0 && (
        <div className="wr-quiet">
          <div className="tiny">No session last week</div>
          {r.quiet.slice(0, 5).map((c) => (
            <div key={c.id} className="wr-row">
              <Avatar initials={initials(c.name)} size={30} tone="var(--warn)" />
              <button type="button" className="grow wr-name" onClick={() => onClient?.(c)}>{c.name}</button>
              {onNudge && <button type="button" className="btn ghost sm" onClick={() => onNudge(c)}>Nudge</button>}
            </div>
          ))}
          {r.quiet.length > 5 && <div className="tiny">and {r.quiet.length - 5} more</div>}
        </div>
      )}
      {sample && <div className="tiny">Sample figures. Your own fill in when you sign in.</div>}
    </section>
  );
}
