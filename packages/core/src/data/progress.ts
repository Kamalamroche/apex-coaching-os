import type { CheckIn, Measurement, Pose, ProgressPhoto, ProgressState } from "../checkins";

/* Priya's last ten weeks for the demo: weekly check-ins (due Saturdays), measurements and a photo set every
   two weeks. The photos are drawn here as simple silhouettes, so the demo shows the library without real people. */

const base = { stress: 2, hunger: 3, wins: "", struggles: "", note: "", coachReply: null, reviewedAt: null };

const CHECK_INS: CheckIn[] = [
  { ...base, id: "demo-ci-3", submittedAt: "2026-10-18T09:12:00Z", weightKg: 62.6, sleepHours: 7, energy: 4, mood: 4, training: 4, nutrition: 4, wins: "Hit every session", struggles: "Hip a little tight after RDLs", coachReply: "Nice week. Let's add a hip warm-up before Lower A.", reviewedAt: "2026-10-18T12:40:00Z" },
  { ...base, id: "demo-ci-2", submittedAt: "2026-10-11T08:40:00Z", weightKg: 62.9, sleepHours: 6, energy: 3, mood: 3, stress: 4, training: 3, nutrition: 3, struggles: "Busy week at work", coachReply: "Busy weeks happen. Two good sessions still counts.", reviewedAt: "2026-10-11T18:05:00Z" },
  { ...base, id: "demo-ci-1", submittedAt: "2026-10-04T10:02:00Z", weightKg: 63.1, sleepHours: 7.5, energy: 4, mood: 5, training: 5, nutrition: 4, wins: "Loving the new program", coachReply: "Great start, Priya.", reviewedAt: "2026-10-04T16:30:00Z" },
  { ...base, id: "demo-ci-0", submittedAt: "2026-09-20T09:30:00Z", weightKg: 63.6, sleepHours: 7, energy: 3, mood: 4, training: 4, nutrition: 3, coachReply: "Solid. Protein is the focus this fortnight.", reviewedAt: "2026-09-20T15:00:00Z" },
  { ...base, id: "demo-ci-00", submittedAt: "2026-09-06T09:30:00Z", weightKg: 64.4, sleepHours: 6.5, energy: 3, mood: 3, training: 3, nutrition: 3, wins: "First full week done", coachReply: "Welcome aboard!", reviewedAt: "2026-09-06T14:00:00Z" },
];

const MEASUREMENTS: Measurement[] = [
  { id: "demo-m-a", measuredAt: "2026-08-30T09:00:00Z", checkInId: null, weightKg: 64.8, bodyFatPct: 25.1, waistCm: 76, hipsCm: 99, chestCm: 89, armCm: 28, thighCm: 57 },
  { id: "demo-m-b", measuredAt: "2026-09-06T09:30:00Z", checkInId: "demo-ci-00", weightKg: 64.4 },
  { id: "demo-m-0", measuredAt: "2026-09-13T09:00:00Z", checkInId: null, weightKg: 63.9, waistCm: 75, hipsCm: 98.5 },
  { id: "demo-m-c", measuredAt: "2026-09-20T09:30:00Z", checkInId: "demo-ci-0", weightKg: 63.6 },
  { id: "demo-m-d", measuredAt: "2026-09-27T09:00:00Z", checkInId: null, weightKg: 63.5, bodyFatPct: 24.0, waistCm: 74, hipsCm: 98, chestCm: 88, armCm: 28, thighCm: 56 },
  { id: "demo-m-1", measuredAt: "2026-10-04T10:02:00Z", checkInId: "demo-ci-1", weightKg: 63.1 },
  { id: "demo-m-2", measuredAt: "2026-10-11T08:40:00Z", checkInId: "demo-ci-2", weightKg: 62.9, waistCm: 73.2 },
  { id: "demo-m-3", measuredAt: "2026-10-18T09:12:00Z", checkInId: "demo-ci-3", weightKg: 62.6, bodyFatPct: 23.2, waistCm: 72.5, hipsCm: 97, chestCm: 88, armCm: 28.5, thighCm: 55.5 },
];

/** A plain silhouette as a data URL. `t` from 0 (start) to 1 (latest) narrows the waist a little. */
function silhouette(pose: Pose, t: number): string {
  const waist = 30 - t * 5;
  const hip = 38 - t * 3;
  const side = pose === "side";
  const w = side ? 0.6 : 1;
  const x = (dx: number) => (150 + dx * w).toFixed(1);
  const body = `M${x(-26)} 120 Q${x(-44)} 128 ${x(-40)} 170 L${x(-waist)} 230 Q${x(-hip - 4)} 270 ${x(-hip)} 300 L${x(-24)} 470 L${x(-8)} 470 L${x(-4)} 320 L${x(4)} 320 L${x(8)} 470 L${x(24)} 470 L${x(hip)} 300 Q${x(hip + 4)} 270 ${x(waist)} 230 L${x(40)} 170 Q${x(44)} 128 ${x(26)} 120 Z`;
  const tone = pose === "back" ? "#1D4ED8" : "#2F6BFF";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice"><rect width="300" height="400" fill="#162540"/><rect y="360" width="300" height="40" fill="#111C30"/><circle cx="150" cy="88" r="24" fill="${tone}"/><path d="${body}" fill="${tone}" transform="translate(0 26) scale(1 0.78)"/><text x="12" y="388" font-family="sans-serif" font-size="12" fill="#6F7D96">SAMPLE</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PHOTO_DAYS = ["2026-08-30", "2026-09-13", "2026-09-27", "2026-10-11", "2026-10-25"];
const PHOTOS: ProgressPhoto[] = PHOTO_DAYS.flatMap((day, i) =>
  (["front", "side", "back"] as Pose[]).map((pose) => ({
    id: `demo-ph-${i}-${pose}`, checkInId: null, pose, path: `demo/${day}-${pose}`, takenAt: `${day}T08:30:00Z`, url: silhouette(pose, i / (PHOTO_DAYS.length - 1)),
  })),
);

export const INITIAL_PROGRESS: ProgressState = { checkIns: CHECK_INS, measurements: MEASUREMENTS, photos: PHOTOS, checkInDay: 5 };
