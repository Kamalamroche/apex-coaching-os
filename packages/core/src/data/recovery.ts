/* Sample recovery for the demo: four weeks of mornings from a made-up ring, with a rough patch three
   days ago (short sleep, HRV down, resting heart rate up) so the charts and the readiness pre-fill show something. */

import { localDate, type RecoveryDay } from "../recovery";

export function sampleRecovery(now = new Date()): RecoveryDay[] {
  return Array.from({ length: 28 }, (_, k) => {
    const d = new Date(now);
    d.setDate(d.getDate() - k);
    const wave = Math.sin(k * 1.3) + 0.6 * Math.sin(k * 0.45 + 1);
    const rough = k === 3 ? 1 : k === 2 || k === 4 ? 0.5 : 0;
    const sleep = Math.round(445 + 32 * wave - 120 * rough);
    const deep = Math.round(sleep * (0.17 + 0.02 * Math.sin(k)));
    const rem = Math.round(sleep * (0.22 + 0.02 * Math.cos(k)));
    const hrv = Math.round(58 + 6 * wave - 16 * rough);
    const rhr = Math.round(54 - 2 * wave + 6 * rough);
    return {
      date: localDate(d), source: "oura",
      sleepMinutes: sleep, stages: { deep, rem, light: sleep - deep - rem, awake: Math.round(28 + 10 * Math.cos(k * 0.8) + 25 * rough) },
      sleepScore: Math.max(40, Math.min(96, Math.round(78 + 9 * wave - 28 * rough))),
      hrvMs: hrv, restingHr: rhr,
      recoveryScore: Math.max(30, Math.min(97, Math.round(76 + 10 * wave - 30 * rough))),
      stress: Math.max(5, Math.min(90, Math.round(32 - 10 * wave + 30 * rough))),
      steps: Math.round(8200 + 2600 * Math.sin(k * 0.9)),
    } satisfies RecoveryDay;
  });
}
