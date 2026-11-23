import { STORY_QUOTE_MAX, askStoryText, type Story } from "@apex/core";
import { Icons, SuccessStoryCard } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { isDemo, supabase } from "../../data/supabase";
import { demoClientStories, liveClientStories, type ClientStoriesApi } from "../../data/stories";

/** Today: the coach asked to share this client's progress. The client sees exactly what would be shown, and says yes or no. */
export function StoryAsk({ say }: { say?: (m: string) => void }) {
  const { coachName, clientName } = useAppInfo();
  const [api, setApi] = useState<ClientStoriesApi | null>(null);
  const [list, setList] = useState<Story[]>([]);
  useEffect(() => {
    if (isDemo() || !supabase) { setApi(demoClientStories()); return; }
    const db = supabase;
    void db.auth.getUser().then(({ data }) => { if (data.user) setApi(liveClientStories(db, data.user.id)); });
  }, []);
  const reload = useCallback(async () => { if (api) setList(await api.waiting()); }, [api]);
  useEffect(() => { void reload(); }, [reload]);
  const s = list[0];
  if (!api || !s) return null;
  return <AskCard key={s.id} story={s} coach={coachName} me={clientName} api={api} say={say} onDone={reload} />;
}

function AskCard({ story: s, coach, me, api, say, onDone }: { story: Story; coach: string; me: string; api: ClientStoriesApi; say?: (m: string) => void; onDone: () => Promise<void> }) {
  const [quote, setQuote] = useState("");
  const [showName, setShowName] = useState(false);
  const [busy, setBusy] = useState(false);
  const parts = me.trim().split(/\s+/);
  const short = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]![0]}.` : parts[0] ?? "";
  const answer = async (yes: boolean) => {
    setBusy(true);
    try { await api.answer(s.id, yes, quote, showName); say?.(yes ? `Thanks · ${coach} can share your story` : `No problem · ${coach} will see you said no`); await onDone(); }
    catch (e) { say?.(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  return (
    <section className="card stack" style={{ gap: 12, borderColor: "color-mix(in srgb,var(--act) 40%,var(--line))" }} aria-label="Share your progress?">
      <div className="row" style={{ gap: 10, alignItems: "center" }}>
        <Icons.star width={18} height={18} style={{ color: "var(--act)", flex: "none" }} />
        <h2 className="h3" style={{ margin: 0 }}>Share your progress?</h2>
      </div>
      <p className="small" style={{ margin: 0 }}>{askStoryText(coach)}</p>
      <SuccessStoryCard headline={s.headline} numbers={s.numbers} shown={s.shown} quote={quote} name={showName ? short : null} />
      <label className="stack" style={{ gap: 6 }}>
        <span className="tiny">A few words in your own voice (optional)</span>
        <textarea className="field" rows={2} maxLength={STORY_QUOTE_MAX} placeholder="What changed for you?" value={quote} onChange={(e) => setQuote(e.target.value)} />
      </label>
      <label className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <input type="checkbox" role="switch" checked={showName} onChange={(e) => setShowName(e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
        <span className="grow"><b className="small" style={{ color: "var(--text)" }}>Show my name as {short}</b><br /><span className="tiny">Off: it says "a client" instead.</span></span>
      </label>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost" disabled={busy} onClick={() => void answer(false)}>No thanks</button>
        <button className="btn act grow" disabled={busy} onClick={() => void answer(true)}><Icons.check width={16} height={16} /> Yes, share it</button>
      </div>
      <p className="tiny" style={{ margin: 0 }}>Changed your mind later? Ask {coach} and they'll take it down.</p>
    </section>
  );
}
