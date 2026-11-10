import { parseProgramText, type ParsedProgram } from "@apex/core";
import type { ReadProgress } from "../data/pdfText";

/** Reads a dropped PDF, or a photo of a programme, into a parsed program. pdf.js and the OCR reader load
    only now, so the builder stays light. */
export async function readProgramFromPdf(file: File, progress?: ReadProgress): Promise<ParsedProgram> {
  const { extractImageText, extractPdfText } = await import("../data/pdfText");
  const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(file.name);
  return parseProgramText(await (isImage ? extractImageText(file, progress) : extractPdfText(file, progress)));
}
