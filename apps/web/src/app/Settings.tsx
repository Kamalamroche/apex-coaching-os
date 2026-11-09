import { IMPERIAL, LANGS, METRIC, type UnitPrefs } from "@apex/core";
import { Icons, setPrefs, usePrefs, useT, useUnits } from "@apex/ui";
import { useAppInfo } from "./AppContext";

type Choice<K extends keyof UnitPrefs> = { key: K; label: string; options: [UnitPrefs[K], string][] };

const ROWS: [Choice<"weight">, Choice<"length">, Choice<"distance">] = [
  { key: "weight", label: "Weight", options: [["kg", "Kilograms (kg)"], ["lb", "Pounds (lb)"]] },
  { key: "length", label: "Body measurements", options: [["cm", "Centimetres (cm)"], ["in", "Feet and inches"]] },
  { key: "distance", label: "Distance", options: [["km", "Kilometres (km)"], ["mi", "Miles (mi)"]] },
];

const same = (a: UnitPrefs, b: UnitPrefs) => a.weight === b.weight && a.length === b.length && a.distance === b.distance;

/** Units (kg/lb, cm/ft-in, km/mi) and language, for coaches and clients alike. */
export function UnitsAndLanguage({ heading = true }: { heading?: boolean }) {
  const { units, lang } = usePrefs();
  const u = useUnits();
  const t = useT();
  const { mode } = useAppInfo();
  const setUnits = (next: Partial<UnitPrefs>) => setPrefs({ units: { ...units, ...next } });
  return (
    <>
      {heading && <div className="full"><div className="eyebrow">{t("Settings")}</div><h1 className="h1">{t("Units and language")}</h1></div>}

      <section className="card stack full" style={{ gap: 14 }}>
        <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">{t("Units")}</h3><span className="tiny">{t(mode === "live" ? "Saved to your account" : "Saved on this device")}</span></div>
        <div className="seg" role="radiogroup" aria-label={t("Units")}>
          {([[METRIC, "Metric"], [IMPERIAL, "US / imperial"]] as const).map(([p, label]) => (
            <button key={label} type="button" role="radio" aria-checked={same(units, p)} className={same(units, p) ? "on" : ""} onClick={() => setPrefs({ units: p })}>{t(label)}</button>
          ))}
        </div>
        {ROWS.map((r) => (
          <div key={r.key} className="stack" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 700, color: "var(--text)" }}>{t(r.label)}</span>
            <div className="seg" role="radiogroup" aria-label={t(r.label)}>
              {r.options.map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={units[r.key] === v} className={units[r.key] === v ? "on" : ""} onClick={() => setUnits({ [r.key]: v })}>{t(label)}</button>
              ))}
            </div>
          </div>
        ))}
        <div className="small">{t("Example: {weight} · {height} · {distance}", { weight: u.fw(100), height: u.height(180), distance: u.dist(5000, "run") })}</div>
        <div className="tiny">{t("Everything is stored in kg and cm, so you can switch any time without losing anything.")}</div>
      </section>

      <section className="card stack full" style={{ gap: 10 }}>
        <h3 className="h3">{t("Language")}</h3>
        <div className="card flat list" role="radiogroup" aria-label={t("Language")}>
          {LANGS.map((l) => (
            <button key={l.id} className="li" role="radio" aria-checked={lang === l.id} lang={l.id} onClick={() => setPrefs({ lang: l.id })}>
              <div className="grow"><div className="h3">{l.name}</div>{l.name !== l.english && <div className="small">{l.english}</div>}</div>
              {lang === l.id && <Icons.check width={18} height={18} style={{ color: "var(--act)", flex: "none" }} />}
            </button>
          ))}
        </div>
        {lang !== "en" && <div className="tiny">{t("More of the app is being translated. Anything not yet translated shows in English.")}</div>}
      </section>
    </>
  );
}
