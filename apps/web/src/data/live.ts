import { readLiveState, type LiveState } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";

/* Live sessions travel as messages only, nothing is stored: Supabase Realtime broadcast on a channel per coach
   when live, a BroadcastChannel between tabs in the demo. The coach sends the timer state; clients follow it and
   say who they are (presence), so the coach sees who's in. */

export interface LiveLink {
  side: "coach" | "client";
  /** Coach: send the current state to everyone. */
  send(s: LiveState): void;
  /** The latest state, and how far this phone's clock is from the coach's. Null when nothing is running. */
  onState(cb: (s: LiveState | null, offsetMs: number) => void): () => void;
  /** Who is following right now (first names). */
  onPeople(cb: (names: string[]) => void): () => void;
  /** Client: start or stop following (shows them in the coach's list). */
  follow(on: boolean): void;
  close(): void;
}

type Msg = { t: "state"; s: unknown } | { t: "hello"; name: string; id: string } | { t: "bye"; id: string };

/** Shared by both versions: keeps the last state, the people list and the listeners. */
function hub(side: "coach" | "client", me: { id: string; name: string }, post: (m: Msg) => void) {
  let state: LiveState | null = null;
  let offset = 0;
  const people = new Map<string, string>();
  const stateFns = new Set<(s: LiveState | null, o: number) => void>();
  const peopleFns = new Set<(n: string[]) => void>();
  const emitPeople = () => peopleFns.forEach((f) => f([...people.values()]));
  return {
    receive(m: Msg) {
      if (m.t === "state") {
        const s = readLiveState(m.s);
        if (!s) return;
        state = s.status === "ended" ? null : s;
        offset = s.sentAt - Date.now();
        stateFns.forEach((f) => f(state, offset));
        if (!state) { people.clear(); emitPeople(); }
      } else if (m.t === "hello") {
        people.set(m.id, m.name);
        emitPeople();
        // Someone just opened the app: the coach tells them where the session is.
        if (side === "coach" && state) post({ t: "state", s: { ...state, sentAt: Date.now() } });
      } else if (m.t === "bye") {
        people.delete(m.id);
        emitPeople();
      }
    },
    link(extra: { close(): void }): LiveLink {
      return {
        side,
        send(s) {
          state = s.status === "ended" ? null : s;
          offset = 0;
          post({ t: "state", s });
          stateFns.forEach((f) => f(state, 0));
          if (!state) { people.clear(); emitPeople(); }
        },
        onState(cb) { stateFns.add(cb); cb(state, offset); return () => stateFns.delete(cb); },
        onPeople(cb) { peopleFns.add(cb); cb([...people.values()]); return () => peopleFns.delete(cb); },
        follow(on) { post(on ? { t: "hello", name: me.name, id: me.id } : { t: "bye", id: me.id }); },
        close() { extra.close(); },
      };
    },
  };
}

/** Live: one broadcast channel per coach. The coach's id is the channel name; only timer states go over it. */
export function liveSessionLink(db: SupabaseClient, who: { side: "coach" | "client"; coachId: string; me: { id: string; name: string } }): LiveLink {
  const ch = db.channel(`live-${who.coachId}`, { config: { broadcast: { self: false } } });
  const h = hub(who.side, who.me, (m) => { void ch.send({ type: "broadcast", event: "live", payload: m }); });
  ch.on("broadcast", { event: "live" }, ({ payload }) => h.receive(payload as Msg)).subscribe((status) => {
    // A client asks where things are as soon as it connects, without showing up as following.
    if (status === "SUBSCRIBED" && who.side === "client") void ch.send({ type: "broadcast", event: "live", payload: { t: "hello", name: "", id: `peek-${who.me.id}` } });
  });
  return h.link({ close: () => { void db.removeChannel(ch); } });
}

/** Demo: coach and client tabs talk through a BroadcastChannel; the last state is kept for a tab opened later. */
export function demoLiveLink(side: "coach" | "client"): LiveLink {
  const KEY = "apex-live-demo";
  const me = side === "coach" ? { id: "coach", name: "Kamal" } : { id: "priya", name: "Priya" };
  const bc = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("apex-live");
  const h = hub(side, me, (m) => {
    bc?.postMessage(m);
    if (m.t === "state") { try { localStorage.setItem(KEY, JSON.stringify(m.s)); } catch { /* this tab only */ } }
  });
  if (bc) bc.onmessage = (e) => h.receive(e.data as Msg);
  try {
    const saved = readLiveState(JSON.parse(localStorage.getItem(KEY) ?? "null"));
    if (saved && saved.status !== "ended") h.receive({ t: "state", s: { ...saved, sentAt: Date.now() } }); // same device, same clock
  } catch { /* nothing saved */ }
  return h.link({ close: () => bc?.close() });
}

const Ctx = createContext<LiveLink | null>(null);
export const LiveProvider = Ctx.Provider;
export const useLiveLink = (): LiveLink | null => useContext(Ctx);

/** The running session and the clock offset, or null. */
export function useLiveState(): { state: LiveState | null; offset: number } {
  const link = useLiveLink();
  const [v, setV] = useState<{ state: LiveState | null; offset: number }>({ state: null, offset: 0 });
  useEffect(() => link?.onState((state, offset) => setV({ state, offset })), [link]);
  return v;
}

export function useLivePeople(): string[] {
  const link = useLiveLink();
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => link?.onPeople((n) => setNames(n.filter(Boolean))), [link]);
  return names;
}
