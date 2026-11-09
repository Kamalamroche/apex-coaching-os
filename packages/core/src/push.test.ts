import { describe, expect, it } from "vitest";
import { deviceLabel, keyBytes, pushPromptDue, pushSupport, unblockHelp, type PushEnv } from "./push";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const all: PushEnv = { hasServiceWorker: true, hasPushManager: true, hasNotification: true, permission: "default", userAgent: ANDROID, standalone: false };

describe("push support", () => {
  it("asks on a phone that can", () => expect(pushSupport(all)).toBe("ask"));
  it("sends iPhone Safari to the Home Screen first", () => {
    expect(pushSupport({ ...all, userAgent: IPHONE, hasPushManager: false })).toBe("ios-install");
    expect(pushSupport({ ...all, userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })).toBe("ios-install");
    expect(pushSupport({ ...all, userAgent: IPHONE, standalone: true })).toBe("ask");
  });
  it("a Mac is not an iPad", () => expect(pushSupport({ ...all, userAgent: IPAD_AS_MAC, maxTouchPoints: 0 })).toBe("ask"));
  it("knows blocked, granted and unsupported", () => {
    expect(pushSupport({ ...all, permission: "denied" })).toBe("blocked");
    expect(pushSupport({ ...all, permission: "granted" })).toBe("granted");
    expect(pushSupport({ ...all, hasPushManager: false })).toBe("unsupported");
  });
  it("gives help for the right phone", () => {
    expect(unblockHelp(IPHONE)).toMatch(/Settings/);
    expect(unblockHelp(ANDROID)).toMatch(/lock icon/);
  });
  it("names devices", () => {
    expect(deviceLabel(IPHONE)).toBe("iPhone");
    expect(deviceLabel(ANDROID)).toBe("Android phone");
    expect(deviceLabel(IPAD_AS_MAC, 5)).toBe("iPad");
    expect(deviceLabel(IPAD_AS_MAC)).toBe("Safari on Mac");
  });
  it("decodes the server key", () => {
    expect([...keyBytes("AQID_w")]).toEqual([1, 2, 3, 255]);
  });
  it("waits a week after Not now", () => {
    const now = Date.UTC(2026, 10, 9);
    expect(pushPromptDue(null, now)).toBe(true);
    expect(pushPromptDue(now - 3 * 864e5, now)).toBe(false);
    expect(pushPromptDue(now - 8 * 864e5, now)).toBe(true);
  });
});
