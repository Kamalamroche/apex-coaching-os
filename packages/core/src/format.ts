/** 150 → "2:30", 45 → "45s". */
export const formatRest = (seconds: number): string =>
  seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : `${seconds}s`;

export const firstName = (fullName: string): string => fullName.split(" ")[0] ?? fullName;

export const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(n, max));
