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
 * Client welcome: full-bleed HELIX studio photo (burgundy low-key look), APEX mark,
 * a light + bold headline and one clear action. Shown before sign-in, and once per visit in the demo.
 */
export function Welcome({ onContinue, demo }: { onContinue: () => void; demo: boolean }) {
  const go = () => { markSeen(); onContinue(); };
  return (
    <div className="wel">
      <picture className="wel-photo" aria-hidden="true">
        <img src="/welcome/studio.webp" srcSet="/welcome/studio-720.webp 720w, /welcome/studio.webp 1080w" sizes="(max-width:720px) 100vw, 1080px" width={1080} height={1910} alt="" fetchPriority="high" />
      </picture>
      <div className="wel-top">
        <span className="wel-logo"><Icons.logo width={26} height={26} /><b>APEX</b></span>
      </div>
      <div className="wel-copy">
        <p className="wel-kick">Coached by HELIX</p>
        <h1 className="wel-h">Train <b>smarter.</b><br />Get <b>stronger.</b></h1>
        <p className="wel-sub">Your plan, today's workout and your coach, together in one calm place.</p>
      </div>
      <div className="wel-actions">
        <button className="wel-btn" onClick={go}>{demo ? "Open my training" : "Get started"}</button>
        {!demo && <button className="wel-alt" onClick={go}>I already have an account</button>}
      </div>
    </div>
  );
}
