import { useId, type ReactNode } from "react";
import { Icons } from "./icons";
import { CountUp } from "./motion";

/* Reviews in the poster language: a big serif score, stars in the accent colour,
   and each review as a quiet serif quote. Used on the public page, the coach's review list and the client's card. */

const starLabel = (n: number) => `${n} out of 5 stars`;

/** Read-only stars. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="rv-stars" role="img" aria-label={starLabel(value)}>
      {[1, 2, 3, 4, 5].map((n) => <Icons.star key={n} width={size} height={size} className={n <= value ? "on" : ""} aria-hidden />)}
    </span>
  );
}

/** Tap 1 to 5. A radio group, so it works with a keyboard and a screen reader. */
export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const name = useId();
  return (
    <div className="rv-pick" role="radiogroup" aria-label="Stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={n <= value ? "on" : ""} style={{ ["--i" as string]: n }}>
          <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} aria-label={starLabel(n)} />
          <Icons.star width={30} height={30} aria-hidden />
        </label>
      ))}
    </div>
  );
}

/** "4.8 ★★★★★ from 12 clients". */
export function ReviewScore({ average, count }: { average: number; count: number }) {
  return (
    <div className="rv-score">
      <b className="num"><CountUp value={average} decimals={1} /></b>
      <div><Stars value={Math.round(average)} size={16} /><span className="tiny">from {count} client{count === 1 ? "" : "s"}</span></div>
    </div>
  );
}

/** One review as a quote. Children: the coach's buttons. */
export function ReviewQuote({ name, stars, body, at, i = 0, children }: { name: string | null; stars: number; body: string; at: string; i?: number; children?: ReactNode }) {
  return (
    <figure className="rv-quote" style={{ ["--i" as string]: i }}>
      <Stars value={stars} />
      <blockquote>{body}</blockquote>
      <figcaption>{name ?? "A client"} · {new Date(at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</figcaption>
      {children}
    </figure>
  );
}
