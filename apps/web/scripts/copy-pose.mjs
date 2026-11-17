// Copies the pose reader's WebAssembly files (MediaPipe Tasks Vision, Apache 2.0) into public/pose, so the camera
// rep counter loads everything from APEX's own site. The model itself is committed in public/pose-model.
// Runs before dev and build; public/pose is not committed.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "pose");
mkdirSync(out, { recursive: true });
const wasm = join(dirname(require.resolve("@mediapipe/tasks-vision")), "wasm");
const files = ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"];
for (const f of files) {
  if (!existsSync(join(wasm, f))) throw new Error(`Pose file missing: ${f}`);
  copyFileSync(join(wasm, f), join(out, f));
}
console.log(`Pose files ready in public/pose (${files.length})`);
