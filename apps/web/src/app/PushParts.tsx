import { parseTimeOfDay, pushPromptDue, timeOfDay, unblockHelp, type PushSupport, type ReminderPrefs } from "@apex/core";
import { Icons } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { usePrivacyApi, type PrivacyApi } from "../data/privacy";
import { browserPushSupport, pushIsOn, pushNotReady, sendTestPush, turnOffPush, turnOnPush } from "../data/push";

const NOT_READY = "Notifications switch on once the push setup is done in Supabase (SQL and the push function).";
const SNOOZE_KEY = "apex-push-prompt";

function usePush(api: PrivacyApi | null) {
  const [support, setSupport] = useState<PushSupport>(() => browserPushSupport());
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!api) return;
    let live = true;
    pushIsOn(api).then((v) => live && setOn(v), () => live && setOn(false));
    return () => { live = false; };
  }, [api]);
  const fail = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    setSupport(browserPushSupport());
    setError(pushNotReady(e) ? NOT_READY : msg === "blocked" || msg === "dismissed" ? null : msg);
  };
  const enable = useCallback(async () => {
    if (!api) return false;
    setBusy(true);
    setError(null);
    try {
      await turnOnPush(api);
      setOn(true);
      setSupport(browserPushSupport());
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy(false);
    }
  }, [api]);
  const disable = async () => {
    if (!api) return;
    setBusy(true);
    setError(null);
    try {
      await turnOffPush(api);
      setOn(false);
    } catch (e) {
      fail(e);
    }
    setBusy(false);
  };
  return { support, on, busy, error, enable, disable };
}

function IosSteps() {
  return (
    <ol className="small push-steps">
      <li>Tap the Share button <span aria-hidden>(the square with an arrow)</span> at the bottom of Safari.</li>
      <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
      <li>Open APEX from your Home Screen and switch notifications on here.</li>
    </ol>
  );
}

/** Account screen: switch notifications on or off for this phone, and send a test. */
export function NotificationsCard({ api, say }: { api: PrivacyApi; say: (m: string) => void }) {
  const p = usePush(api);
  const [testing, setTesting] = useState(false);
  const who = api.role === "coach" ? "a client" : "your coach";
  const test = async () => {
    setTesting(true);
    try {
      const n = await sendTestPush(api);
      say(n ? "Test sent. It should arrive in a few seconds" : "No device got it. Switch notifications off and on again");
    } catch (e) {
      say(pushNotReady(e) ? NOT_READY : e instanceof Error ? e.message : String(e));
    }
    setTesting(false);
  };
  return (
    <section className="card stack full" aria-label="Notifications">
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Notifications</h3>{p.on && <span className="tiny" style={{ color: "var(--good)" }}>On for this {api.live ? "device" : "demo"}</span>}</div>
      {p.support === "unsupported" && <div className="small">This browser can't show notifications. On a phone, open APEX in Chrome (Android) or Safari (iPhone).</div>}
      {p.support === "ios-install" && (
        <>
          <div className="small">On iPhone, notifications work once APEX is on your Home Screen. It takes ten seconds:</div>
          <IosSteps />
        </>
      )}
      {p.support === "blocked" && <div className="small">Notifications are blocked for APEX on this device. {unblockHelp(navigator.userAgent, navigator.maxTouchPoints)}</div>}
      {(p.support === "ask" || p.support === "granted") && p.on !== null && (
        <label className="row" style={{ gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
          <div className="grow">
            <div className="h3">New messages on this {api.live ? "phone" : "device"}</div>
            <div className="small">A notification about a minute after {who} messages you, if you haven't read it yet. Turn it on for each phone or computer you use.</div>
          </div>
          <input type="checkbox" role="switch" aria-label="New message notifications" checked={p.on} disabled={p.busy} onChange={(e) => void (e.target.checked ? p.enable() : p.disable())} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none", marginTop: 4 }} />
        </label>
      )}
      {p.on && <ReminderSettings api={api} />}
      {p.on && <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} disabled={testing} onClick={() => void test()}><Icons.bell width={15} height={15} /> {testing ? "Sending…" : "Send a test"}</button>}
      {p.error && <div className="small" role="alert">{p.error}</div>}
    </section>
  );
}

/** Reminder times for clients, check-in alerts for coaches. Saved as soon as they change. */
function ReminderSettings({ api }: { api: PrivacyApi }) {
  const [r, setR] = useState<ReminderPrefs | null | "loading">("loading");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api.reminders().then((v) => live && setR(v), () => live && setR(null));
    return () => { live = false; };
  }, [api]);
  if (r === "loading") return null;
  if (!r) return <div className="tiny">Reminders switch on once the reminders SQL is run in Supabase.</div>;
  const change = (next: ReminderPrefs) => {
    const before = r;
    setR(next);
    setError(null);
    api.setReminders(next).catch((e: unknown) => {
      setR(before);
      setError(pushNotReady(e) ? "Reminders need the reminders SQL in Supabase first." : e instanceof Error ? e.message : String(e));
    });
  };
  const row = (label: string, hint: string, on: boolean, setOn: (v: boolean) => void, at?: number, setAt?: (m: number) => void) => (
    <div className="row" style={{ gap: 10, alignItems: "center" }}>
      <div className="grow"><div className="h3" style={{ fontSize: 15 }}>{label}</div><div className="tiny">{hint}</div></div>
      {at !== undefined && setAt && <input type="time" className="field num" style={{ width: "auto", padding: "6px 8px" }} aria-label={`${label} time`} disabled={!on} value={timeOfDay(at)} onChange={(e) => { const m = parseTimeOfDay(e.target.value); if (m !== null) setAt(m); }} />}
      <input type="checkbox" role="switch" aria-label={label} checked={on} onChange={(e) => setOn(e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
    </div>
  );
  return (
    <div className="stack" style={{ gap: 12, paddingTop: 4, borderTop: "1px solid var(--line)" }}>
      {api.role === "client" ? (
        <>
          {row("Workout reminder", "On training days: what's planned and how long it takes", r.workoutOn, (v) => change({ ...r, workoutOn: v }), r.workoutAt, (m) => change({ ...r, workoutAt: m }))}
          {row("Evening log", "A nudge to log food, water and habits", r.habitsOn, (v) => change({ ...r, habitsOn: v }), r.habitsAt, (m) => change({ ...r, habitsAt: m }))}
        </>
      ) : (
        row("Check-in alerts", "When a client sends their weekly check-in", r.alertsOn, (v) => change({ ...r, alertsOn: v }))
      )}
      {error && <div className="small" role="alert">{error}</div>}
    </div>
  );
}

/** A friendly nudge on Today or Brief until notifications are on. "Not now" hides it for a week. */
export function PushPrompt({ say, full }: { say: (m: string) => void; full?: boolean }) {
  const api = usePrivacyApi();
  const p = usePush(api);
  const [snoozed, setSnoozed] = useState<number | null>(() => {
    try { return Number(localStorage.getItem(SNOOZE_KEY)) || null; } catch { return null; }
  });
  const [steps, setSteps] = useState(false);
  if (!api || p.on !== false || !pushPromptDue(snoozed, Date.now())) return null;
  if (p.support === "unsupported" || p.support === "blocked") return null;
  const later = () => {
    const now = Date.now();
    setSnoozed(now);
    try { localStorage.setItem(SNOOZE_KEY, String(now)); } catch { /* this visit only */ }
  };
  const go = async () => {
    if (p.support === "ios-install") return setSteps(true);
    if (await p.enable()) say("Notifications are on");
  };
  const who = api.role === "coach" ? "clients" : "your coach";
  return (
    <div className={`card push-prompt${full ? " full" : ""}`} role="region" aria-label="Turn on notifications">
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <span className="push-icon" aria-hidden><Icons.bell width={18} height={18} /></span>
        <div className="grow stack" style={{ gap: 4 }}>
          <div className="h3">Never miss a message</div>
          <div className="small">Get a notification when {who} message{api.role === "coach" ? "" : "s"} you, even with APEX closed.</div>
        </div>
      </div>
      {steps && <IosSteps />}
      {p.error && <div className="small" role="alert">{p.error}</div>}
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        {!steps && <button className="btn act sm" disabled={p.busy} onClick={() => void go()}>{p.busy ? "Turning on…" : "Turn on"}</button>}
        <button className="btn ghost sm" onClick={later}>{steps ? "Done" : "Not now"}</button>
      </div>
    </div>
  );
}

/** Opens a tab when the app is started from a notification (?open=chat) or a tapped notification focuses it.
    `tabs` maps the open= value to a tab, e.g. { chat: "chat", today: "today" }. */
export function useOpenFromNotification<T extends string>(tabs: Partial<Record<string, T>>, open: (t: T) => void) {
  useEffect(() => {
    const pick = (search: string) => tabs[new URLSearchParams(search).get("open") ?? ""];
    const first = pick(location.search);
    if (first) {
      open(first);
      const q = new URLSearchParams(location.search);
      q.delete("open");
      const rest = q.toString().replace(/=(&|$)/g, "$1");
      history.replaceState(null, "", `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`);
    }
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string } | null;
      if (d?.type !== "apex-open" || !d.url) return;
      const t = pick(new URL(d.url, location.origin).search);
      if (t) open(t);
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);
}
