import { CLIENT_FEATURES, featureOn, featuresSummary, toggleFeature, type ClientFeature } from "@apex/core";
import { useEffect, useState } from "react";
import type { FeaturesApi } from "../../data/features";

/** Coach: which parts of the app this client sees. Training, check-ins, messages and what the coach sends always stay. */
export function FeatureSwitches({ api, clientId, clientName, say }: { api: FeaturesApi; clientId: string; clientName: string; say: (m: string) => void }) {
  const first = clientName.split(" ")[0] ?? clientName;
  const [hidden, setHidden] = useState<ClientFeature[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setHidden(null);
    api.load(clientId).then((h) => live && setHidden(h)).catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => { live = false; };
  }, [api, clientId]);

  const flip = async (key: ClientFeature) => {
    if (!hidden) return;
    const before = hidden;
    const next = toggleFeature(hidden, key);
    setHidden(next);
    try {
      await api.save(clientId, next);
      const f = CLIENT_FEATURES.find((x) => x.key === key)!;
      say(`${f.label} ${featureOn(next, key) ? "back on" : "hidden"} for ${first}`);
    } catch (e) {
      setHidden(before);
      say(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="card fs-card" aria-label={`What ${first} sees`}>
      <div className="sect" style={{ marginBottom: 4 }}>
        <h3 className="h3">What {first} sees in the app</h3>
        {hidden && <span className="tiny">{featuresSummary(hidden)}</span>}
      </div>
      <p className="small" style={{ margin: "0 0 8px" }}>
        Turn off anything {first} doesn't need. Training, check-ins, messages and what you send them always stay.
      </p>
      {error ? <div className="small">{error}</div> : !hidden ? <div className="small">Loading…</div> : (
        <div className="fs-list">
          {CLIENT_FEATURES.map((f) => {
            const on = featureOn(hidden, f.key);
            return (
              <label key={f.key} className={`fs-row${on ? "" : " off"}`}>
                <span className="grow"><span className="h3">{f.label}</span><span className="tiny">{f.note}</span></span>
                <input type="checkbox" role="switch" aria-label={`${f.label} for ${first}`} checked={on} onChange={() => void flip(f.key)} />
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}
