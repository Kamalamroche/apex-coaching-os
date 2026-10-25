import { useEffect, useState } from "react";

type Mode = "system" | "dark" | "light";
const KEY = "apex-theme";
const NEXT: Record<Mode, Mode> = { system: "dark", dark: "light", light: "system" };

function readMode(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : "system";
  } catch {
    return "system";
  }
}

/** Cycles Auto → Dark → Light. Auto follows the OS setting. */
export function ThemeButton() {
  const [mode, setMode] = useState<Mode>(readMode);
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* private mode: theme still applies for this visit */
    }
  }, [mode]);
  const next = NEXT[mode];
  return (
    <button className="iconbtn" onClick={() => setMode(next)} aria-label={`Theme: ${mode}. Switch to ${next}`}>
      {mode === "dark" ? "Dark" : mode === "light" ? "Light" : "Auto"}
    </button>
  );
}
