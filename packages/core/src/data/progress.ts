import type { CheckIn, Measurement, ProgressState } from "../checkins";

/* Priya's last three weekly check-ins (due Saturdays) for the demo. No photos: the demo shows empty frames until you add some. */
const base = { stress: 2, hunger: 3, wins: "", struggles: "", note: "", coachReply: null, reviewedAt: null };

const CHECK_INS: CheckIn[] = [
  { ...base, id: "demo-ci-3", submittedAt: "2026-10-18T09:12:00Z", weightKg: 62.6, sleepHours: 7, energy: 4, mood: 4, training: 4, nutrition: 4, wins: "Hit every session", struggles: "Hip a little tight after RDLs", coachReply: "Nice week. Let's add a hip warm-up before Lower A.", reviewedAt: "2026-10-18T12:40:00Z" },
  { ...base, id: "demo-ci-2", submittedAt: "2026-10-11T08:40:00Z", weightKg: 62.9, sleepHours: 6, energy: 3, mood: 3, stress: 4, training: 3, nutrition: 3, struggles: "Busy week at work", coachReply: "Busy weeks happen. Two good sessions still counts.", reviewedAt: "2026-10-11T18:05:00Z" },
  { ...base, id: "demo-ci-1", submittedAt: "2026-10-04T10:02:00Z", weightKg: 63.1, sleepHours: 7.5, energy: 4, mood: 5, training: 5, nutrition: 4, wins: "Loving the new program", coachReply: "Great start, Priya.", reviewedAt: "2026-10-04T16:30:00Z" },
];

const MEASUREMENTS: Measurement[] = [
  { id: "demo-m-0", measuredAt: "2026-09-27T09:00:00Z", checkInId: null, weightKg: 63.5, bodyFatPct: 24.0, waistCm: 74, hipsCm: 98, chestCm: 88, armCm: 28, thighCm: 56 },
  { id: "demo-m-1", measuredAt: "2026-10-04T10:02:00Z", checkInId: "demo-ci-1", weightKg: 63.1 },
  { id: "demo-m-2", measuredAt: "2026-10-11T08:40:00Z", checkInId: "demo-ci-2", weightKg: 62.9 },
  { id: "demo-m-3", measuredAt: "2026-10-18T09:12:00Z", checkInId: "demo-ci-3", weightKg: 62.6, bodyFatPct: 23.2, waistCm: 72.5, hipsCm: 97, chestCm: 88, armCm: 28.5, thighCm: 55.5 },
];

export const INITIAL_PROGRESS: ProgressState = { checkIns: CHECK_INS, measurements: MEASUREMENTS, photos: [], checkInDay: 5 };
