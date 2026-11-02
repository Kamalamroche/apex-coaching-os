import type { Message } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../data/StoreContext";

/** The coach–client message thread. `me` decides which side the bubbles sit on and who sends. */
export function Thread({ me, to }: { me: Message["from"]; to: string }) {
  const store = useStore();
  const { messages } = useApexState(store);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    store.sendMessage(me, t);
    setText("");
  };
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 && <div className="small">No messages yet. Say hello to {to}.</div>}
        {messages.map((m, i) => {
          const mine = m.from === me;
          return (
            <div key={i} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", background: mine ? "var(--blue)" : "var(--card)", color: mine ? "#fff" : "var(--text)", border: mine ? "none" : "1px solid var(--line)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ whiteSpace: "pre-line" }}>{m.text}</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: "right" }}>{m.time}</div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <div className="row" style={{ position: "sticky", bottom: "calc(84px + env(safe-area-inset-bottom,0px))" }}>
        <input id="chatbox" className="field" placeholder={`Message ${to}`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
        <button className="btn act" onClick={send} disabled={!text.trim()}>Send</button>
      </div>
    </>
  );
}
