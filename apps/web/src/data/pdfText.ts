/* Text out of a PDF, one line per printed line, for parseProgramText. pdf.js is loaded only
   when a coach actually drops a PDF, so it never slows the apps down. It reads text PDFs
   (exports from other coaching apps, Word, Google Docs); a scanned photo of a page has no text. */

interface TextItem { str: string; transform: number[] }

export async function extractPdfText(file: File): Promise<string> {
  const [pdfjs, { default: workerUrl }] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push(linesOf(content.items.flatMap((i) => ("str" in i ? [i as TextItem] : []))));
    }
  } finally {
    void doc.loadingTask.destroy();
  }
  return pages.join("\n");
}

/** Groups text runs that share a baseline into lines, top to bottom, left to right. */
function linesOf(items: TextItem[]): string {
  const rows: { y: number; parts: { x: number; s: string }[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const x = it.transform[4] ?? 0;
    const y = it.transform[5] ?? 0;
    let row = rows.find((r) => Math.abs(r.y - y) < 3);
    if (!row) rows.push((row = { y, parts: [] }));
    row.parts.push({ x, s: it.str });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.s.trim()).join("  "))
    .join("\n");
}
