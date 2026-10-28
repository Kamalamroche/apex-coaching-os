/* Adapter between the PDF/text program parser and the Builder's import sheet. */

export interface PlanLine {
  /** The line as read from the file. */
  source: string;
  /** Best library match, or null when nothing is close enough. */
  exerciseId: number | null;
  /** 0 to 1: how sure the name match is. */
  confidence: number;
  sets?: number;
  reps?: string;
  kg?: number;
  rpe?: number;
  restSeconds?: number;
}

export interface PlanDay {
  title: string;
  lines: PlanLine[];
}

export async function readPlanFromPdf(_file: File): Promise<PlanDay[]> {
  throw new Error("PDF reading is not wired up yet");
}
