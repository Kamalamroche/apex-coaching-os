// Copies the OCR reader's files (tesseract.js worker, its WebAssembly core and the English data) into
// public/ocr, so scanned PDFs are read from APEX's own site rather than a third-party CDN.
// Runs before dev and build; public/ocr is not committed.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "ocr");
mkdirSync(out, { recursive: true });
const dirOf = (pkg) => dirname(require.resolve(`${pkg}/package.json`));
const files = [
  [join(dirOf("tesseract.js"), "dist", "worker.min.js"), "worker.min.js"],
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"].map((f) => [join(dirOf("tesseract.js-core"), f), f]),
  [join(dirOf("@tesseract.js-data/eng"), "4.0.0_best_int", "eng.traineddata.gz"), "eng.traineddata.gz"],
];
for (const [from, name] of files) {
  if (!existsSync(from)) throw new Error(`OCR file missing: ${from}`);
  copyFileSync(from, join(out, name));
}
console.log(`OCR files ready in public/ocr (${files.length})`);
