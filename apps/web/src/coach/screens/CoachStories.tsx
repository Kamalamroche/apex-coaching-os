import {
  HERO_IMAGES, STORY_HEADLINE_MAX, STORY_STATUS_LABEL, availableKeys, headlineIdeas, pageLink, storyLines, storyPhoto, storyProblem, successCaption,
  type CoachPage, type Story, type StoryKey, type StoryNumbers,
} from "@apex/core";
import { Icons, Label, Sheet, SuccessStoryCard, drawMarketingCard, loadStoryFonts, type MarketingCardTheme } from "@apex/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadPhoto, shareCards } from "../../app/shareImage";
import { useAppInfo } from "../../app/AppContext";
import { isDemo, supabase } from "../../data/supabase";
import { demoStories, liveStories, type StarterChoice, type StoriesApi } from "../../data/stories";
import { copyText } from "./CoachLeads";

const KEY_LABEL: Record<StoryKey, string> = { lift: "Best lift gain", bests: "Personal bests", workouts: "Workouts done", weeks: "Weeks together", weight: "Body weight change" };

/** Coach: real client success stories (the client approves first), and the free starter plan on the page. */
export function CoachStories({ page, names, say }: { page: CoachPage; names: Record<string, string>; say: (m: string) => void }) {
  const [api, setApi] = useState<StoriesApi | null>(null);
  const [stories, setStories] = useState<Story[] | null>(null);
  const [starter, setStarter] = useState<{ picked: string | null; choices: StarterChoice[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [posting, setPosting] = useState<Story | null>(null);

  useEffect(() => {
    if (isDemo() || !supabase) { setApi(demoStories(names)); return; }
    const db = supabase;
    void db.auth.getUser().then(({ data }) => { if (data.user) setApi(liveStories(db, data.user.id)); });
  }, [names]);
  const reload = useCallback(async () => {
    if (!api) return;
    try {
      const [s, st] = await Promise.all([api.stories(), api.starter()]);
      setStories(s); setStarter(st); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);

  if (error) return <div className="card small" role="alert">{error}</div>;
  if (!api || !stories || !starter) return <div className="card small">Loading…</div>;

  const link = pageLink(location.origin, page.slug);
  const pickStarter = async (id: string | null) => {
    try { await api.setStarter(id); say(id ? "Free starter plan is on your page" : "Starter plan taken off your page"); await reload(); }
    catch (e) { say(e instanceof Error ? e.message : String(e)); }
  };
  const remove = async (s: Story) => {
    try { await api.remove(s.id); say(s.status === "approved" ? "Taken off your page" : "Removed"); await reload(); }
    catch (e) { say(e instanceof Error ? e.message : String(e)); }
  };
  const approved = stories.filter((s) => s.status === "approved");
  const others = stories.filter((s) => s.status !== "approved");

  return (
    <>
      <section className="card stack" style={{ gap: 12 }}>
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Success stories</h2><button className="btn act sm" onClick={() => setAsking(true)}><Icons.plus width={14} height={14} /> Ask a client</button></div>
        <p className="small" style={{ margin: 0 }}>Real numbers from a client's training, worked out by APEX, never typed in. The client sees exactly what would be shared and says yes or no. Approved stories show on your page.</p>
        {!page.published && <p className="tiny" style={{ margin: 0, color: "var(--warn)" }}>Your page is a draft, so nobody sees stories yet.</p>}
      </section>

      {approved.length > 0 && (
        <>
          <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">On your page</h2><span className="tiny num">{approved.length}{approved.length > 6 ? " · newest 6 show" : ""}</span></div>
          <div className="stack" style={{ gap: 10 }}>
            {approved.map((s, i) => (
              <SuccessStoryCard key={s.id} i={i} headline={s.headline} numbers={s.numbers} shown={s.shown} quote={s.quote} name={s.showName ? s.clientName : null}
                note={s.showName ? undefined : <span className="tiny">{s.clientName} · name hidden on your page</span>}>
                <button className="btn act sm" onClick={() => setPosting(s)}><Icons.share width={14} height={14} /> Make a post</button>
                <button className="btn ghost sm" onClick={() => void remove(s)}>Take down</button>
              </SuccessStoryCard>
            ))}
          </div>
        </>
      )}
      {others.length > 0 && (
        <div className="card flat list">
          {others.map((s) => (
            <div key={s.id} className="li">
              <Icons.clock width={18} height={18} style={{ color: s.status === "asked" ? "var(--warn)" : "var(--text3)", flex: "none" }} />
              <div className="grow"><div className="h3">{s.clientName}</div><div className="tiny">{s.headline} · {STORY_STATUS_LABEL[s.status]}</div></div>
              <button className="btn ghost sm" onClick={() => void remove(s)}>{s.status === "asked" ? "Cancel" : "Remove"}</button>
            </div>
          ))}
        </div>
      )}
      {stories.length === 0 && <div className="card small">No stories yet. Pick a client who's doing well and ask them. One real result does more than any advert.</div>}

      <section className="card stack" style={{ gap: 12 }}>
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Free starter plan</h2><Label kind="dec">Coach decision</Label></div>
        <p className="small" style={{ margin: 0 }}>Offer one of your free programmes on your page. People leave their name and email, land in Leads with a follow-up for day 7, and you invite them. You still decide who joins.</p>
        {starter.choices.length === 0 ? (
          <p className="tiny" style={{ margin: 0 }}>You have no free live programme yet. Make one in Business → Programmes (price £0, status Live), then pick it here.</p>
        ) : (
          <div className="gr-chips" role="radiogroup" aria-label="Free starter plan">
            <button type="button" className="gr-chip" role="radio" aria-checked={!starter.picked} aria-pressed={!starter.picked} onClick={() => void pickStarter(null)}>None</button>
            {starter.choices.map((c) => (
              <button key={c.id} type="button" className="gr-chip" role="radio" aria-checked={starter.picked === c.id} aria-pressed={starter.picked === c.id} onClick={() => void pickStarter(c.id)}>{c.title} · {c.weeks} wk</button>
            ))}
          </div>
        )}
      </section>

      {posting && <StoryPost story={posting} link={link} say={say} onClose={() => setPosting(null)} />}
      {asking && <AskStory api={api} names={names} say={say} onDone={() => { setAsking(false); void reload(); }} onClose={() => setAsking(false)} />}
    </>
  );
}

function AskStory({ api, names, say, onDone, onClose }: { api: StoriesApi; names: Record<string, string>; say: (m: string) => void; onDone: () => void; onClose: () => void }) {
  const [client, setClient] = useState<string | null>(null);
  const [nums, setNums] = useState<StoryNumbers | null>(null);
  const [shown, setShown] = useState<StoryKey[]>([]);
  const [headline, setHeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = Object.entries(names).sort((a, b) => a[1].localeCompare(b[1]));

  const pick = async (id: string) => {
    setClient(id); setNums(null); setError(null);
    try {
      const n = await api.numbers(id);
      const keys = availableKeys(n);
      setNums(n); setShown(keys.slice(0, 3)); setHeadline(headlineIdeas(n, names[id]!.split(" ")[0]!)[0] ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const send = async () => {
    if (!client || !nums) return;
    const problem = storyProblem(headline, shown, nums);
    if (problem) { setError(problem); return; }
    setBusy(true);
    try { await api.ask(client, headline, shown); say(`Asked ${names[client]!.split(" ")[0]} · they'll see it in their app`); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const first = client ? names[client]!.split(" ")[0]! : "";
  const keys = nums ? availableKeys(nums) : [];

  return (
    <Sheet label="Ask a client" onClose={onClose}>
      <div className="sect"><h2 className="h3">{client ? `${first}'s story` : "Whose story?"}</h2><button className="btn ghost sm" onClick={onClose}>Close</button></div>
      {!client && (
        list.length ? (
          <div className="card flat list">
            {list.map(([id, name]) => <button key={id} className="li" onClick={() => void pick(id)}><div className="grow h3">{name}</div><span className="tiny">›</span></button>)}
          </div>
        ) : <div className="card small">No clients yet. Stories come from clients you coach in APEX.</div>
      )}
      {client && !nums && !error && <div className="card small">Working out {first}'s numbers…</div>}
      {client && nums && (
        <div className="stack" style={{ gap: 14 }}>
          {keys.length === 0 ? (
            <div className="card small">{first} doesn't have results to share yet. Stories need a few logged workouts first.</div>
          ) : (
            <>
              <div className="stack" style={{ gap: 6 }}>
                <div className="sect" style={{ margin: 0 }}><span className="tiny">Numbers to share</span><Label kind="data">Data</Label></div>
                <div className="gr-chips">
                  {keys.map((k) => {
                    const on = shown.includes(k);
                    const line = storyLines(nums, [k])[0];
                    return <button key={k} type="button" className="gr-chip" aria-pressed={on} onClick={() => setShown(on ? shown.filter((x) => x !== k) : [...shown, k])}>{KEY_LABEL[k]}{line ? ` · ${line.value}` : ""}</button>;
                  })}
                </div>
              </div>
              <label className="stack" style={{ gap: 6 }}>
                <span className="tiny">Headline <span className="num">{STORY_HEADLINE_MAX - headline.trim().length}</span></span>
                <input className="field" maxLength={STORY_HEADLINE_MAX} value={headline} onChange={(e) => { setHeadline(e.target.value); setError(null); }} />
              </label>
              <div className="stack" style={{ gap: 6 }}>
                <div className="sect" style={{ margin: 0 }}><span className="tiny">Ideas from the numbers</span><Label kind="ai">AI suggestion</Label></div>
                <div className="gr-chips">{headlineIdeas(nums, first).map((h) => <button key={h} type="button" className="gr-chip" aria-pressed={headline === h} onClick={() => setHeadline(h)}>{h}</button>)}</div>
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <span className="tiny">What {first} will be asked to approve</span>
                <SuccessStoryCard headline={headline.trim() || "Your headline"} numbers={nums} shown={shown} quote="" name={null} />
              </div>
            </>
          )}
          {error && <p className="small" role="alert" style={{ margin: 0, color: "var(--crit)" }}>{error}</p>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={() => { setClient(null); setNums(null); setError(null); }}>Back</button>
            {keys.length > 0 && <button className="btn act grow" disabled={busy} onClick={() => void send()}>{busy ? "Sending…" : `Ask ${first}`}</button>}
          </div>
        </div>
      )}
      {client && error && !nums && <p className="small" role="alert" style={{ margin: 0, color: "var(--crit)" }}>{error}</p>}
    </Sheet>
  );
}

/** "Priya Sharma" → "Priya S." */
const shortName = (full: string) => {
  const p = full.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]![0]}.` : p[0] ?? "";
};

const LOOKS: [MarketingCardTheme, string][] = [["studio", "Studio"], ["night", "Night"], ["day", "Daylight"]];

/** An approved story as an Instagram post (4:5) or story (9:16), drawn on the phone, shared with the share sheet. */
function StoryPost({ story: s, link, say, onClose }: { story: Story; link: string; say: (m: string) => void; onClose: () => void }) {
  const { coachName } = useAppInfo();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<"post" | "story">("post");
  const [theme, setTheme] = useState<MarketingCardTheme>("studio");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  const name = s.showName ? shortName(s.clientName) : null;
  const [caption, setCaption] = useState(() => successCaption({ headline: s.headline, quote: s.quote, name, numbers: s.numbers }, s.shown, link));
  const pic = storyPhoto(s.numbers);
  const site = link.replace(/^https?:\/\//, "").replace(/\/$/, "");
  useEffect(() => { void Promise.all([loadStoryFonts(), loadPhoto(HERO_IMAGES[pic.hero].src).then(setPhoto)]).then(() => setReady(true)); }, [pic.hero]);
  useEffect(() => {
    if (!canvas.current) return;
    const lines = storyLines(s.numbers, s.shown).map(({ value, label }) => ({ value, label }));
    drawMarketingCard(canvas.current, { card: { kind: "result", headline: s.headline, lines, quote: s.quote, name }, format, theme, coach: coachName, site, photo, photoFocus: pic.focus });
  }, [s, format, theme, coachName, site, photo, pic.focus, name, ready]);
  const share = async () => {
    if (!canvas.current) return;
    const m = await shareCards([canvas.current], `apex-result-${format}`, caption);
    if (m) say(m);
  };
  return (
    <Sheet label="Make a post" onClose={onClose}>
      <div className="sect"><h2 className="h3">Make a post</h2><button className="btn ghost sm" onClick={onClose}>Close</button></div>
      <div className="stack" style={{ gap: 14 }}>
        <canvas ref={canvas} className="mk-canvas" aria-label={`${s.headline}, ${format === "post" ? "post" : "story"} preview`} />
        <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <div className="seg" style={{ flex: "1 1 160px" }}>
            {(["post", "story"] as const).map((f) => <button key={f} className={format === f ? "on" : ""} aria-pressed={format === f} onClick={() => setFormat(f)}>{f === "post" ? "Post 4:5" : "Story 9:16"}</button>)}
          </div>
          <div className="seg" style={{ flex: "1 1 200px" }}>
            {LOOKS.map(([t, label]) => <button key={t} className={theme === t ? "on" : ""} aria-pressed={theme === t} onClick={() => setTheme(t)}>{label}</button>)}
          </div>
        </div>
        <label className="stack" style={{ gap: 6 }}>
          <span className="tiny row" style={{ gap: 8 }}>Caption <Label kind="ai">AI suggestion</Label></span>
          <textarea className="field mk-caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
        </label>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn act grow" onClick={() => void share()}><Icons.share width={15} height={15} /> Share or save</button>
          <button className="btn ghost" onClick={() => void copyText(caption).then((ok) => ok && say("Caption copied"))}><Icons.copy width={15} height={15} /> Caption</button>
        </div>
        <p className="tiny" style={{ margin: 0 }}>Only the numbers and words {s.clientName.split(" ")[0]} approved{name ? `, with their name as ${name}` : ", without their name"}. Sized for Instagram, TikTok, Facebook and WhatsApp.</p>
      </div>
    </Sheet>
  );
}
