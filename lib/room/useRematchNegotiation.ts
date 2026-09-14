"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cancelRematchAction } from "@/app/actions/match/cancelRematch";
import { requestRematchAction } from "@/app/actions/match/requestRematch";
import { acceptRematchAction, declineRematchAction } from "@/app/actions/match/respondToRematch";
import type { RematchEvent } from "@/lib/types/match";

export type RematchPhase = "idle" | "requesting" | "waiting" | "incoming" | "accepted" | "declined" | "expired";

export const REMATCH_TIMEOUT_MS = 30_000;

export interface RematchOptions {
  matchId: string;
  currentPlayerId: string;
  /** Called with the new match id when both sides agreed. */
  onNewMatch: (newMatchId: string) => void;
}

export interface RematchApi {
  phase: RematchPhase;
  error: string | null;
  request: () => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  /** Feed rematch broadcasts from the room's single match channel. */
  handleEvent: (event: RematchEvent) => void;
}

/**
 * Rematch negotiation for the final room state (spec 016 server flow kept;
 * spec 044 renders it as ledger lines). Events arrive through the room's
 * existing channel subscription instead of a second one.
 */
export function useRematchNegotiation({ matchId, currentPlayerId, onNewMatch }: RematchOptions): RematchApi {
  const [phase, setPhase] = useState<RematchPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const phaseRef = useRef(phase);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNewMatchRef = useRef(onNewMatch);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    onNewMatchRef.current = onNewMatch;
  }, [onNewMatch]);

  const clearTimer = () => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
  };

  useEffect(
    () => () => {
      clearTimer();
      if (phaseRef.current === "waiting") cancelRematchAction(matchId).catch(() => undefined);
    },
    [matchId],
  );

  const handleEvent = useCallback(
    (event: RematchEvent) => {
      const mine = event.requesterId === currentPlayerId;
      if (event.type === "rematch-accepted" && event.newMatchId) {
        clearTimer();
        setPhase("accepted");
        onNewMatchRef.current(event.newMatchId);
      } else if (event.type === "rematch-declined") {
        clearTimer();
        setPhase("declined");
      } else if (event.type === "rematch-expired") {
        clearTimer();
        setPhase("expired");
      } else if (event.type === "rematch-request" && !mine) {
        setPhase("incoming");
      }
    },
    [currentPlayerId],
  );

  const request = useCallback(async () => {
    if (phaseRef.current !== "idle" && phaseRef.current !== "declined" && phaseRef.current !== "expired") return;
    setPhase("requesting");
    setError(null);
    try {
      const result = await requestRematchAction(matchId);
      if (result.status === "accepted") {
        setPhase("accepted");
        onNewMatchRef.current(result.matchId);
        return;
      }
      setPhase("waiting");
      timeout.current = setTimeout(() => setPhase("expired"), REMATCH_TIMEOUT_MS);
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "unable to request a rematch");
    }
  }, [matchId]);

  const accept = useCallback(async () => {
    if (phaseRef.current !== "incoming") return;
    setPhase("requesting");
    try {
      const result = await acceptRematchAction(matchId);
      if (result.status === "accepted") {
        setPhase("accepted");
        onNewMatchRef.current(result.matchId);
      } else setPhase("expired");
    } catch (e) {
      setPhase("incoming");
      setError(e instanceof Error ? e.message : "unable to accept");
    }
  }, [matchId]);

  const decline = useCallback(async () => {
    if (phaseRef.current !== "incoming") return;
    setPhase("declined");
    await declineRematchAction(matchId).catch(() => undefined);
  }, [matchId]);

  return { phase, error, request, accept, decline, handleEvent };
}
