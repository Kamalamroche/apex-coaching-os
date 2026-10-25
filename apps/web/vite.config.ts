import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/* One origin, three pages: launcher (/), coach (/coach/) and client (/client/).
   Each page has its own bundle. Serving them from one origin lets the demo store
   sync coach and client tabs through localStorage until Supabase Realtime replaces it. */
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        launcher: resolve(import.meta.dirname, "index.html"),
        coach: resolve(import.meta.dirname, "coach/index.html"),
        client: resolve(import.meta.dirname, "client/index.html"),
      },
    },
  },
});
