/** Sign-in helpers: which one-tap providers are on, in-app browser detection, and friendly errors. */

export type OAuthProvider = "google" | "apple";

export interface AuthOptions {
  /** One-tap providers switched on in Supabase. */
  providers: OAuthProvider[];
  /** Email + password works. */
  password: boolean;
  /** True when Supabase signs new email + password accounts straight in (email confirmation off). */
  instantSignUp: boolean;
  /** False when new sign-ups are closed. */
  signUpOpen: boolean;
}

/** Used while Supabase's settings load, or when they can't be read: show everything and let the server decide. */
export const DEFAULT_AUTH_OPTIONS: AuthOptions = { providers: ["google", "apple"], password: true, instantSignUp: true, signUpOpen: true };

/** Reads the public `/auth/v1/settings` reply from Supabase. Anything unexpected falls back to the defaults. */
export function parseAuthSettings(raw: unknown): AuthOptions {
  if (!raw || typeof raw !== "object") return DEFAULT_AUTH_OPTIONS;
  const r = raw as { external?: Record<string, unknown>; disable_signup?: unknown; mailer_autoconfirm?: unknown };
  const ext = r.external && typeof r.external === "object" ? r.external : null;
  if (!ext) return DEFAULT_AUTH_OPTIONS;
  const providers = (["google", "apple"] as const).filter((p) => ext[p] === true);
  return {
    providers,
    password: ext.email !== false,
    instantSignUp: r.mailer_autoconfirm === true,
    signUpOpen: r.disable_signup !== true,
  };
}

/**
 * Browsers built into other apps (Gmail, Instagram, Facebook, TikTok, LinkedIn…). Google refuses
 * to sign people in there ("disallowed_useragent"), so the screen suggests opening the page in
 * Safari or Chrome, or using email + password, which works everywhere.
 */
export function inAppBrowser(userAgent: string): string | null {
  const ua = userAgent || "";
  const known: [RegExp, string][] = [
    [/\bGSA\//, "Google app"],
    [/Instagram/i, "Instagram"],
    [/FBAN|FBAV|FB_IAB|FBIOS/, "Facebook"],
    [/musical_ly|BytedanceWebview|TikTok/i, "TikTok"],
    [/LinkedInApp/i, "LinkedIn"],
    [/Snapchat/i, "Snapchat"],
    [/\bLine\//, "LINE"],
    [/Twitter|XApp/i, "X"],
    [/Pinterest/i, "Pinterest"],
    [/WhatsApp/i, "WhatsApp"],
  ];
  for (const [re, name] of known) if (re.test(ua)) return name;
  // Android WebView marks itself with "; wv)". iOS web views lack "Safari/" but have AppleWebKit + Mobile/.
  if (/; wv\)/.test(ua)) return "this app";
  if (/iPhone|iPad|iPod/.test(ua) && /AppleWebKit/.test(ua) && /Mobile\//.test(ua) && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) return "this app";
  return null;
}

/** Turns Supabase's sign-in errors into plain UK-English copy. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Check them, or email yourself a sign-in link instead.";
  if (m.includes("user already registered") || m.includes("already been registered")) return "There's already an account with this email. Sign in instead.";
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) return "This sign-in option isn't switched on yet. Use email and password for now.";
  if (m.includes("email not confirmed")) return "Confirm your email first: open the link we sent you. Or email yourself a sign-in link.";
  if (m.includes("password should be") || m.includes("weak password")) return "Pick a longer password: at least 8 characters, mixing letters and numbers.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries in a short time. Wait a minute and try again.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "New accounts are closed for now. Ask your coach for help.";
  return message;
}

/** Name to suggest on the first-time screen, from what Google or Apple shared. */
export function suggestedName(meta: Record<string, unknown> | undefined | null): string {
  if (!meta) return "";
  for (const k of ["full_name", "name"]) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const g = meta.given_name, f = meta.family_name;
  return [g, f].filter((x): x is string => typeof x === "string" && !!x.trim()).join(" ").trim();
}
