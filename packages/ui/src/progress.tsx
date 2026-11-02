import type { ReactNode } from "react";
import { Icons } from "./icons";

/** 1–5 answer with the meaning of each end underneath. Tap the chosen one again to clear it. */
export function RatingPicker({ label, value, onChange, low, high }: { label: string; value: number | null; onChange: (v: number | null) => void; low: string; high: string }) {
  return (
    <div role="group" aria-label={label}>
      <div className="h3" style={{ marginBottom: 6 }}>{label}</div>
      <div className="rpe">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={value === n ? "on" : ""} aria-pressed={value === n} onClick={() => onChange(value === n ? null : n)}>{n}</button>
        ))}
      </div>
      <div className="row tiny" style={{ justifyContent: "space-between", marginTop: 4 }}><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

/** A 3:4 progress photo, or an empty frame with a figure when there is none. */
export function PhotoFrame({ url, label, highlight, children }: { url: string | null | undefined; label: string; highlight?: boolean; children?: ReactNode }) {
  return (
    <figure style={{ margin: 0, textAlign: "center" }}>
      <div className="video photo" style={{ borderColor: highlight ? "var(--good)" : undefined }}>
        {url ? <img src={url} alt={label} loading="lazy" /> : <Icons.figure width={48} height={48} />}
        {children}
      </div>
      <figcaption className="tiny" style={{ marginTop: 4 }}>{label}</figcaption>
    </figure>
  );
}
