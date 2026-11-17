import { TABLE_PARTS, defaultDir, lastSessionLabel, pounds, sortClientTable, tableSummary, type ClientTableRow, type SortDir, type TableSortKey } from "@apex/core";
import type { ReactNode } from "react";
import { HealthBadge, HealthTrend } from "./business";
import { Avatar } from "./primitives";
import "./clientTable.css";

const TONE = (v: number) => (v >= 75 ? "var(--good)" : v >= 50 ? "var(--warn)" : "var(--crit)");
const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/** One part of the health score as a short bar and number. A dash when the part isn't scored for this client. */
function PartCell({ v }: { v: number | null }) {
  if (v === null) return <td className="ct-part ct-blank" aria-label="Not scored">–</td>;
  return (
    <td className="ct-part">
      <span className="ct-bar" aria-hidden><i style={{ width: `${v}%`, background: TONE(v) }} /></span>
      <span className="num">{v}</span>
    </td>
  );
}

export interface ClientTableProps {
  rows: ClientTableRow[];
  sort: TableSortKey;
  dir: SortDir;
  onSort: (key: TableSortKey, dir: SortDir) => void;
  onOpen: (id: string) => void;
  /** Extra line under the name, such as the coach's tags. */
  below?: (row: ClientTableRow) => ReactNode;
  /** Show the fee column (hidden when no client has a fee yet). */
  fees?: boolean;
}

/** The trainer's desktop client table: health, each part of it, last session and fee, sortable by any column.
    Click a row to open the client. Rule-based figures (Insight), only the coach sees them. */
export function ClientTable({ rows, sort, dir, onSort, onOpen, below, fees = true }: ClientTableProps) {
  const sorted = sortClientTable(rows, sort, dir);
  const sum = tableSummary(rows);
  const Head = ({ k, children, left }: { k: TableSortKey; children: ReactNode; left?: boolean }) => {
    const on = sort === k;
    return (
      <th scope="col" className={left ? "l" : undefined} aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}>
        <button className={`ct-sort ${on ? "on" : ""}`} onClick={() => onSort(k, on ? (dir === "asc" ? "desc" : "asc") : defaultDir(k))}>
          {children}<span className="ct-arrow" aria-hidden>{on ? (dir === "asc" ? "↑" : "↓") : ""}</span>
        </button>
      </th>
    );
  };
  return (
    <div className="ct-wrap">
      <table className="ct">
        <thead>
          <tr>
            <Head k="name" left>Client</Head>
            <Head k="score">Health</Head>
            {TABLE_PARTS.map((p) => <Head key={p.key} k={p.key}>{p.label}</Head>)}
            <Head k="last">Last session</Head>
            {fees && <Head k="fee">Fee / month</Head>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.id} onClick={() => onOpen(r.id)} style={{ ["--i" as string]: Math.min(i, 8) }}>
              <th scope="row" className="l">
                <button className="ct-name" onClick={(e) => { e.stopPropagation(); onOpen(r.id); }}>
                  <Avatar initials={initials(r.name)} size={32} tone={r.band === "low" ? "var(--crit)" : r.band === "watch" ? "var(--warn)" : undefined} />
                  <span className="ct-who"><b>{r.name}</b><small>{[r.mode, r.plan].filter(Boolean).join(" · ")}</small>{r.band !== "good" && r.why && <em className={`ct-why b-${r.band}`}>{r.why}</em>}{below?.(r)}</span>
                </button>
              </th>
              <td><span className="ct-health"><HealthBadge score={r.score} band={r.band} size={34} /><HealthTrend trend={r.trend} /></span></td>
              {TABLE_PARTS.map((p) => <PartCell key={p.key} v={r.parts[p.key]} />)}
              <td className={`ct-last ${r.daysSinceSession !== null && r.daysSinceSession > 7 ? "late" : ""}`}>{lastSessionLabel(r.daysSinceSession)}</td>
              {fees && <td className="num">{r.feePence ? pounds(r.feePence) : "–"}</td>}
            </tr>
          ))}
          {sorted.length === 0 && <tr><td className="l" colSpan={8 + (fees ? 1 : 0)}>No clients match.</td></tr>}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <th scope="row" className="l">{rows.length} {rows.length === 1 ? "client" : "clients"}</th>
              <td className="num">{sum.average === null ? "–" : `avg ${sum.average}`}</td>
              <td colSpan={TABLE_PARTS.length + 1} className="l ct-foot-note">{sum.needYou ? `${sum.needYou} need you` : "No one below 50"}</td>
              {fees && <td className="num">{sum.feesPence ? pounds(sum.feesPence) : "–"}</td>}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
