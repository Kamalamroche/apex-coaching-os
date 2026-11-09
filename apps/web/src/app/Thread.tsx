import { VOICE_MIN_SECONDS, voiceClock, type Message } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Icons, VoiceNote } from "@apex/ui";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../data/StoreContext";
import type { RepliesApi } from "../data/savedReplies";
import { SavedReplies } from "./SavedReplies";
import { canRecord, useVoiceRecorder } from "./voice";

/** The coach–client message thread. `me` decides which side the bubbles sit on and who sends.
    Both sides can send voice notes; the coach also gets saved replies when `replies` is given. */
export function Thread({ me, to, replies, say }: { me: Message["from"]; to: string; replies?: RepliesApi; say?: (m: string) => void }) {
  const store = useStore();
  const { messages } = useApexState(store);
  const [text, setText] = useState("");
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  const tell = (m: string) => (say ? say(m) : alert(m));
  const send = () => {
    const t = text.trim();
    if (!t) return;
    store.sendMessage(me, t);
    setText("");
  };
  const voice = useVoiceRecorder((audio, seconds) => {
    if (seconds < VOICE_MIN_SECONDS) { tell("Hold on a little longer to record"); return; }
    if (!store.sendVoice) return;
    setSending(true);
    store.sendVoice(me, audio, seconds).catch((e: unknown) => tell(e instanceof Error ? e.message : "Couldn't send the voice note")).finally(() => setSending(false));
  });
  const record = () => voice.start().catch(() => tell("Allow the microphone for this site to send voice notes"));
  const voiceOn = !!store.sendVoice && canRecord();
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 && <div className="small">No messages yet. Say hello to {to}.</div>}
        {messages.map((m, i) => {
          const mine = m.from === me;
          return (
            <div key={i} className={`msg ${mine ? "mine" : "theirs"}`} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", background: mine ? "var(--blue)" : "var(--card)", color: mine ? "#fff" : "var(--text)", border: mine ? "none" : "1px solid var(--line)", borderRadius: 12, padding: "10px 12px" }}>
              {m.voice && store.voiceUrl ? (
                <VoiceNote seconds={m.voice.seconds} mine={mine} load={() => store.voiceUrl!(m.voice!.path)} />
              ) : (
                <div style={{ whiteSpace: "pre-line" }}>{m.text}</div>
              )}
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: "right" }}>{m.time}</div>
            </div>
          );
        })}
        {sending && <div className="tiny" style={{ alignSelf: "flex-end" }}>Sending voice note…</div>}
        <div ref={end} />
      </div>
      <div className="row" style={{ position: "sticky", bottom: "calc(84px + env(safe-area-inset-bottom,0px))" }}>
        {voice.recording ? (
          <div className="vn-rec grow" role="status" aria-live="polite">
            <span className="vn-dot" aria-hidden />
            <span className="grow small">Recording · <span className="num">{voiceClock(voice.seconds)}</span> of 2:00</span>
            <button className="btn ghost" onClick={voice.cancel}>Cancel</button>
            <button className="btn act" onClick={voice.send} aria-label="Send voice note"><Icons.send width={16} height={16} /></button>
          </div>
        ) : (
          <>
            {replies && (
              <button className="iconbtn" aria-label="Saved replies" title="Saved replies" onClick={() => setPicking(true)}><Icons.replies width={18} height={18} /></button>
            )}
            <input ref={box} id="chatbox" className="field" placeholder={`Message ${to}`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
            {voiceOn && !text.trim() ? (
              <button className="btn act" onClick={() => void record()} aria-label="Record a voice note" title="Record a voice note" disabled={sending}><Icons.mic width={18} height={18} /></button>
            ) : (
              <button className="btn act" onClick={send} disabled={!text.trim()}>Send</button>
            )}
          </>
        )}
      </div>
      {picking && replies && (
        <SavedReplies api={replies} firstName={to} onClose={() => setPicking(false)} say={tell}
          onPick={(filled) => { setText((t) => (t.trim() ? `${t.trim()} ${filled}` : filled)); setPicking(false); setTimeout(() => box.current?.focus(), 0); }} />
      )}
    </>
  );
}
