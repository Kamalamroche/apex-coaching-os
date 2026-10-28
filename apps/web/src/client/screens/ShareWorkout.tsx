import { SHARE_STYLES, shareCaption, type ShareCardData, type ShareStyle } from "@apex/core";
import { DEFAULT_CROWN, SHARE_H, SHARE_W, Sheet, drawShareCard, loadShareFonts, type CrownPlacement } from "@apex/ui";
import { useEffect, useRef, useState, type PointerEvent } from "react";

/** Share card after a workout: the client's photo with a small stats graphic, saved or shared as an image.
    The photo never leaves the phone: it is drawn on a canvas here and only goes where the client shares it. */
export function ShareWorkout({ data, onClose }: { data: ShareCardData; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [style, setStyle] = useState<ShareStyle>(data.reward.xp >= 100 ? "crown" : "strip");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [showCoach, setShowCoach] = useState(true);
  const [crown, setCrown] = useState<CrownPlacement>(DEFAULT_CROWN);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const dragging = useRef(false);
  const site = location.host || "apex-coaching-os-web.vercel.app";
  const card = { ...data, coach: showCoach ? data.coach : null };

  useEffect(() => { void loadShareFonts().then(() => setReady(true)); }, []);
  useEffect(() => {
    if (canvas.current) drawShareCard(canvas.current, { style, data: { ...data, coach: showCoach ? data.coach : null }, photo, crown, site });
  }, [style, data, showCoach, photo, crown, ready, site]);

  const pick = (file: File | undefined) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => setPhoto(img);
    img.src = URL.createObjectURL(file);
  };

  // Drag the crown onto the head in the crown style.
  const moveCrown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (style !== "crown" || !dragging.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    // The finger marks where the crown sits on the head, so its centre goes a little above.
    setCrown((c) => ({ ...c, x: ((e.clientX - r.left) / r.width) * SHARE_W, y: ((e.clientY - r.top) / r.height) * SHARE_H - c.size * 0.3 }));
  };

  const blob = () => new Promise<Blob | null>((res) => canvas.current?.toBlob(res, "image/png"));
  const caption = shareCaption(card, `https://${site}`);

  const share = async () => {
    const b = await blob();
    if (!b) return;
    const file = new File([b], "apex-workout.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: caption });
        setStatus("Shared. Nice work.");
      } catch { /* closed the share sheet */ }
      return;
    }
    save(b);
  };

  const save = async (given?: Blob | null) => {
    const b = given ?? (await blob());
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "apex-workout.png";
    a.click();
    try { await navigator.clipboard.writeText(caption); setStatus("Image saved and caption copied. Post it anywhere."); }
    catch { setStatus("Image saved. Post it anywhere."); }
  };

  return (
    <Sheet onClose={onClose} label="Share your workout">
      <div className="sect"><h3 className="h3">Share your workout</h3><button className="btn ghost sm" onClick={onClose}>Close</button></div>
      <div className="chips" role="tablist" aria-label="Card style" style={{ flex: "none" }}>
        {SHARE_STYLES.map((s) => <button key={s.id} role="tab" aria-selected={style === s.id} className={`chip${style === s.id ? " on" : ""}`} onClick={() => setStyle(s.id)}>{s.name}</button>)}
      </div>
      <canvas
        ref={canvas}
        aria-label="Share card preview"
        style={{ height: "min(52vh, 520px)", aspectRatio: "9 / 16", flex: "none", alignSelf: "center", borderRadius: 12, border: "1px solid var(--line)", touchAction: style === "crown" ? "none" : "auto", cursor: style === "crown" ? "grab" : "default" }}
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); moveCrown(e); }}
        onPointerMove={moveCrown}
        onPointerUp={() => { dragging.current = false; }}
      />
      {style === "crown" && (
        <label className="tiny" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          Crown size
          <input type="range" min={90} max={320} value={crown.size} onChange={(e) => setCrown((c) => ({ ...c, size: Number(e.target.value) }))} style={{ flex: 1, accentColor: "var(--act)" }} />
        </label>
      )}
      {style === "crown" && <div className="tiny" style={{ textAlign: "center", marginTop: -8 }}>Tap or drag on the picture to put the crown on your head.</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <label className="btn ghost" style={{ flex: 1, cursor: "pointer" }}>
          {photo ? "Change photo" : "Add a photo"}
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {data.coach && <button className="btn ghost" style={{ flex: 1 }} aria-pressed={showCoach} onClick={() => setShowCoach((v) => !v)}>{showCoach ? `Hide ${data.coach}` : `Show ${data.coach}`}</button>}
      </div>
      <button className="btn act block" style={{ minHeight: 52 }} onClick={() => void share()}>Share</button>
      <button className="btn ghost block" onClick={() => void save()}>Save image</button>
      <div className="tiny" style={{ textAlign: "center" }}>{status || "Your photo stays on your phone unless you share it."}</div>
    </Sheet>
  );
}
