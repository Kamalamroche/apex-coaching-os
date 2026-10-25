import "@apex/ui/styles.css";
import { StrictMode, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

export function mount(app: ReactElement) {
  const el = document.getElementById("root");
  if (!el) throw new Error("#root missing");
  createRoot(el).render(<StrictMode>{app}</StrictMode>);
}
