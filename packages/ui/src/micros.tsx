import { MICRO_REFERENCE, microStatus, type MicroTotals } from "@apex/core";

/* Fibre, sugar and salt for a day, against UK reference amounts. Shown only when some foods carry them. */
const TONE = { good: "var(--good)", low: "var(--warn)", high: "var(--crit)" } as const;

export function MicroStrip({ totals, caption }: { totals: MicroTotals; caption?: string }) {
  if (!totals.withData) return null;
  const cells = [
    { key: "fibreG" as const, label: "Fibre", value: totals.fibreG, ref: `goal ${MICRO_REFERENCE.fibreG} g` },
    { key: "sugarG" as const, label: "Sugar", value: totals.sugarG, ref: `under ${MICRO_REFERENCE.sugarG} g` },
    { key: "saltG" as const, label: "Salt", value: totals.saltG, ref: `under ${MICRO_REFERENCE.saltG} g` },
  ];
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="kpis">
        {cells.map((c) => (
          <div key={c.key} className="kpi">
            <b className="num" style={{ color: TONE[microStatus(c.key, c.value)] }}>{c.value} g</b>
            <small>{c.label} · {c.ref}</small>
          </div>
        ))}
      </div>
      <div className="tiny">{caption ?? `From ${totals.withData} of ${totals.items} foods that list them. Scanned packs fill these in.`}</div>
    </div>
  );
}
