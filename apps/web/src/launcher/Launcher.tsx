import { Icons, ThemeButton, useToast } from "@apex/ui";
import { createDemoStore } from "@apex/core";
import { supabase } from "../data/supabase";

/* /start/: pick coach or client. Poster header (giant word behind a cut-out athlete), then two equal choices
   whose buttons sit on the same line. */
export function Launcher() {
  const [toast, say] = useToast();
  const live = !!supabase;
  return (
    <div className="st">
      <a href="/" className="st-logo" aria-label="APEX home"><Icons.logo width={24} height={24} /><b>APEX</b></a>
      <div className="st-stage">
        <span className="st-giant" aria-hidden="true">APEX</span>
        <img src="/hero/coach-cut.webp" width={1080} height={1350} alt="A HELIX coach talking a client through her plan" />
      </div>
      <h1 className="st-h">Simple for the client.<span>Powerful for the coach.</span></h1>
      <p className="st-sub">
        {live ? "Sign in to your coach or client account. New coaches join with the same button." : "Demo with sample data. Edit Priya's workout as the coach, then open the client app to see the change."}
      </p>
      <div className="st-pick">
        <a href="/coach/" className="st-card">
          <span className="st-kick">For coaches</span>
          <b>Coach OS</b>
          <span className="st-line">Brief, programs, clients and business.</span>
          <span className="st-btn act">{live ? "Sign in or join" : "Open Coach OS"}</span>
        </a>
        <a href="/client/" className="st-card">
          <span className="st-kick cl">For clients</span>
          <b>Client app</b>
          <span className="st-line">Today's workout, progress and messages.</span>
          <span className="st-btn">{live ? "Sign in" : "Open client app"}</span>
        </a>
      </div>
      {live && <div className="st-row"><span>Just looking?</span><a href="/coach/?demo">Coach demo</a><a href="/client/?demo">Client demo</a></div>}
      <div className="st-row">
        <ThemeButton />
        <button className="iconbtn" onClick={() => { createDemoStore().reset(); say("Demo data reset"); }}>Reset demo data</button>
      </div>
      {toast}
    </div>
  );
}
