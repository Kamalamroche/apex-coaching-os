import { Icons, ThemeButton, useToast } from "@apex/ui";
import { store } from "../store";

export function Launcher() {
  const [toast, say] = useToast();
  return (
    <div className="sel">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
        <div className="wordmark"><Icons.logo /><b>APEX</b></div>
        <h1 className="h1" style={{ fontSize: "clamp(26px,5vw,40px)", maxWidth: 620 }}>Simple for the client. Powerful for the coach.</h1>
        <p className="sub" style={{ maxWidth: 460 }}>
          Demo with sample data. Edit Priya's workout as the coach, then open the client app and you'll see the change. Open both in separate tabs and they stay in sync.
        </p>
      </div>
      <div className="pick">
        <a href="/coach/">
          <span className="eyebrow" style={{ color: "var(--act)" }}>For coaches</span>
          <span className="h2" style={{ fontSize: 24 }}>Coach OS</span>
          <ul>
            <li>Morning Brief: who needs you today, and why</li>
            <li>Progressions suggested from logged RPE</li>
            <li>Fast builder with synonym search and one-tap swaps</li>
            <li>Nutrition, check-ins and revenue in one place</li>
          </ul>
          <span className="btn act block" style={{ marginTop: 6 }}>Open Coach OS</span>
        </a>
        <a href="/client/" className="cl">
          <span className="eyebrow" style={{ color: "var(--data)" }}>For clients</span>
          <span className="h2" style={{ fontSize: 24 }}>Client app</span>
          <ul className="cl">
            <li>Opens on today's workout</li>
            <li>Guided player with video, cues and rest timer</li>
            <li>Last time's numbers on every set</li>
            <li>Progress, messages and nutrition one tap away</li>
          </ul>
          <span className="btn sec block" style={{ marginTop: 6 }}>Open client app</span>
        </a>
      </div>
      <div className="row">
        <ThemeButton />
        <button className="iconbtn" onClick={() => { store.reset(); say("Demo data reset"); }}>Reset demo data</button>
      </div>
      {toast}
    </div>
  );
}
