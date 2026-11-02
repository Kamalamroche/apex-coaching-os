import type { FormCheck } from "@apex/core";
import { Icons } from "@apex/ui";

/** A form check video, or a quiet placeholder when it can't be played (demo after a reload, or an expired link). */
export function FormVideo({ check }: { check: Pick<FormCheck, "url" | "exercise"> }) {
  if (!check.url) {
    return <div className="video" style={{ aspectRatio: "16/9" }}><Icons.camera width={28} height={28} /><span className="tiny" style={{ position: "absolute", bottom: 10 }}>Video not available here</span></div>;
  }
  return <video className="fc-video" src={check.url} controls playsInline preload="metadata" aria-label={`Form check: ${check.exercise}`} />;
}
