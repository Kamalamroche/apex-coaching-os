/* Sample recovery for the demo: four weeks of mornings from a made-up ring, with a rough patch three
   days ago (late night, short sleep, HRV down, resting heart rate up) so the charts and the readiness
   pre-fill show something. Each night has a stage timeline built the way real nights run: about
   90-minute cycles, most deep sleep early, longer REM towards morning. */

import { localDate, type RecoveryDay } from "../recovery";
import { stagesFromHypnogram } from "../recoveryTrends";

/** A night of `epochs` five-minute steps. `seed` varies the cycles a little from night to night. */
function night(epochs: number, seed: number, restless: number): string {
  let out = "a".repeat(2 + (seed % 3));
  let cycle = 0;
  while (out.length < epochs - 2) {
    const deep = Math.max(0, 7 - cycle * 2 - (seed % 2)) - (restless > 0.5 && cycle === 0 ? 3 : 0);
    const rem = Math.min(6, 1 + cycle + ((seed + cycle) % 2));
    out += "l".repeat(7 + ((seed + cycle) % 3)) + "d".repeat(Math.max(0, deep)) + "l".repeat(2) + "r".repeat(rem);
    if ((seed + cycle) % 3 === 0 || restless > 0.5) out += "a".repeat(1 + Math.round(restless * 2));
    cycle++;
  }
  return (out.slice(0, epochs - 2) + "aa").slice(0, epochs);
}

export function sampleRecovery(now = new Date()): RecoveryDay[] {
  return Array.from({ length: 28 }, (_, k) => {
    const d = new Date(now);
    d.setDate(d.getDate() - k);
    const wave = Math.sin(k * 1.3) + 0.6 * Math.sin(k * 0.45 + 1);
    const rough = k === 3 ? 1 : k === 2 || k === 4 ? 0.5 : 0;
    // Into bed around 22:50, a little later at weekends and much later on the rough night.
    const bed = new Date(d);
    bed.setDate(bed.getDate() - 1);
    const weekend = bed.getDay() === 5 || bed.getDay() === 6 ? 35 : 0;
    bed.setHours(22, 50 + Math.round(18 * Math.sin(k * 0.7)) + weekend + Math.round(70 * rough), 0, 0);
    const inBed = Math.round(500 + 34 * wave - 115 * rough);
    const hypnogram = night(Math.round(inBed / 5), k * 7 + 3, rough);
    const stages = stagesFromHypnogram(hypnogram);
    const sleep = stages.deep + stages.rem + stages.light;
    const hrv = Math.round(58 + 6 * wave - 16 * rough);
    const rhr = Math.round(54 - 2 * wave + 6 * rough);
    return {
      date: localDate(d), source: "oura",
      sleepMinutes: sleep, stages,
      sleepScore: Math.max(40, Math.min(96, Math.round(78 + 9 * wave - 28 * rough))),
      hrvMs: hrv, restingHr: rhr,
      recoveryScore: Math.max(30, Math.min(97, Math.round(76 + 10 * wave - 30 * rough))),
      stress: Math.max(5, Math.min(90, Math.round(32 - 10 * wave + 30 * rough))),
      steps: Math.round(8200 + 2600 * Math.sin(k * 0.9)),
      bedtime: bed.toISOString(), wakeTime: new Date(bed.getTime() + hypnogram.length * 5 * 60_000).toISOString(), hypnogram,
    } satisfies RecoveryDay;
  });
}
