import { Icons } from "./icons";
import "./services.css";

export interface ServiceView { id: string; name: string; line: string; description: string; kind: "call" | "session"; free: boolean }

/** The coach's services as a pick list: name, length and price, what it is. Used by clients and on the public page. */
export function ServiceMenu({ services, value, onChange, label = "Choose a service" }: { services: ServiceView[]; value: string | null; onChange: (id: string) => void; label?: string }) {
  return (
    <div className="sv-menu" role="radiogroup" aria-label={label}>
      {services.map((s, i) => (
        <button key={s.id} type="button" role="radio" aria-checked={value === s.id} className={`sv-item ${value === s.id ? "on" : ""}`} style={{ ["--i" as string]: i }} onClick={() => onChange(s.id)}>
          <span className="sv-ico" aria-hidden>{s.kind === "call" ? <Icons.video width={16} height={16} /> : <Icons.train width={16} height={16} />}</span>
          <span className="sv-body">
            <b>{s.name}</b>
            <span className={`sv-line num ${s.free ? "free" : ""}`}>{s.line}</span>
            {s.description && <span className="sv-desc">{s.description}</span>}
          </span>
          <span className="sv-tick" aria-hidden><Icons.check width={14} height={14} /></span>
        </button>
      ))}
    </div>
  );
}

/** The booking link the coach shares, with copy and open. */
export function BookingLinkCard({ link, onCopy, caption }: { link: string; onCopy: () => void; caption: string }) {
  return (
    <div className="sv-link">
      <div className="sv-link-head"><Icons.link width={16} height={16} /><b>Your booking link</b></div>
      <div className="sv-link-url num" title={link}>{link.replace(/^https?:\/\//, "")}</div>
      <span className="tiny">{caption}</span>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn act sm" onClick={onCopy}><Icons.copy width={14} height={14} /> Copy link</button>
        <a className="btn ghost sm" href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>Open <Icons.arrow width={14} height={14} /></a>
      </div>
    </div>
  );
}
