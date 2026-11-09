import { deviceLabel, keyBytes, pushSupport, type PushSupport } from "@apex/core";
import { PUSH_NOT_READY, type PrivacyApi } from "./privacy";

/** What this phone or browser can do with notifications right now. */
export function browserPushSupport(): PushSupport {
  const nav = typeof navigator === "undefined" ? null : navigator;
  if (!nav) return "unsupported";
  const standalone = (typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches) || (nav as Navigator & { standalone?: boolean }).standalone === true;
  return pushSupport({
    hasServiceWorker: "serviceWorker" in nav,
    hasPushManager: typeof window !== "undefined" && "PushManager" in window,
    hasNotification: typeof Notification !== "undefined",
    permission: typeof Notification !== "undefined" ? Notification.permission : null,
    userAgent: nav.userAgent,
    standalone,
    maxTouchPoints: nav.maxTouchPoints,
  });
}

const DEMO_KEY = "apex-push-demo";
const demoOn = () => { try { return localStorage.getItem(DEMO_KEY) === "on"; } catch { return false; } };
const setDemo = (on: boolean) => { try { localStorage.setItem(DEMO_KEY, on ? "on" : "off"); } catch { /* this visit only */ } };

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

/** Whether this device gets notifications from APEX. */
export async function pushIsOn(api: PrivacyApi): Promise<boolean> {
  if (browserPushSupport() !== "granted") return false;
  if (!api.live) return demoOn();
  const reg = await navigator.serviceWorker.getRegistration("/");
  return !!(await reg?.pushManager.getSubscription());
}

/** Asks the phone for permission, then signs this device up. Must run straight from a tap (iPhone insists). */
export async function turnOnPush(api: PrivacyApi): Promise<void> {
  const answer = await Notification.requestPermission();
  if (answer !== "granted") throw new Error(answer === "denied" ? "blocked" : "dismissed");
  const reg = await registration();
  const key = await api.pushKey();
  if (!key) {
    // Demo: nothing to sign up, just show what one looks like.
    setDemo(true);
    await reg.showNotification("APEX", { body: "Notifications are on. You'll hear about new messages here.", icon: "/icon-192.png", tag: "apex-test" });
    return;
  }
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with another key can't be reused.
  if (sub && sub.options.applicationServerKey && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) as BufferSource });
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) throw new Error("This browser gave an incomplete sign-up. Try again.");
  await api.savePush({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device: deviceLabel(navigator.userAgent, navigator.maxTouchPoints) });
}

function sameKey(a: ArrayBuffer, b64url: string) {
  const x = new Uint8Array(a), y = keyBytes(b64url);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

export async function turnOffPush(api: PrivacyApi): Promise<void> {
  if (!api.live) return setDemo(false);
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.removePush(sub.endpoint);
  await sub.unsubscribe();
}

/** Sends a test. The demo shows a sample message from the coach on this device. */
export async function sendTestPush(api: PrivacyApi): Promise<number> {
  if (!api.live) {
    const reg = await registration();
    const fromCoach = api.role === "client";
    await reg.showNotification(fromCoach ? "Kamal" : "Priya", { body: fromCoach ? "Great session today. Add 2.5 kg to the squat next week." : "Finished Lower A. Hip felt fine 💪", icon: "/icon-192.png", tag: "apex-messages", data: { url: `/${api.role}/?demo&open=chat` } });
    return 1;
  }
  return api.testPush();
}

export const pushNotReady = (e: unknown) => e instanceof Error && e.message === PUSH_NOT_READY;
