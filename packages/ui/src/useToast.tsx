import { useEffect, useState, type ReactElement } from "react";

/** Returns the toast element to render and a function to show a message for 2.2 s. */
export function useToast(): [ReactElement | null, (message: string) => void] {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return;
    const id = setTimeout(() => setText(null), 2200);
    return () => clearTimeout(id);
  }, [text]);
  return [text ? <div className="toast" role="status">✓ {text}</div> : null, setText];
}
