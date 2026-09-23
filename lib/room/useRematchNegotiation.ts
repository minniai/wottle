"use client";

import type { ErrorCode } from "@/lib/i18n/copy/types";
import { useCallback, useEffect, useRef, useState } from "react";

import { cancelRematchAction } from "@/app/actions/match/cancelRematch";
import { requestRematchAction } from "@/app/actions/match/requestRematch";
import { acceptRematchAction, declineRematchAction } from "@/app/actions/match/respondToRematch";
import type { RematchEvent } from "@/lib/types/match";

/** `busy`: either player is in another match, so no rematch can start (spec 067). */
export type RematchPhase = "idle" | "requesting" | "waiting" | "incoming" | "accepted" | "declined" | "expired" | "busy";

export const REMATCH_TIMEOUT_MS = 30_000;

export interface RematchOptions {
  matchId: string;
  currentPlayerId: string;
  /** Called with the new match id when both sides agreed. */
  onNewMatch: (newMatchId: string) => void;
}

export interface RematchApi {
  phase: RematchPhase;
  /** A failure, as a code the room words in the page's language (spec 060). */
  error: ErrorCode | null;
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
  const [error, setError] = useState<ErrorCode | null>(null);
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
      if (result.status === "busy") return setPhase("busy");
      setPhase("waiting");
      timeout.current = setTimeout(() => setPhase("expired"), REMATCH_TIMEOUT_MS);
    } catch (e) {
      setPhase("idle");
      console.warn("[rematch] request failed", e);
      setError("rematch_failed");
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
      } else setPhase(result.status === "busy" ? "busy" : "expired");
    } catch (e) {
      setPhase("incoming");
      console.warn("[rematch] accept failed", e);
      setError("accept_failed");
    }
  }, [matchId]);

  const decline = useCallback(async () => {
    if (phaseRef.current !== "incoming") return;
    setPhase("declined");
    await declineRematchAction(matchId).catch(() => undefined);
  }, [matchId]);

  return { phase, error, request, accept, decline, handleEvent };
}
