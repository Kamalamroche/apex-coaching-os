import { isBarcode, type Food } from "@apex/core";
import { Icons, Sheet } from "@apex/ui";
import { useEffect, useRef, useState } from "react";
import { lookupBarcode } from "../../data/barcode";

type Phase = { k: "camera" } | { k: "nocamera"; why: string } | { k: "looking"; code: string } | { k: "missing"; code: string } | { k: "error"; code: string; message: string };

interface DetectorLike { detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]> }
type DetectorCtor = new (o: { formats: string[] }) => DetectorLike;

/**
 * Scan a food's barcode with the phone camera, or type the number. Uses the browser's own barcode reader where there is one
 * (Chrome on Android) and the ZXing reader elsewhere (Safari on iPhone has none), then looks the code up on Open Food Facts.
 */
export function BarcodeScan({ onFound, onQuickAdd, onClose }: { onFound: (f: Food) => void; onQuickAdd: () => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>({ k: "camera" });
  const [typed, setTyped] = useState("");
  const stop = useRef<() => void>(() => {});

  const look = async (code: string) => {
    stop.current();
    setPhase({ k: "looking", code });
    try {
      const f = await lookupBarcode(code);
      if (f) onFound(f);
      else setPhase({ k: "missing", code });
    } catch (e) {
      setPhase({ k: "error", code, message: e instanceof Error ? e.message : "Couldn't look that up." });
    }
  };

  useEffect(() => {
    if (phase.k !== "camera") return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let zx: { stop(): void } | null = null;
    const found = (raw: string) => { if (!cancelled && isBarcode(raw)) { cancelled = true; void look(raw); } };
    stop.current = () => { cancelled = true; clearTimeout(timer); zx?.stop(); stream?.getTracks().forEach((t) => t.stop()); };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setPhase({ k: "nocamera", why: "This browser can't use the camera." });
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        return setPhase({ k: "nocamera", why: "The camera is blocked. Allow it in your browser settings, or type the number below." });
      }
      if (cancelled || !video.current) return stream.getTracks().forEach((t) => t.stop());
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      if (Native) {
        const d = new Native({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        const tick = async () => {
          if (cancelled || !video.current) return;
          try { const r = await d.detect(video.current); if (r[0]) found(r[0].rawValue); } catch { /* frame not ready */ }
          if (!cancelled) timer = setTimeout(tick, 220);
        };
        void tick();
      } else {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !video.current) return;
        const reader = new BrowserMultiFormatReader();
        zx = await reader.decodeFromVideoElement(video.current, (res) => { if (res) found(res.getText()); });
      }
    })();
    return () => stop.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.k]);

  const close = () => { stop.current(); onClose(); };
  const code = typed.replace(/\s+/g, "");
  return (
    <Sheet label="Scan a barcode" onClose={close}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">Scan a barcode</h2><button className="iconbtn" aria-label="Close" onClick={close}><Icons.close width={16} height={16} /></button></div>
        {phase.k === "camera" && (
          <div className="scan-view">
            <video ref={video} playsInline muted />
            <div className="scan-frame" aria-hidden="true"><i /></div>
            <span className="scan-hint tiny">Hold the barcode inside the box</span>
          </div>
        )}
        {phase.k === "nocamera" && <div className="card small">{phase.why}</div>}
        {phase.k === "looking" && <div className="card small scan-status"><span className="scan-dot" />Looking up <b className="num">{phase.code}</b>…</div>}
        {phase.k === "missing" && (
          <div className="card stack" style={{ gap: 8 }}>
            <div className="h3">Not in the food database yet</div>
            <div className="small">Barcode <span className="num">{phase.code}</span> isn't listed, or has no calories. Add it with the numbers from the label.</div>
            <div className="row" style={{ gap: 8 }}><button className="btn sm act" onClick={() => { stop.current(); onQuickAdd(); }}>Quick add</button><button className="btn sm ghost" onClick={() => setPhase({ k: "camera" })}>Scan again</button></div>
          </div>
        )}
        {phase.k === "error" && (
          <div className="card stack" style={{ gap: 8 }}>
            <div className="small" style={{ color: "var(--warn)" }}>{phase.message}</div>
            <div className="row" style={{ gap: 8 }}><button className="btn sm act" onClick={() => void look(phase.code)}>Try again</button><button className="btn sm ghost" onClick={() => setPhase({ k: "camera" })}>Scan again</button></div>
          </div>
        )}
        <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (isBarcode(code)) void look(code); }}>
          <input id="barcode-typed" className="field num" style={{ flex: 1 }} inputMode="numeric" placeholder="Or type the number" maxLength={16} value={typed} onChange={(e) => setTyped(e.target.value)} />
          <button className="btn act" type="submit" disabled={!isBarcode(code)}>Find</button>
        </form>
        {code.length >= 8 && !isBarcode(code) && <div className="tiny" style={{ color: "var(--warn)" }}>That number doesn't look right. Check the digits under the bars.</div>}
        <div className="tiny">Food data from Open Food Facts, a free open database. Values come from the pack.</div>
      </div>
    </Sheet>
  );
}
