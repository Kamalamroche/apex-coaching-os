import type { Client } from "../types";

export const CLIENTS: Client[] = [
  { id: 1, name: "Sarah Mitchell", initials: "SM", plan: "Hypertrophy B2", goal: "Muscle gain", mode: "Online", adherence: 42, streak: 2, lastSeen: "4 days ago", monthlyRevenue: 150, weightKg: 68.2, bodyFatPct: 24.1, risk: "high" },
  { id: 2, name: "James Kowalski", initials: "JK", plan: "Strength Block", goal: "Strength", mode: "Hybrid", adherence: 78, streak: 11, lastSeen: "Yesterday", monthlyRevenue: 220, weightKg: 86.4, bodyFatPct: 17.8, risk: "medium" },
  { id: 3, name: "Lena Rossi", initials: "LR", plan: "Fat Loss 8wk", goal: "Fat loss", mode: "Online", adherence: 65, streak: 6, lastSeen: "2 days ago", monthlyRevenue: 150, weightKg: 71.0, bodyFatPct: 26.3, risk: "medium" },
  { id: 4, name: "Omar Tahir", initials: "OT", plan: "Powerlifting", goal: "Powerlifting", mode: "In person", adherence: 94, streak: 28, lastSeen: "Today", monthlyRevenue: 320, weightKg: 84.7, bodyFatPct: 15.2, risk: "low" },
  { id: 5, name: "Priya Sharma", initials: "PS", plan: "Foundations", goal: "General fitness", mode: "Online", adherence: 88, streak: 19, lastSeen: "Today", monthlyRevenue: 120, weightKg: 62.5, bodyFatPct: 23.0, risk: "low" },
  { id: 6, name: "Marcus Webb", initials: "MW", plan: "Athletic Perf.", goal: "Performance", mode: "Hybrid", adherence: 71, streak: 8, lastSeen: "Yesterday", monthlyRevenue: 260, weightKg: 80.3, bodyFatPct: 13.9, risk: "medium" },
];

/** The demo client whose program both apps share. */
export const DEMO_CLIENT_ID = 5;
