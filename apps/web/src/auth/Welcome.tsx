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
 * a light headline with heavy key words and one glass action. Shown before sign-in, and once per visit in the demo.
 */
export function Welcome({ onContinue, demo }: { onContinue: (mode: "signup" | "signin") => void; demo: boolean }) {
  const go = (mode: "signup" | "signin") => { markSeen(); onContinue(mode); };
  return (
    <div className="wel">
      <picture className="wel-photo" aria-hidden="true">
        <img src="/welcome/pilates.webp" srcSet="/welcome/pilates-720.webp 720w, /welcome/pilates.webp 1080w" sizes="(max-width:720px) 100vw, 1080px" width={1080} height={1910} alt="" {...{ fetchpriority: "high" }} />
      </picture>
      <div className="wel-top">
        <span className="wel-logo"><Icons.logo width={22} height={22} /><b>APEX</b></span>
      </div>
      <div className="wel-copy">
        <h1 className="wel-h"><span>Train with <b>Purpose.</b></span> <span className="wel-h2">Move with <b>Grace.</b></span></h1>
        <p className="wel-sub">Coach-built plans, guided sessions and real progress, all in one calm place.</p>
      </div>
      <div className="wel-actions">
        <button className="wel-btn" onClick={() => go("signup")}>{demo ? "Open my training" : "Get started"} <Icons.arrow width={14} height={14} /></button>
        {!demo && <button className="wel-alt" onClick={() => go("signin")}>I already have an account</button>}
      </div>
    </div>
  );
}
