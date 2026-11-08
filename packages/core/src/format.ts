/** 150 → "2:30", 45 → "45s". */
export const formatRest = (seconds: number): string =>
  seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : `${seconds}s`;

export const firstName = (fullName: string): string => fullName.split(" ")[0] ?? fullName;

export const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(n, max));

/** "Priya Sharma" → "PS". */
export const initials = (name: string): string => name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
