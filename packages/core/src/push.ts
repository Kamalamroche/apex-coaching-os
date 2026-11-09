/* ---------- Push notifications: what this phone or browser can do ---------- */

export type PushSupport =
  /** This browser can't show notifications from a website. */
  | "unsupported"
  /** iPhone or iPad in Safari: notifications only work once APEX is added to the Home Screen. */
  | "ios-install"
  /** The person said no before; only the phone's settings can undo that. */
  | "blocked"
  /** Ready to ask. */
  | "ask"
  /** Allowed. */
  | "granted";

export interface PushEnv {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: "default" | "denied" | "granted" | null;
  userAgent: string;
  /** Opened from the Home Screen (display-mode: standalone or navigator.standalone). */
  standalone: boolean;
  /** iPads report themselves as Macs; a touch screen gives them away. */
  maxTouchPoints?: number;
}

export const isAppleMobile = (ua: string, maxTouchPoints = 0) =>
  /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1);

export function pushSupport(env: PushEnv): PushSupport {
  const apple = isAppleMobile(env.userAgent, env.maxTouchPoints);
  // On iPhone the push APIs only appear inside the Home Screen app, so a missing API there means "install first".
  if (apple && !env.standalone) return "ios-install";
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return "unsupported";
  if (env.permission === "denied") return "blocked";
  if (env.permission === "granted") return "granted";
  return "ask";
}

/** How to switch notifications back on after saying no, for the phone in hand. */
export function unblockHelp(ua: string, maxTouchPoints = 0): string {
  if (isAppleMobile(ua, maxTouchPoints)) return "Open Settings, then Notifications, then APEX, and switch on Allow Notifications.";
  if (/Android/i.test(ua)) return "Tap the lock icon next to the address (or long-press the APEX icon, then App info), open Notifications and allow them.";
  return "Click the lock icon next to the web address, find Notifications and set it to Allow, then reload the page.";
}

/** A short name for the device, so a person can tell their phones apart. */
export function deviceLabel(ua: string, maxTouchPoints = 0): string {
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) return "iPad";
  if (/iPhone|iPod/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? "Android phone" : "Android tablet";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/i.test(ua) ? "Windows" : /Mac OS X|Macintosh/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

/** The server's public key (base64url) as the bytes PushManager.subscribe wants. */
export function keyBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** The prompt card on Today waits a week after "Not now". */
export const PUSH_SNOOZE_DAYS = 7;
export const pushPromptDue = (snoozedAt: number | null, now: number) => !snoozedAt || now - snoozedAt > PUSH_SNOOZE_DAYS * 864e5;
