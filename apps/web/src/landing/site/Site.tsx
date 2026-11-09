import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icons, ThemeButton, type IconName } from "@apex/ui";
import { AUDIENCES, FEATURE_GROUPS, NAV, type Shot } from "./content";

/* Shared frame for every marketing page: offer bar, header with mega menu, mobile drawer, footer,
   and the scroll reveal. Pages pass their own <main> content as children. */

type MenuId = "product" | "audiences" | "resources";

const LINKS: { id?: MenuId; name: string; href: string }[] = [
  { id: "product", name: "Product", href: "/features/" },
  { id: "audiences", name: "Who it's for", href: "/solutions/" },
  { name: "In action", href: "/in-action/" },
  { id: "resources", name: "Resources", href: "/resources/" },
  { name: "Pricing", href: "/pricing/" },
  { name: "About", href: "/about/" },
];

const GROUP_ICON: Record<string, IconName> = {
  training: "build", nutrition: "food", habits: "check", community: "clients", business: "money", insight: "brief",
};

function Menu({ id }: { id: MenuId }) {
  if (id === "product") {
    return (
      <div className="st-mega st-mega-wide">
        <div className="st-mega-grid">
          {FEATURE_GROUPS.map((g) => {
            const I = Icons[GROUP_ICON[g.id] ?? "spark"];
            return (
              <a key={g.id} href={`/features/#${g.id}`} className="st-mega-item">
                <span className="st-mi"><I width={18} height={18} /></span>
                <span><b>{g.name}</b><small>{g.items.slice(0, 3).map((i) => i.name).join(" · ")}</small></span>
              </a>
            );
          })}
        </div>
        <aside className="st-mega-side">
          <span className="st-eyebrow">Client app</span>
          <p>An app your clients open every day, with no download.</p>
          <a href="/client/?demo" className="st-arrow">Open the client demo</a>
          <a href="/features/" className="st-arrow">All features</a>
        </aside>
      </div>
    );
  }
  if (id === "audiences") {
    return (
      <div className="st-mega">
        <div className="st-mega-list">
          {AUDIENCES.map((a) => (
            <a key={a.id} href={`/solutions/#${a.id}`} className="st-mega-row">
              <img src={a.photo} alt="" width={44} height={55} loading="lazy" />
              <span><b>{a.name}</b><small>{a.title}</small></span>
            </a>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="st-mega">
      <div className="st-mega-list">
        {NAV.resources.map((r) => (
          <a key={r.href} href={r.href} className="st-mega-row text">
            <span><b>{r.name}</b><small>{r.text}</small></span>
          </a>
        ))}
      </div>
    </div>
  );
}

function Header({ path }: { path: string }) {
  const [open, setOpen] = useState<MenuId | null>(null);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(null); setDrawer(false); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawer]);
  return (
    <header className="lp-top st-top" onMouseLeave={() => setOpen(null)}>
      <div className="lp-wrap lp-bar">
        <a href="/" className="lp-logo" aria-label="APEX home">
          <Icons.logo width={24} height={24} />
          <b>APEX</b>
        </a>
        <nav className="st-nav" aria-label="Main">
          {LINKS.map((l) => (
            <div key={l.name} className={`st-nav-item ${open && open === l.id ? "open" : ""}`} onMouseEnter={() => setOpen(l.id ?? null)}>
              {l.id ? (
                <button type="button" className={path.startsWith(l.href) ? "on" : ""} aria-expanded={open === l.id}
                  onClick={() => setOpen((o) => (o === l.id ? null : (l.id ?? null)))}>
                  {l.name}<Icons.next width={14} height={14} className="st-caret" />
                </button>
              ) : (
                <a href={l.href} className={path.startsWith(l.href) ? "on" : ""}>{l.name}</a>
              )}
              {l.id && open === l.id && <Menu id={l.id} />}
            </div>
          ))}
        </nav>
        <div className="lp-bar-acts">
          <a className="lp-pill ghost st-hide-sm" href="/start/">Sign in</a>
          <a className="lp-pill act" href="/coach/">Start free</a>
          <button type="button" className="st-burger" aria-label="Menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
            <i /><i /><i />
          </button>
        </div>
      </div>
      {drawer && createPortal(
        <div className="st-drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="st-drawer-top">
            <a href="/" className="lp-logo" aria-label="APEX home"><Icons.logo width={22} height={22} /><b>APEX</b></a>
            <button type="button" className="st-x" aria-label="Close menu" onClick={() => setDrawer(false)}><Icons.close width={20} height={20} /></button>
          </div>
          <div className="st-drawer-body">
            <details open>
              <summary>Product</summary>
              {NAV.product.map((p) => <a key={p.href} href={p.href} onClick={() => setDrawer(false)}>{p.name}</a>)}
              <a href="/features/" onClick={() => setDrawer(false)}>All features</a>
            </details>
            <details>
              <summary>Who it's for</summary>
              {NAV.audiences.map((p) => <a key={p.href} href={p.href} onClick={() => setDrawer(false)}>{p.name}</a>)}
            </details>
            <details>
              <summary>Resources</summary>
              {NAV.resources.map((p) => <a key={p.href} href={p.href} onClick={() => setDrawer(false)}>{p.name}</a>)}
            </details>
            <a className="st-drawer-link" href="/in-action/">In action</a>
            <a className="st-drawer-link" href="/pricing/">Pricing</a>
            <a className="st-drawer-link" href="/about/">About</a>
          </div>
          <div className="st-drawer-foot">
            <a className="lp-pill ghost lg" href="/start/">Sign in</a>
            <a className="lp-pill act lg" href="/coach/">Start free</a>
          </div>
        </div>,
        document.querySelector(".site") ?? document.body,
      )}
    </header>
  );
}

function Footer({ cta }: { cta: boolean }) {
  return (
    <footer className="st-foot">
      <div className="lp-wrap">
        {cta && <div className="st-foot-cta">
          <h2 className="lp-h2">Ready when your next client is.</h2>
          <div className="lp-ctas">
            <a className="lp-pill act lg" href="/coach/">Start free</a>
            <a className="lp-pill ghost lg" href="/coach/?demo">Try the coach demo</a>
          </div>
        </div>}
        <div className="st-foot-grid">
          <div className="st-foot-brand">
            <a href="/" className="lp-logo" aria-label="APEX home"><Icons.logo width={22} height={22} /><b>APEX</b></a>
            <p>Coaching software for personal trainers. Built by a coach at HELIX.</p>
            <ThemeButton />
          </div>
          <nav aria-label="Product">
            <h3>Product</h3>
            {NAV.product.map((p) => <a key={p.href} href={p.href}>{p.name}</a>)}
            <a href="/in-action/">See it in action</a>
            <a href="/pricing/">Pricing</a>
          </nav>
          <nav aria-label="Who it's for">
            <h3>Who it's for</h3>
            {NAV.audiences.map((p) => <a key={p.href} href={p.href}>{p.name}</a>)}
          </nav>
          <nav aria-label="Resources">
            <h3>Resources</h3>
            {NAV.resources.map((p) => <a key={p.href} href={p.href}>{p.name}</a>)}
            <a href="/coach/?demo">Coach demo</a>
            <a href="/client/?demo">Client demo</a>
          </nav>
          <nav aria-label="Company">
            <h3>Company</h3>
            <a href="/about/">About APEX</a>
            <a href="/about/#principles">Our principles</a>
            <a href="/start/">Sign in</a>
            <a href="/legal/#privacy">Privacy</a>
            <a href="/legal/#terms">Terms</a>
          </nav>
        </div>
        <div className="st-foot-base">
          <span>© {new Date().getFullYear()} APEX Coaching OS</span>
          <span>Made in the UK · Prices in GBP</span>
        </div>
      </div>
    </footer>
  );
}

/** Adds `.in` to every `.rv` element as it scrolls into view. Without IntersectionObserver everything shows at once. */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".rv"));
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

export function SiteShell({ path, children, cta = true }: { path: string; children: ReactNode; cta?: boolean }) {
  const [offer, setOffer] = useState(true);
  useReveal();
  useEffect(() => {
    // Hash links into a freshly loaded page: wait for layout, then jump.
    if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
  }, []);
  return (
    <div className="lp site">
      {offer && (
        <div className="lp-offer" role="region" aria-label="Offer">
          <p><b>Founding coaches</b> start free, every feature included. <a href="/coach/">Claim your spot</a></p>
          <button className="lp-offer-x" onClick={() => setOffer(false)} aria-label="Close offer">×</button>
        </div>
      )}
      <Header path={path} />
      <main>{children}</main>
      <Footer cta={cta} />
    </div>
  );
}

/* ---------- small building blocks ---------- */

export function Frame({ shot, className = "", eager }: { shot: Shot; className?: string; eager?: boolean }) {
  if (shot.kind === "phone") {
    return (
      <figure className={`st-phone ${className}`}>
        <img src={shot.src} alt={shot.alt} width={585} height={1266} loading={eager ? "eager" : "lazy"} />
      </figure>
    );
  }
  return (
    <figure className={`st-desk ${className}`}>
      <span className="st-desk-bar" aria-hidden="true"><i /><i /><i /></span>
      <img src={shot.src} alt={shot.alt} width={1400} height={902} loading={eager ? "eager" : "lazy"} />
    </figure>
  );
}

export function SecHead({ kick, title, lead, center }: { kick: string; title: string; lead?: string; center?: boolean }) {
  return (
    <div className={`st-head rv ${center ? "center" : ""}`}>
      <span className="lp-kick">{kick}</span>
      <h2 className="lp-h2">{title}</h2>
      {lead && <p className="lp-lead">{lead}</p>}
    </div>
  );
}

export function PageHero({ kick, title, lead, children }: { kick: string; title: string; lead: string; children?: ReactNode }) {
  return (
    <section className="st-phero">
      <div className="lp-wrap st-phero-in">
        <span className="lp-kick">{kick}</span>
        <h1 className="lp-h1">{title}</h1>
        <p className="lp-lead">{lead}</p>
        {children}
      </div>
    </section>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="lp-faq">
      {items.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}
