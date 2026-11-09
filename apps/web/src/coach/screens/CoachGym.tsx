import {
  GYM_NAME_MAX, ROLE_LABEL, canChangeRole, canHandOver, canInvite, canRemove, canShare, filterGymClients, gymInviteText, gymNameProblem,
  gymTotals, handOverTargets, inviteDaysLeft, isLead, lastSeenText, shareTargets, trainerLines, type ClientFilter, type GymClient, type GymRole,
} from "@apex/core";
import { BackLink, GymClientItem, GymHero, GymStat, Icons, RoleBadge, RoleGuide, Sheet, TrainerRoster } from "@apex/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GYM_NEEDS_UPDATE, gymInviteNote, useGymApi, type GymState } from "../../data/gym";

type Load = { status: "loading" } | { status: "error"; message: string } | ({ status: "ready" } & GymState);
type Open = { kind: "invite" } | { kind: "member"; id: string } | { kind: "client"; id: string } | { kind: "rename" } | null;
type InviteRole = Exclude<GymRole, "owner">;

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { window.prompt("Copy this", text); return false; }
}

const filterKey = (f: ClientFilter) => (typeof f === "string" ? f : `t:${f.trainer}`);

/** Coach: the gym. Owner and managers run the team and see every client; trainers see their own and the shared ones. */
export function CoachGym({ onBack, say }: { onBack: () => void; say: (m: string) => void }) {
  const api = useGymApi();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [open, setOpen] = useState<Open>(null);
  const [filter, setFilter] = useState<ClientFilter | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(() => gymInviteNote.text);

  const reload = useCallback(async () => {
    if (!api) return;
    try { setLoad({ status: "ready", ...(await api.load()) }); }
    catch (e) { setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) }); }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { gymInviteNote.text = null; }, []);

  const act = async (fn: () => Promise<unknown>, done: string, close = true) => {
    setBusy(true);
    try { await fn(); say(done); if (close) setOpen(null); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
    await reload();
  };

  if (!api) return null;
  const back = <BackLink onClick={onBack}>Business</BackLink>;
  if (load.status !== "ready") {
    return (
      <>
        {back}
        {load.status === "error"
          ? <div className="card small">{load.message === GYM_NEEDS_UPDATE ? "Gyms need a database update first: run 20261115170000_gyms.sql in Supabase." : load.message}</div>
          : <div className="card small">Loading your gym…</div>}
      </>
    );
  }
  const noteCard = note && <div className="card small" role="status" style={{ borderColor: "var(--act)" }}>{note} <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => setNote(null)}>OK</button></div>;
  if (!load.gym) return <><>{back}</>{noteCard}<StartGym busy={busy} onStart={(name) => void act(() => api.create(name), `${name.trim()} is set up`)} /></>;

  const { gym, members, clients, invites } = load;
  const me = api.me;
  const role = gym.myRole;
  const lead = isLead(role);
  const totals = gymTotals(members, clients);
  const lines = trainerLines(members, clients);
  const f: ClientFilter = filter ?? (lead ? "all" : "mine");
  const shown = filterGymClients(clients, f, me);
  const sharedToMe = clients.filter((c) => c.trainerId !== me && c.sharedWith.some((s) => s.id === me)).length;
  const chips: { f: ClientFilter; label: string }[] = [
    ...(lead ? [{ f: "all" as const, label: `All ${clients.length}` }] : []),
    { f: "mine", label: "Mine" },
    ...(sharedToMe ? [{ f: "shared" as const, label: `Shared with me ${sharedToMe}` }] : []),
    ...(lead ? members.filter((m) => !m.isMe).map((m) => ({ f: { trainer: m.id }, label: m.name.split(" ")[0] ?? m.name })) : []),
  ];
  const meMember = members.find((m) => m.isMe);
  const openMember = open?.kind === "member" ? members.find((m) => m.id === open.id) : undefined;
  const openClient = open?.kind === "client" ? clients.find((c) => c.id === open.id) : undefined;

  return (
    <>
      {back}
      {noteCard}
      <GymHero
        name={gym.name}
        role={role}
        pills={[
          { icon: "clients", text: `${totals.trainers} ${totals.trainers === 1 ? "trainer" : "trainers"}` },
          { icon: "brief", text: `${totals.clients} ${totals.clients === 1 ? "client" : "clients"}` },
          { icon: "train", text: `${totals.sessions7} sessions this week` },
        ]}
      >
        {lead && <button className="gr-cta" onClick={() => setOpen({ kind: "invite" })}><Icons.plus width={15} height={15} /> Invite a trainer</button>}
      </GymHero>

      <div className="gy-stats">
        <GymStat value={totals.sessions7} label="Sessions this week" i={0} />
        <GymStat value={totals.clients} label={lead ? "Clients in the gym" : "Clients you see"} i={1} />
        <GymStat value={totals.quiet} label="Quiet this week" i={2} />
      </div>

      <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Trainers</h2><span className="tiny">This week</span></div>
      <TrainerRoster lines={lines} onOpen={lead ? (id) => setOpen({ kind: "member", id }) : undefined} />

      {lead && invites.length > 0 && (
        <>
          <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Waiting to join</h2><span className="tiny num">{invites.length}</span></div>
          <div className="card flat list">
            {invites.map((inv) => (
              <div key={inv.token} className="li">
                <Icons.mail width={18} height={18} style={{ color: "var(--act)" }} />
                <div className="grow"><div className="h3">{ROLE_LABEL[inv.role]} invite</div><div className="tiny num">{inviteDaysLeft(inv)} days left</div></div>
                <button className="btn ghost sm" disabled={busy} onClick={() => void act(() => api.revoke(inv.token), "Invite cancelled", false)}>Cancel</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Clients</h2><span className="tiny">Quietest first</span></div>
      <div className="chips" role="tablist" aria-label="Whose clients">
        {chips.map((c) => {
          const on = filterKey(c.f) === filterKey(f);
          return <button key={filterKey(c.f)} role="tab" aria-selected={on} className={`chip ${on ? "on" : ""}`} onClick={() => setFilter(c.f)}>{c.label}</button>;
        })}
      </div>
      {shown.length ? (
        <div className="gy-list">
          {shown.map((c, i) => <GymClientItem key={`${c.id}-${c.trainerId}`} c={c} i={i} myId={me} onOpen={() => setOpen({ kind: "client", id: c.id })} />)}
        </div>
      ) : (
        <div className="card small">{f === "mine" ? "No clients of your own here yet. Invite them from the Clients tab." : "No clients here yet."}</div>
      )}

      <RoleGuide mine={role} />

      <div className="card flat list">
        {role === "owner" && (
          <button className="li" onClick={() => setOpen({ kind: "rename" })}>
            <Icons.note width={18} height={18} style={{ color: "var(--act)" }} />
            <div className="grow"><div className="h3">Rename the gym</div><div className="tiny">{gym.name}</div></div>
            <span className="tiny">›</span>
          </button>
        )}
        {role === "owner" ? (
          <button className="li" disabled={busy} onClick={() => { if (window.confirm(`Close ${gym.name}? Every trainer keeps their own clients; the team, shares and invites go.`)) void act(() => api.close(), "Gym closed"); }}>
            <Icons.trash width={18} height={18} style={{ color: "var(--crit)" }} />
            <div className="grow"><div className="h3" style={{ color: "var(--crit)" }}>Close the gym</div><div className="tiny">Trainers keep their own clients</div></div>
          </button>
        ) : meMember && (
          <button className="li" disabled={busy} onClick={() => { if (window.confirm(`Leave ${gym.name}? You keep your own clients.`)) void act(() => api.remove(meMember.id), `You left ${gym.name}`); }}>
            <Icons.back width={18} height={18} style={{ color: "var(--crit)" }} />
            <div className="grow"><div className="h3" style={{ color: "var(--crit)" }}>Leave the gym</div><div className="tiny">You keep your own clients</div></div>
          </button>
        )}
      </div>

      {open?.kind === "invite" && <InviteSheet role={role} gymName={gym.name} onClose={() => setOpen(null)} make={async (r) => { const link = await api.invite(r); void reload(); return link; }} say={say} />}

      {openMember && (
        <Sheet label={openMember.name} onClose={() => setOpen(null)}>
          <div className="stack" style={{ gap: 14 }}>
            <div className="gy-name"><h2 className="h2" style={{ margin: 0 }}>{openMember.name}</h2><RoleBadge role={openMember.role} /></div>
            <div className="small">Joined {lastSeenText(openMember.joinedAt).toLowerCase()} · {clients.filter((c) => c.trainerId === openMember.id).length} clients</div>
            {canChangeRole(role, openMember) && (
              <div className="gy-pick" role="group" aria-label="Role">
                {(["manager", "trainer"] as const).map((r) => (
                  <button key={r} aria-pressed={openMember.role === r} disabled={busy || openMember.role === r} onClick={() => void act(() => api.setRole(openMember.id, r), `${openMember.name.split(" ")[0]} is now a ${r}`, false)}>
                    <span className="grow">{ROLE_LABEL[r]}<small>{r === "manager" ? "Sees every client, invites trainers, hands clients over" : "Coaches their own clients and the ones shared with them"}</small></span>
                    {openMember.role === r && <Icons.check width={16} height={16} style={{ color: "var(--act)" }} />}
                  </button>
                ))}
              </div>
            )}
            <button className="btn ghost block" onClick={() => { setFilter({ trainer: openMember.id }); setOpen(null); }}>See their clients</button>
            {canRemove(role, openMember) && !openMember.isMe && (
              <button className="btn ghost block" style={{ color: "var(--crit)" }} disabled={busy} onClick={() => { if (window.confirm(`Remove ${openMember.name} from ${gym.name}? They keep their own clients. Hand clients over first if they should stay in the gym.`)) void act(() => api.remove(openMember.id), `${openMember.name.split(" ")[0]} removed`); }}>
                Remove from the gym
              </button>
            )}
          </div>
        </Sheet>
      )}

      {openClient && <ClientSheet c={openClient} role={role} me={me} members={members} busy={busy} onClose={() => setOpen(null)}
        handOver={(to) => { const t = members.find((m) => m.id === to); if (t && window.confirm(`Hand ${openClient.name} over to ${t.name}? ${t.name.split(" ")[0]} becomes their trainer and takes over their programme. Their chat with ${openClient.trainerName.split(" ")[0]} stays private.`)) void act(() => api.handOver(openClient.id, to), `${openClient.name.split(" ")[0]} is now with ${t.name.split(" ")[0]}`); }}
        share={(id, on) => void act(() => api.share(openClient.id, id, on), on ? "Shared" : "Stopped sharing", false)}
      />}

      {open?.kind === "rename" && <RenameSheet name={gym.name} busy={busy} onClose={() => setOpen(null)} onSave={(n) => void act(() => api.rename(n), "Gym renamed")} />}
    </>
  );
}

function StartGym({ busy, onStart }: { busy: boolean; onStart: (name: string) => void }) {
  const [name, setName] = useState("");
  const problem = gymNameProblem(name);
  return (
    <>
      <GymHero name="Your gym" role={null} pills={[{ icon: "clients", text: "Owner · managers · trainers" }]} />
      <section className="card stack" style={{ gap: 12 }}>
        <h2 className="h3" style={{ margin: 0 }}>Start a gym</h2>
        <p className="small" style={{ margin: 0 }}>Bring your trainers under one business account. You become the owner; invite trainers and managers with a link. Everyone keeps coaching from their own APEX account.</p>
        <input className="field" maxLength={GYM_NAME_MAX} placeholder="HELIX Performance" value={name} onChange={(e) => setName(e.target.value)} aria-label="Gym name" />
        <button className="btn act block" disabled={busy || !!problem} onClick={() => onStart(name)}>Start the gym</button>
        <div className="tiny">Joining someone else's gym? Open the invite link they sent you while signed in to your coach account.</div>
      </section>
      <RoleGuide mine={null} />
    </>
  );
}

function InviteSheet({ role, gymName, onClose, make, say }: { role: GymRole; gymName: string; onClose: () => void; make: (r: InviteRole) => Promise<string>; say: (m: string) => void }) {
  const [pick, setPick] = useState<InviteRole>("trainer");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const roles = (["trainer", "manager"] as const).filter((r) => canInvite(role, r));
  const text = link ? gymInviteText(gymName, pick, link) : "";
  const create = async () => {
    setBusy(true);
    try { setLink(await make(pick)); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `Join ${gymName}`, text }); return; } catch { /* closed: copy instead */ }
    }
    if (await copy(text)) say("Invite copied · send it to your trainer");
  };
  return (
    <Sheet label="Invite a trainer" onClose={onClose}>
      <div className="stack" style={{ gap: 14 }}>
        <h2 className="h2" style={{ margin: 0 }}>Invite to {gymName}</h2>
        <div className="gy-pick" role="group" aria-label="Role">
          {roles.map((r) => (
            <button key={r} aria-pressed={pick === r} disabled={!!link} onClick={() => setPick(r)}>
              <span className="grow">{ROLE_LABEL[r]}<small>{r === "manager" ? "Sees every client, invites trainers, hands clients over" : "Coaches their own clients and the ones shared with them"}</small></span>
              {pick === r && <Icons.check width={16} height={16} style={{ color: "var(--act)" }} />}
            </button>
          ))}
        </div>
        {link ? (
          <>
            <div className="gr-link"><Icons.link width={16} height={16} style={{ color: "var(--act)", flex: "none" }} /><code>{link.replace(/^https?:\/\//, "")}</code></div>
            <div className="gr-row">
              <button className="btn act" onClick={() => void share()}><Icons.share width={15} height={15} /> Send</button>
              <button className="btn ghost" onClick={() => void copy(text).then((ok) => ok && say("Invite copied"))}><Icons.copy width={15} height={15} /> Copy</button>
            </div>
            <div className="tiny">One person, one link. It works for 14 days. They open it signed in to their coach account, or create one.</div>
          </>
        ) : (
          <button className="btn act block" disabled={busy} onClick={() => void create()}>Make the invite link</button>
        )}
      </div>
    </Sheet>
  );
}

function ClientSheet({ c, role, me, members, busy, onClose, handOver, share }: {
  c: GymClient; role: GymRole; me: string; members: GymState["members"]; busy: boolean; onClose: () => void;
  handOver: (to: string) => void; share: (id: string, on: boolean) => void;
}) {
  const [to, setTo] = useState<string | null>(null);
  const shareable = canShare(role, me, c);
  const targets = useMemo(() => handOverTargets(members, c), [members, c]);
  return (
    <Sheet label={c.name} onClose={onClose}>
      <div className="stack" style={{ gap: 14 }}>
        <GymClientItem c={c} myId={me} />
        {c.trainerId !== me && <div className="tiny">{isLead(role) ? "" : `You can follow ${c.name.split(" ")[0]}'s progress here. `}{c.trainerName.split(" ")[0]} is their trainer, so only they change the plan or chat with them.</div>}

        {shareable && targets.length > 0 && (
          <section className="stack" style={{ gap: 8 }}>
            <h3 className="h3" style={{ margin: 0 }}>Share with</h3>
            <div className="tiny" style={{ marginTop: -4 }}>A shared trainer follows their sessions and programme here, for cover or a second opinion.</div>
            <div className="gy-pick" role="group" aria-label="Share with">
              {shareTargets(members, c).map((m) => {
                const on = c.sharedWith.some((s) => s.id === m.id);
                return (
                  <button key={m.id} aria-pressed={on} disabled={busy} onClick={() => share(m.id, !on)}>
                    <span className="grow">{m.name}{m.isMe ? " (you)" : ""}<small>{ROLE_LABEL[m.role]}</small></span>
                    {on ? <Icons.check width={16} height={16} style={{ color: "var(--act)" }} /> : <Icons.plus width={16} height={16} style={{ color: "var(--text3)" }} />}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {canHandOver(role) && targets.length > 0 && (
          <section className="stack" style={{ gap: 8 }}>
            <h3 className="h3" style={{ margin: 0 }}>Hand over to</h3>
            <div className="tiny" style={{ marginTop: -4 }}>The new trainer becomes their coach and takes over their programme. The client keeps training without a break.</div>
            <div className="gy-pick" role="group" aria-label="Hand over to">
              {targets.map((m) => (
                <button key={m.id} aria-pressed={to === m.id} onClick={() => setTo(m.id)}>
                  <span className="grow">{m.name}{m.isMe ? " (you)" : ""}<small>{ROLE_LABEL[m.role]}</small></span>
                  {to === m.id && <Icons.check width={16} height={16} style={{ color: "var(--act)" }} />}
                </button>
              ))}
            </div>
            <button className="btn act block" disabled={busy || !to} onClick={() => to && handOver(to)}><Icons.swap width={15} height={15} /> Hand over</button>
          </section>
        )}
      </div>
    </Sheet>
  );
}

function RenameSheet({ name, busy, onClose, onSave }: { name: string; busy: boolean; onClose: () => void; onSave: (n: string) => void }) {
  const [draft, setDraft] = useState(name);
  const problem = gymNameProblem(draft);
  return (
    <Sheet label="Rename the gym" onClose={onClose}>
      <div className="stack" style={{ gap: 12 }}>
        <h2 className="h2" style={{ margin: 0 }}>Rename the gym</h2>
        <input className="field" maxLength={GYM_NAME_MAX} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Gym name" />
        {problem && draft.trim() && <div className="tiny" style={{ color: "var(--crit)" }}>{problem}</div>}
        <button className="btn act block" disabled={busy || !!problem || draft.trim() === name} onClick={() => onSave(draft)}>Save</button>
      </div>
    </Sheet>
  );
}
