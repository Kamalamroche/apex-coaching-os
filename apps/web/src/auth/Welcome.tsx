import { Icons } from "@apex/ui";

const SEEN_KEY = "apex.client.welcome";

/** True once the client has passed the welcome screen in this browser tab. Storage can be blocked
 *  (private mode, in-app browsers), so failures simply show the screen again. */
export function welcomeSeen(): boolean {
  try { return sessionStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
}

function markSeen() {
  try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* storage blocked: nothing to remember */ }
}

/**
 * Client welcome: full-bleed HELIX Pilates studio photo (burgundy low-key look), APEX mark,
 * a big light headline with heavy key words, a glass pill and one clear action. Shown before sign-in, and once per visit in the demo.
 */
export function Welcome({ onContinue, demo }: { onContinue: () => void; demo: boolean }) {
  const go = () => { markSeen(); onContinue(); };
  return (
    <div className="wel">
      <picture className="wel-photo" aria-hidden="true">
        <img src="/welcome/pilates.webp" srcSet="/welcome/pilates-720.webp 720w, /welcome/pilates.webp 1080w" sizes="(max-width:720px) 100vw, 1080px" width={1080} height={1910} alt="" fetchPriority="high" />
      </picture>
      <div className="wel-top">
        <span className="wel-logo"><Icons.logo width={22} height={22} /><b>APEX</b></span>
      </div>
      <div className="wel-copy">
        <h1 className="wel-h">Train with <b>Purpose.</b> Move with <b>Grace.</b></h1>
        <p className="wel-sub">Coach-built plans, guided Pilates and strength sessions, check-ins and real progress, all in one calm place.</p>
        <a className="wel-pill" href="/#how">Watch how it works <Icons.play width={12} height={12} /></a>
      </div>
      <div className="wel-actions">
        <button className="wel-btn" onClick={go}>{demo ? "Open my training" : "Get started"}</button>
        {!demo && <button className="wel-alt" onClick={go}>I already have an account</button>}
      </div>
    </div>
  );
}
