/* Text out of a PDF, one line per printed line, for parseProgramText. pdf.js is loaded only
   when a coach actually drops a PDF, so it never slows the apps down. It reads text PDFs
   (exports from other coaching apps, Word, Google Docs) directly. A scanned page or a photo has no
   text, so those pages are read with OCR (tesseract.js, in the browser, free): it loads only when a
   scan turns up. Its files are served from APEX's own /ocr/ (copied there at build by scripts/copy-ocr.mjs),
   so nothing goes to a third party; the English data (about 3 MB) is kept by the browser after the first time. */

interface TextItem { str: string; transform: number[] }

/** "Reading scanned page 2 of 5", for the screen while OCR runs. */
export type ReadProgress = (note: string) => void;

/** Pages with fewer letters than this are treated as a scan. */
const SCAN_LETTERS = 20;
/** OCR is slow on a phone; a programme is rarely longer than this. */
const OCR_MAX_PAGES = 20;

export async function extractPdfText(file: File, progress?: ReadProgress): Promise<string> {
  const [pdfjs, { default: workerUrl }] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  let ocr: Ocr | null = null;
  try {
    const scanned: number[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = linesOf(content.items.flatMap((i) => ("str" in i ? [i as TextItem] : [])));
      pages.push(text);
      if ((text.match(/[a-z]/gi) ?? []).length < SCAN_LETTERS) scanned.push(n);
    }
    const toRead = scanned.slice(0, OCR_MAX_PAGES);
    for (const [i, n] of toRead.entries()) {
      progress?.(`Reading scanned page ${i + 1} of ${toRead.length}…`);
      ocr ??= await startOcr(progress);
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      pages[n - 1] = await ocr.read(canvas);
    }
  } finally {
    void doc.loadingTask.destroy();
    await ocr?.stop();
  }
  return pages.join("\n");
}

/** A photo or screenshot of a programme (JPG, PNG, HEIC where the browser can show it). */
export async function extractImageText(file: File, progress?: ReadProgress): Promise<string> {
  progress?.("Reading the photo…");
  const ocr = await startOcr(progress);
  try {
    return await ocr.read(file);
  } finally {
    await ocr.stop();
  }
}

interface Ocr { read(image: HTMLCanvasElement | File): Promise<string>; stop(): Promise<void> }

async function startOcr(progress?: ReadProgress): Promise<Ocr> {
  progress?.("Getting the text reader ready (first time only takes a few seconds)…");
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { workerPath: "/ocr/worker.min.js", corePath: "/ocr", langPath: "/ocr", workerBlobURL: false });
  return {
    async read(image) {
      const { data } = await worker.recognize(image);
      return data.text;
    },
    async stop() { await worker.terminate(); },
  };
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
