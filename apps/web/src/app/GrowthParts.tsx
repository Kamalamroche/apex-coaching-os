import { inviteFriendText, type ReferralSummary } from "@apex/core";
import { Icons, InviteFriendCard } from "@apex/ui";
import { useEffect, useState } from "react";
import { useGrowthApi } from "../data/growth";
import { useAppInfo } from "./AppContext";

/** Client: my friend link and how many came. Null until the coach's page is live. */
export function useFriendInvite(): { link: string; summary: ReferralSummary } | null {
  const api = useGrowthApi();
  const [state, setState] = useState<{ link: string; summary: ReferralSummary } | null>(null);
  useEffect(() => {
    if (!api || api.side !== "client") return;
    let live = true;
    void (async () => {
      try {
        const link = await api.friendLink();
        if (!link) return;
        const summary = await api.referrals();
        if (live) setState({ link, summary });
      } catch { /* not set up yet: no card */ }
    })();
    return () => { live = false; };
  }, [api]);
  return state;
}

/** The invite card with share and copy. */
export function InviteFriend({ say }: { say: (m: string) => void }) {
  const { coachName } = useAppInfo();
  const invite = useFriendInvite();
  if (!invite) return null;
  const text = inviteFriendText(coachName, invite.link);
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `Train with ${coachName}`, text, url: invite.link }); return; } catch { /* closed: copy instead */ }
    }
    try { await navigator.clipboard.writeText(text); say("Invite copied · send it to a friend"); } catch { window.prompt("Copy this", text); }
  };
  return (
    <InviteFriendCard coachName={coachName} asked={invite.summary.asked} joined={invite.summary.joined}>
      <p className="gr-headline" style={{ fontSize: 14 }}>Your link takes them to {coachName}'s page. {coachName} sees you sent them.</p>
      <button className="gr-cta" onClick={() => void share()}><Icons.share width={15} height={15} /> Invite a friend</button>
    </InviteFriendCard>
  );
}
