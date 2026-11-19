import { CLIENTS, endingSoon, type Runway } from "@apex/core";
import { Icons, Label } from "@apex/ui";
import { useEffect, useState } from "react";
import { latestPrograms } from "../../data/supabaseStore";
import type { CoachLiveProps } from "../CoachApp";

type Row = { id: string; name: string; programme: string; runway: Runway };

/* Sample rows for the demo, so the card shows what it does. */
const SAMPLE: Row[] = [
  { id: String(CLIENTS[3]?.id ?? 4), name: CLIENTS[3]?.name ?? "Omar Tahir", programme: CLIENTS[3]?.plan ?? "Powerlifting", runway: { daysLeft: 3, status: "ending", label: "Ends in 3 days" } },
  { id: String(CLIENTS[1]?.id ?? 2), name: CLIENTS[1]?.name ?? "James Kowalski", programme: CLIENTS[1]?.plan ?? "Strength Block", runway: { daysLeft: 6, status: "ending", label: "Ends in 6 days" } },
];

/** Never run out: programmes ending within a week, with a one-tap way to plan the next block. Hidden when nobody is ending. */
export function EndingCard({ live, planBlock, openClient }: { live?: CoachLiveProps; planBlock?: (clientId: string) => void; openClient: (id: number, tab?: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(live ? null : SAMPLE);
  const ids = (live?.clients ?? []).map((c) => c.id).join(",");
  useEffect(() => {
    if (!live) return;
    let on = true;
    latestPrograms(live.db, ids ? ids.split(",") : []).then((progs) => {
      if (!on) return;
      const list = (live.clients ?? []).flatMap((c) => (progs[c.id] ? [{ id: c.id, name: c.name, programme: progs[c.id]!.name, createdAt: progs[c.id]!.createdAt, weeks: progs[c.id]!.weeks }] : []));
      setRows(endingSoon(list).map((r) => ({ id: r.id, name: r.name, programme: r.programme, runway: r.runway })));
    }, () => { if (on) setRows([]); });
    return () => { on = false; };
  }, [live?.db, ids]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows?.length) return null;
  return (
    <section className="card flat end-card">
      <div className="sect" style={{ padding: "12px 14px 0" }}><h2 className="h3">Programmes ending</h2>{live ? <Label kind="data">Data</Label> : <span className="tiny">Sample data</span>}</div>
      <div className="list">
        {rows.slice(0, 5).map((r) => (
          <div key={r.id} className="li">
            <Icons.calendar width={18} height={18} style={{ color: r.runway.status === "ended" ? "var(--crit)" : "var(--warn)" }} aria-hidden="true" />
            <div className="grow"><div className="h3">{r.name}</div><div className="tiny">{r.programme} · {r.runway.label}</div></div>
            {live && planBlock ? <button className="btn act sm" onClick={() => planBlock(r.id)}>Plan next block</button> : <button className="btn ghost sm" onClick={() => openClient(Number(r.id), "Programme")}>Open client</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
