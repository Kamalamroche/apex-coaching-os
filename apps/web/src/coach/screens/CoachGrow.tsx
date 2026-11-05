import { HEADLINE_MAX, BIO_MAX, MODE_LABEL, SPECIALTY_IDEAS, SPECIALTY_MAX, pageLink, pageProblem, slugProblem, slugify, sortRequests, trainWithMeText, type CoachPage, type JoinRequest, type JoinRequestStatus, type TrainingModeName } from "@apex/core";
import { BackLink, CoachPageView, GrowHero, Icons, RequestItem, Sheet } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { GROWTH_NEEDS_UPDATE, useGrowthApi } from "../../data/growth";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; page: CoachPage; requests: JoinRequest[] };

/** Copies text, falling back to a prompt where the clipboard is blocked. */
async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { window.prompt("Copy this", text); return false; }
}

/** Coach: my public page (edit, publish, preview), my Train with me link, and requests from people who want to train. */
export function CoachGrow({ onBack, say }: { onBack: () => void; say: (m: string) => void }) {
  const api = useGrowthApi();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [draft, setDraft] = useState<CoachPage | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    if (!api) return;
    try {
      const [page, requests] = await Promise.all([api.page(), api.requests()]);
      const p = page as CoachPage;
      setLoad({ status: "ready", page: p, requests: sortRequests(requests) });
      setDraft((d) => d ?? p);
    } catch (e) {
      setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);
  if (!api) return null;

  if (load.status !== "ready" || !draft) {
    return (
      <>
        <BackLink onClick={onBack}>Messages</BackLink>
        {load.status === "error" ? (
          <div className="card small">{load.message === GROWTH_NEEDS_UPDATE ? "Your page needs a database update first: run 20261110090000_growth.sql in Supabase." : load.message}</div>
        ) : <div className="card small">Loading your page…</div>}
      </>
    );
  }
  const saved = load.page;
  const link = pageLink(location.origin, saved.slug);
  const fresh = load.requests.filter((r) => r.status === "new").length;
  const joined = load.requests.filter((r) => r.status === "joined").length;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const problem = draft.published ? pageProblem(draft) : slugProblem(draft.slug);
  const set = (patch: Partial<CoachPage>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const save = async (next = draft) => {
    setBusy(true);
    try { await api.savePage(next); say(next.published ? "Your page is live" : "Saved as a draft"); setDraft(next); await reload(); }
    catch (e) { say(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const share = async () => {
    const text = trainWithMeText(link);
    if (navigator.share) {
      try { await navigator.share({ title: "Train with me", text, url: link }); return; } catch { /* closed: fall back to copy */ }
    }
    if (await copy(text)) say("Link copied · paste it in your bio or a message");
  };
  const act = async (r: JoinRequest, status: JoinRequestStatus | "invite") => {
    try {
      if (status === "invite") {
        const invite = await api.invite(r.id);
        const first = r.name.split(" ")[0];
        const body = `Hi ${first}, great to hear from you. Here's your invite to train with me on APEX: ${invite}`;
        if (await copy(body)) say(`Invite copied · send it to ${first}`);
        window.open(`mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent("Your invite to train with me")}&body=${encodeURIComponent(body)}`, "_blank");
      } else {
        await api.setStatus(r.id, status);
        say(status === "declined" ? "Request declined" : "Updated");
      }
    } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    await reload();
  };

  return (
    <>
      <BackLink onClick={onBack}>Messages</BackLink>
      <GrowHero page={saved} fresh={fresh} joined={joined}>
        {saved.published ? (
          <div className="gr-row">
            <button className="gr-cta" onClick={() => void share()}><Icons.share width={15} height={15} /> Share my link</button>
            <a className="gr-cta glass" href={link} target="_blank" rel="noreferrer"><Icons.globe width={15} height={15} /> Open</a>
          </div>
        ) : (
          <button className="gr-cta" onClick={() => document.getElementById("gr-edit")?.scrollIntoView({ behavior: "smooth" })}>Set up my page</button>
        )}
      </GrowHero>

      {saved.published && (
        <div className="gr-link">
          <Icons.link width={16} height={16} style={{ color: "var(--act)", flex: "none" }} />
          <code>{link.replace(/^https?:\/\//, "")}</code>
          <button className="btn ghost sm" onClick={() => void copy(link).then((ok) => ok && say("Link copied"))}><Icons.copy width={14} height={14} /> Copy</button>
        </div>
      )}

      <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Requests to train</h2>{fresh > 0 && <span className="tiny num">{fresh} new</span>}</div>
      {load.requests.length ? (
        <div className="stack" style={{ gap: 8 }}>
          {load.requests.map((r, i) => (
            <RequestItem key={r.id} r={r} i={i}>
              {r.status === "new" && <>
                <button className="btn act sm" onClick={() => void act(r, "invite")}><Icons.mail width={14} height={14} /> Invite</button>
                <button className="btn ghost sm" onClick={() => void act(r, "declined")}>Decline</button>
              </>}
              {r.status === "invited" && <button className="btn ghost sm" onClick={() => void act(r, "invite")}><Icons.mail width={14} height={14} /> Send invite again</button>}
              {r.status === "declined" && <button className="btn ghost sm" onClick={() => void act(r, "new")}>Undo</button>}
            </RequestItem>
          ))}
        </div>
      ) : (
        <div className="card small">No requests yet. Share your link and they'll land here, with who sent them.</div>
      )}

      <section id="gr-edit" className="card stack" style={{ gap: 14 }}>
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Your page</h2><button className="btn ghost sm" onClick={() => setPreview(true)}>Preview</button></div>
        <label className="stack" style={{ gap: 6 }}>
          <span className="tiny">Address</span>
          <div className="gr-link" style={{ padding: "4px 4px 4px 12px" }}>
            <span className="tiny num" style={{ flex: "none" }}>{location.host}/c/</span>
            <input className="field" style={{ border: 0, background: "none", padding: "8px 4px" }} value={draft.slug} onChange={(e) => set({ slug: slugify(e.target.value) || e.target.value.toLowerCase() })} aria-label="Page address" />
          </div>
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="tiny">Headline <span className="num">{HEADLINE_MAX - draft.headline.trim().length}</span></span>
          <input className="field" maxLength={HEADLINE_MAX} placeholder="Strength coaching that fits your life" value={draft.headline} onChange={(e) => set({ headline: e.target.value })} />
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="tiny">Your story <span className="num">{BIO_MAX - draft.bio.trim().length}</span></span>
          <textarea className="field" rows={4} maxLength={BIO_MAX} placeholder="Who you coach, how you work, what they get." value={draft.bio} onChange={(e) => set({ bio: e.target.value })} />
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="tiny">City (optional)</span>
          <input className="field" maxLength={60} value={draft.city} onChange={(e) => set({ city: e.target.value })} />
        </label>
        <div className="stack" style={{ gap: 6 }}>
          <span className="tiny">Specialties · up to {SPECIALTY_MAX}</span>
          <div className="gr-chips">
            {SPECIALTY_IDEAS.map((s) => {
              const on = draft.specialties.includes(s);
              return <button key={s} type="button" className="gr-chip" aria-pressed={on} disabled={!on && draft.specialties.length >= SPECIALTY_MAX} onClick={() => set({ specialties: on ? draft.specialties.filter((x) => x !== s) : [...draft.specialties, s] })}>{s}</button>;
            })}
          </div>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <span className="tiny">How you coach</span>
          <div className="gr-chips">
            {(Object.keys(MODE_LABEL) as TrainingModeName[]).map((m) => {
              const on = draft.modes.includes(m);
              return <button key={m} type="button" className="gr-chip" aria-pressed={on} onClick={() => set({ modes: on ? draft.modes.filter((x) => x !== m) : [...draft.modes, m] })}>{MODE_LABEL[m]}</button>;
            })}
          </div>
        </div>
        <label className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <input type="checkbox" role="switch" checked={draft.clients !== null} onChange={(e) => set({ clients: e.target.checked ? (saved.clients ?? 0) : null })} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
          <span className="grow"><b className="small" style={{ color: "var(--text)" }}>Show how many clients I coach</b><br /><span className="tiny">Just the number. Never names.</span></span>
        </label>
        <label className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <input type="checkbox" role="switch" checked={draft.published} onChange={(e) => set({ published: e.target.checked })} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
          <span className="grow"><b className="small" style={{ color: "var(--text)" }}>Page is live</b><br /><span className="tiny">Anyone with the link can see it and ask to train with you.</span></span>
        </label>
        {problem && dirty && <p className="small" role="alert" style={{ margin: 0, color: "var(--crit)" }}>{problem}</p>}
        <button className="btn act block" disabled={busy || !dirty || !!problem} onClick={() => void save()}>{draft.published ? "Save and publish" : "Save draft"}</button>
      </section>

      {preview && (
        <Sheet label="Preview" onClose={() => setPreview(false)}>
          <div className="sect"><h2 className="h3">What people see</h2><button className="btn ghost sm" onClick={() => setPreview(false)}>Close</button></div>
          <CoachPageView page={draft} preview action={<span className="gr-cta">Train with {draft.name.split(" ")[0]}</span>} />
        </Sheet>
      )}
    </>
  );
}
