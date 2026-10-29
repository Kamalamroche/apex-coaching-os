import { WEARABLE_ORDER, WEARABLES, type WearableProvider } from "@apex/core";
import { Label } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { useActivities, useActivityContext } from "../../data/ActivityContext";

/* What can feed APEX today and what is on the way. Plain text badges, no other company's logos. */
const BADGE: Record<WearableProvider, string> = { garmin: "GA", whoop: "WH", oura: "OU", fitbit: "FB", polar: "PO" };
const LATER: { badge: string; name: string; what: string; status: string }[] = [
  { badge: "AH", name: "Apple Health and Apple Watch", what: "Needs the APEX iPhone app. Until then, let your Watch sync to Strava and connect Strava here.", status: "Needs phone app" },
  { badge: "HC", name: "Android Health Connect", what: "Needs the APEX Android app.", status: "Needs phone app" },
];

export function ConnectedApps({ say }: { say: (m: string) => void }) {
  const { strava, wearables } = useActivityContext();
  const { connections, status } = useActivities();
  const { coachName } = useAppInfo();
  const [busy, setBusy] = useState<"sync" | "off" | null>(null);
  const [wBusy, setWBusy] = useState<string | null>(null);
  const [wError, setWError] = useState<Partial<Record<WearableProvider, string>>>({});
  const runW = async (p: WearableProvider, kind: "sync" | "off") => {
    if (!wearables) return;
    setWBusy(`${p}:${kind}`);
    setWError((e) => ({ ...e, [p]: undefined }));
    try {
      if (kind === "sync") {
        const n = await wearables.sync(p);
        say(n ? `${n} nights from ${WEARABLES[p].name}` : `Up to date with ${WEARABLES[p].name}`);
      } else {
        await wearables.disconnect(p);
        say(`${WEARABLES[p].name} disconnected`);
      }
    } catch (e) {
      setWError((x) => ({ ...x, [p]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setWBusy(null);
    }
  };
  const [error, setError] = useState<string | null>(null);
  const strv = connections.find((c) => c.provider === "strava");

  const run = async (kind: "sync" | "off") => {
    if (!strava) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === "sync") {
        const n = await strava.sync();
        say(n ? `${n} activit${n === 1 ? "y" : "ies"} from Strava` : "Up to date with Strava");
      } else {
        await strava.disconnect();
        say("Strava disconnected");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div><div className="eyebrow">Settings</div><h1 className="h1">Connected apps</h1></div>
      <p className="small" style={{ margin: 0 }}>What you connect shows up in Cardio, and {coachName} sees it on your profile. APEX only reads; it never posts or changes anything in your other apps.</p>
      <section>
        <div className="sect"><h2 className="h2">Works now</h2></div>
        <div className="card flat list">
          <div className="cx-app">
            <div className="cx-app-badge" style={{ color: "var(--act)" }}>ST</div>
            <div className="grow">
              <div className="h3">Strava</div>
              <div className="small">{strv ? `Connected${strv.athleteName ? ` as ${strv.athleteName}` : ""}${strv.lastSyncAt ? ` · last sync ${new Date(strv.lastSyncAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}` : "Runs, rides, swims and more, with routes and heart rate. Your watch can sync to Strava first."}</div>
              {error && <div className="small" style={{ color: "var(--crit)", marginTop: 4 }}>{error}</div>}
              {status === "needs-update" && <div className="small" style={{ color: "var(--warn)", marginTop: 4 }}>Waiting on a database update from {coachName}.</div>}
            </div>
            {strv ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button className="btn sm act" disabled={!!busy} onClick={() => void run("sync")}>{busy === "sync" ? "Syncing…" : "Sync now"}</button>
                <button className="btn sm ghost" disabled={!!busy} onClick={() => void run("off")}>{busy === "off" ? "…" : "Disconnect"}</button>
              </div>
            ) : strava?.available ? (
              <button className="btn sm act" disabled={status === "needs-update"} onClick={() => strava.connect()}>Connect</button>
            ) : (
              <span className="label l-insight">Soon</span>
            )}
          </div>
          <div className="cx-app">
            <div className="cx-app-badge" style={{ color: "var(--data)" }}>FIT</div>
            <div className="grow">
              <div className="h3">Upload from any watch</div>
              <div className="small">GPX, TCX or FIT files from Garmin, Coros, Polar, Suunto, Wahoo, Zwift or Strava. Use Upload file on the Cardio screen.</div>
            </div>
            <Label kind="data">Ready</Label>
          </div>
        </div>
      </section>
      <section>
        <div className="sect"><h2 className="h2">Watches and rings</h2><span className="tiny">Sleep, HRV, recovery</span></div>
        <div className="card flat list">
          {WEARABLE_ORDER.map((p) => {
            const w = WEARABLES[p];
            const c = connections.find((x) => x.provider === p);
            const can = wearables?.available(p) ?? false;
            return (
              <div key={p} className="cx-app">
                <div className="cx-app-badge" style={c ? { color: "var(--good)" } : undefined}>{BADGE[p]}</div>
                <div className="grow">
                  <div className="h3">{w.name}</div>
                  <div className="small">{c ? `Connected${c.athleteName ? ` as ${c.athleteName}` : ""}${c.lastSyncAt ? ` · last sync ${new Date(c.lastSyncAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}` : w.brings}</div>
                  {wError[p] && <div className="small" style={{ color: "var(--crit)", marginTop: 4 }}>{wError[p]}</div>}
                </div>
                {c ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button className="btn sm act" disabled={!!wBusy} onClick={() => void runW(p, "sync")}>{wBusy === `${p}:sync` ? "Syncing…" : "Sync now"}</button>
                    <button className="btn sm ghost" disabled={!!wBusy} onClick={() => void runW(p, "off")}>{wBusy === `${p}:off` ? "…" : "Disconnect"}</button>
                  </div>
                ) : can ? (
                  <button className="btn sm act" disabled={status === "needs-update"} onClick={() => wearables?.connect(p)}>Connect</button>
                ) : (
                  <span className="tiny" style={{ textAlign: "right", maxWidth: 80 }}>{w.needsApproval ? "Waiting on Garmin" : "Coming soon"}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <div className="sect"><h2 className="h2">Needs the APEX phone app</h2></div>
        <div className="card flat list">
          {LATER.map((x) => (
            <div key={x.name} className="cx-app">
              <div className="cx-app-badge">{x.badge}</div>
              <div className="grow"><div className="h3">{x.name}</div><div className="small">{x.what}</div></div>
              <span className="tiny" style={{ textAlign: "right", maxWidth: 80 }}>{x.status}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
