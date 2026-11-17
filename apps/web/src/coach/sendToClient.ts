import { DEMO_BOOKING_CLIENT, DEMO_BOOKING_NAMES, DEMO_CLIENT_ID } from "@apex/core";
import { useCallback } from "react";
import { useStore } from "../data/StoreContext";
import type { CoachLiveProps } from "./CoachApp";

/** Client names by id: the live roster, or the demo sample. */
export const clientNames = (live?: CoachLiveProps): Record<string, string> => (live ? Object.fromEntries((live.clients ?? []).map((c) => [c.id, c.name])) : DEMO_BOOKING_NAMES);

/** Send a chat message to one client as the coach. Demo: only Priya has a chat, the others are a no-op. */
export function useSendToClient(live?: CoachLiveProps) {
  const store = useStore();
  return useCallback(async (clientId: string, body: string) => {
    if (live) {
      const { error } = await live.db.from("messages").insert({ coach_id: live.coachId, client_id: clientId, sender_id: live.coachId, body });
      if (error) throw new Error(error.message);
    } else if (clientId === DEMO_BOOKING_CLIENT || clientId === String(DEMO_CLIENT_ID)) store.sendMessage("coach", body);
  }, [live, store]);
}
