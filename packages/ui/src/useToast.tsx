import { useEffect, useState, type ReactElement } from "react";
import { Icons } from "./icons";

/** Returns the toast element to render and a function to show a message for 2.2 s. */
export function useToast(): [ReactElement | null, (message: string) => void] {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return;
    const id = setTimeout(() => setText(null), 2200);
    return () => clearTimeout(id);
  }, [text]);
  return [text ? <div className="toast" role="status"><Icons.check width={15} height={15} strokeWidth={2.5} style={{ verticalAlign: -3, marginRight: 6 }} />{text}</div> : null, setText];
}
