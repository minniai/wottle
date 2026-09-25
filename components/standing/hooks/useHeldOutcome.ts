"use client";

import { useEffect, useRef, useState } from "react";

import { ACCEPTED_HOLD_MS, OUTCOME_HOLD_MS } from "@/lib/presence/constants";
import type { HeldOutcome } from "@/lib/pages/heldOutcome";
import { outcomeOf, type OutgoingChallenge } from "@/lib/types/standing";

export type { HeldOutcome };

/**
 * What became of the viewer's challenge (spec 070 US3.4, US3.6): held 4s from
 * when it was first seen, on the row and in the slot. `accepted` holds 400ms and
 * then hands over the match. An outcome is shown once. One this tab saw coming
 * (its challenge was read pending here) is shown however late the read, since a
 * lost poke leaves only the fallback poll; an old one read on a reload is not.
 */
export function useHeldOutcome(outgoing: OutgoingChallenge | null, onAccepted: (matchId: string) => void): HeldOutcome | null {
  const [held, setHeld] = useState<HeldOutcome | null>(null);
  const shown = useRef(new Set<string>());
  const seenPending = useRef(new Set<string>());
  const pendingId = outgoing?.status === "pending" ? outgoing.inviteId : null;
  useEffect(() => {
    if (pendingId) seenPending.current.add(pendingId);
  }, [pendingId]);
  const accepted = useRef(onAccepted);
  useEffect(() => {
    accepted.current = onAccepted;
  }, [onAccepted]);

  const outcome = outgoing ? outcomeOf(outgoing.status) : null;
  const key = outgoing && outcome ? `${outgoing.inviteId}:${outcome}` : null;
  const latest = useRef(outgoing);
  useEffect(() => {
    latest.current = outgoing;
  }, [outgoing]);

  // Keyed on the invite and its outcome only: a repeated read of the same outcome changes nothing.
  useEffect(() => {
    const current = latest.current;
    if (!current || !outcome || !key || shown.current.has(key)) return;
    shown.current.add(key);
    const stale = current.respondedAt !== null && Date.now() - Date.parse(current.respondedAt) > OUTCOME_HOLD_MS;
    if (stale && !seenPending.current.has(current.inviteId)) return;
    const matchId = current.matchId;
    setHeld({ inviteId: current.inviteId, playerId: current.to.playerId, name: current.to.displayName, outcome });
    const id = setTimeout(() => {
      setHeld(null);
      if (outcome === "accepted" && matchId) accepted.current(matchId);
    }, outcome === "accepted" ? ACCEPTED_HOLD_MS : OUTCOME_HOLD_MS);
    return () => clearTimeout(id);
  }, [key, outcome]);

  return held;
}
