/* True inside the App Store or Google Play app (the Capacitor shell in apps/mobile), which adds
   window.Capacitor. The web app itself doesn't import Capacitor, so the website is unchanged. */
export function isNativeApp(): boolean {
  const cap = typeof window === "undefined" ? undefined : (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}
