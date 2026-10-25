import { useApexState } from "@apex/core/react";
import { Avatar } from "@apex/ui";
import { useEffect, useRef, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { useStore } from "../../data/StoreContext";

export function Chat() {
  const store = useStore();
  const { coachName } = useAppInfo();
  const { messages } = useApexState(store);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    store.sendMessage("client", t);
    setText("");
  };
  return (
    <>
      <div className="row"><Avatar initials={coachName.slice(0, 1).toUpperCase()} tone="var(--act)" /><div><h1 className="h1" style={{ fontSize: 20 }}>Coach {coachName}</h1><div className="tiny">Usually replies within a few hours</div></div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m, i) => {
          const mine = m.from === "client";
          return (
            <div key={i} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", background: mine ? "var(--blue)" : "var(--card)", color: mine ? "#fff" : "var(--text)", border: mine ? "none" : "1px solid var(--line)", borderRadius: 12, padding: "10px 12px" }}>
              <div>{m.text}</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: "right" }}>{m.time}</div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <div className="row" style={{ position: "sticky", bottom: "calc(84px + env(safe-area-inset-bottom,0px))" }}>
        <input id="chatbox" className="field" placeholder={`Message ${coachName}`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
        <button className="btn act" onClick={send} disabled={!text.trim()}>Send</button>
      </div>
    </>
  );
}
