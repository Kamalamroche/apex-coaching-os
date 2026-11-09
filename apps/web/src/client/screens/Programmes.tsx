import { clientStep, formatPrice, fromTemplate, listingFacts, minutesPerSession, daysPerWeek, programmeTemplate, requestMessage, shopOrder, weekOutline, type ProgrammeListing } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { BackLink, EditorialTitle, Icons, IncludesList, ProgrammeCover, ProgrammeFacts, ProgrammePoster, WeekOutline } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { ProgrammeStatus, posterOf, useProgrammes, useProgrammesApi } from "../../app/ProgrammeParts";
import { useStore } from "../../data/StoreContext";

/** Client: the coach's ready-made programmes. Free ones start at once; paid ones are unlocked by the coach. */
export function Programmes({ say, onTrain }: { say: (m: string) => void; onTrain?: () => void }) {
  const api = useProgrammesApi("client");
  const data = useProgrammes(api);
  const { coachName } = useAppInfo();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = data.listings.find((l) => l.id === openId);
  if (open) return <><BackLink onClick={() => setOpenId(null)}>Programmes</BackLink><ProgrammeDetail l={open} data={data} say={say} onTrain={onTrain} /></>;

  const list = shopOrder(data.listings, data.enrolments);
  const mine = new Map(data.enrolments.filter((e) => e.status !== "declined").map((e) => [e.listingId, e]));
  return (
    <>
      <div>
        <div className="eyebrow">On demand</div>
        <h1 className="h1">Programmes</h1>
        <p className="sub" style={{ margin: "4px 0 0" }}>Ready-made plans from {coachName}. Start any time and train at your own pace.</p>
      </div>
      <ProgrammeStatus data={data} side="client" />
      {data.status === "ready" && list.length === 0 && <div className="card small">No programmes yet. When {coachName} publishes one, it shows up here.</div>}
      <div className="pg-grid">
        {list.map((l, i) => {
          const e = mine.get(l.id);
          const badge = e?.status === "active" ? <span className="gpill caps pg-live">{e.startedAt ? "Yours" : "Unlocked"}</span> : e?.status === "requested" ? <span className="gpill dim caps">Asked</span> : undefined;
          return <ProgrammePoster key={l.id} p={posterOf(l)} badge={badge} i={i} onOpen={() => setOpenId(l.id)} />;
        })}
      </div>
    </>
  );
}

function ProgrammeDetail({ l, data, say, onTrain }: { l: ProgrammeListing; data: ReturnType<typeof useProgrammes>; say: (m: string) => void; onTrain?: () => void }) {
  const api = useProgrammesApi("client");
  const store = useStore();
  const { program } = useApexState(store);
  const { coachName } = useAppInfo();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  const e = data.enrolments.find((x) => x.listingId === l.id);
  const step = clientStep(l, e, program.name);
  const week = weekOutline(l);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try { await fn(); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); }
  };

  const start = () => run(async () => {
    if (!api) return;
    await api.start(l.id);
    if (api.live) await (store as { reload?: () => Promise<void> }).reload?.();
    else store.startProgram(fromTemplate(programmeTemplate(l)));
    setConfirm(false);
    await data.reload();
    say(`You're on ${l.title}. Your first session is in Train`);
  });

  const ask = () => run(async () => {
    if (!api) return;
    await api.request(l.id);
    store.sendMessage("client", requestMessage(l));
    setAsked(true);
    await data.reload();
  });

  const cta = (() => {
    if (confirm) {
      return (
        <div className="pg-sect">
          <p className="pg-tag">This becomes your plan from today{program.days.length ? ` instead of ${program.name}` : ""}. Your sessions so far stay in your history.</p>
          <div className="gr-row">
            <button className="pg-cta glass" onClick={() => setConfirm(false)} disabled={busy}>Not yet</button>
            <button className="pg-cta" onClick={() => void start()} disabled={busy}><Icons.play width={16} height={16} /> {busy ? "Starting…" : "Start now"}</button>
          </div>
        </div>
      );
    }
    switch (step.kind) {
      case "following": return <button className="pg-cta on" onClick={onTrain} disabled={!onTrain}><Icons.check width={16} height={16} /> {step.label}</button>;
      case "restart": return <button className="pg-cta" onClick={() => setConfirm(true)}><Icons.play width={16} height={16} /> {step.label}</button>;
      case "start": return <button className="pg-cta" onClick={() => setConfirm(true)}><Icons.play width={16} height={16} /> {step.label}</button>;
      case "waiting": return <button className="pg-cta glass" disabled><Icons.clock width={16} height={16} /> Waiting for {coachName}</button>;
      case "ask": return <button className="pg-cta" onClick={() => void ask()} disabled={busy}>{busy ? "Sending…" : step.label}</button>;
    }
  })();

  return (
    <>
      <ProgrammeCover p={posterOf(l)} top={e?.status === "active" ? <span className="gpill caps pg-live">{e.startedAt ? "Yours" : "Unlocked"}</span> : undefined}>
        {cta}
      </ProgrammeCover>
      {err && <p className="small" style={{ margin: 0, color: "var(--crit)" }}>{err}</p>}
      {(asked || step.kind === "waiting") && (
        <div className="pg-sent">
          <span className="pg-tick"><Icons.mail width={22} height={22} /></span>
          <EditorialTitle as="h2" text={`Asked ${coachName}`} caption={formatPrice(l.pricePence)} />
          <p>{coachName} has your message and will tell you how to pay. As soon as it's confirmed, the programme unlocks here and you can start.</p>
        </div>
      )}
      {step.kind === "ask" && !asked && (
        <div className="pg-note"><Icons.info width={16} height={16} /><span>Tapping asks {coachName} in your chat. They confirm payment with you, then it unlocks. Nothing is charged in the app.</span></div>
      )}
      <ProgrammeFacts items={[["today", String(l.weeks), l.weeks === 1 ? "week" : "weeks"], ["train", String(daysPerWeek(l.days)), "days a week"], ["clock", String(minutesPerSession(l) || "–"), "min a session"]]} />
      {l.description && <section className="pg-sect"><span className="pg-eyebrow">About it</span><p className="pg-about">{l.description}</p></section>}
      {l.includes.length > 0 && <section className="pg-sect"><span className="pg-eyebrow">What's included</span><IncludesList items={l.includes} /></section>}
      {week.length > 0 && <section className="pg-sect"><span className="pg-eyebrow">A week of it</span><WeekOutline days={week} /></section>}
      <p className="tiny" style={{ margin: 0, textAlign: "center" }}>{listingFacts(l)} · {l.level} · by {coachName}</p>
    </>
  );
}
