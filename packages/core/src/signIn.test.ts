import { describe, expect, it } from "vitest";
import { DEFAULT_AUTH_OPTIONS, friendlyAuthError, inAppBrowser, parseAuthSettings, suggestedName } from "./signIn";

describe("parseAuthSettings", () => {
  it("reads providers, confirmation and sign-up state", () => {
    expect(parseAuthSettings({ external: { google: true, apple: false, email: true }, disable_signup: false, mailer_autoconfirm: true }))
      .toEqual({ providers: ["google"], password: true, instantSignUp: true, signUpOpen: true });
    expect(parseAuthSettings({ external: { google: true, apple: true, email: true }, mailer_autoconfirm: false, disable_signup: true }))
      .toEqual({ providers: ["google", "apple"], password: true, instantSignUp: false, signUpOpen: false });
  });
  it("falls back to showing everything on odd input", () => {
    expect(parseAuthSettings(null)).toBe(DEFAULT_AUTH_OPTIONS);
    expect(parseAuthSettings({ msg: "error" })).toBe(DEFAULT_AUTH_OPTIONS);
  });
});

describe("inAppBrowser", () => {
  it("spots app browsers", () => {
    expect(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0")).toBe("Instagram");
    expect(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/300.0 Mobile/15E148 Safari/604.1")).toBe("Google app");
    expect(inAppBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120 Mobile Safari/537.36")).toBe("this app");
    expect(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148")).toBe("this app");
  });
  it("leaves real browsers alone", () => {
    expect(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toBeNull();
    expect(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120 Mobile/15E148")).toBeNull();
    expect(inAppBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36")).toBeNull();
  });
});

describe("friendlyAuthError", () => {
  it("rewrites known errors and keeps unknown ones", () => {
    expect(friendlyAuthError("Invalid login credentials")).toMatch(/don't match/);
    expect(friendlyAuthError("Unsupported provider: provider is not enabled")).toMatch(/isn't switched on/);
    expect(friendlyAuthError("Something odd")).toBe("Something odd");
  });
});

describe("suggestedName", () => {
  it("picks the best name Google or Apple shared", () => {
    expect(suggestedName({ full_name: "Kamal Amroche" })).toBe("Kamal Amroche");
    expect(suggestedName({ given_name: "Priya", family_name: "Sharma" })).toBe("Priya Sharma");
    expect(suggestedName(undefined)).toBe("");
  });
});
