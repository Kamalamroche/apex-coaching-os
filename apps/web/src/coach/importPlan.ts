import { parseProgramText, type ParsedProgram } from "@apex/core";

/** Reads a dropped PDF into a parsed program. pdf.js loads only now, so the builder stays light. */
export async function readProgramFromPdf(file: File): Promise<ParsedProgram> {
  const { extractPdfText } = await import("../data/pdfText");
  return parseProgramText(await extractPdfText(file));
}
