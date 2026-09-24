"use client";

import type { ErrorCode } from "@/lib/i18n/copy/types";
import { useCallback, useEffect, useRef, useState } from "react";

import { requestRematchAction } from "@/app/actions/match/requestRematch";
import { acceptRematchAction, declineRematchAction } from "@/app/actions/match/respondToRematch";
import { withdrawRematchAction } from "@/app/actions/match/withdrawRematch";
import type { RematchOffer } from "@/lib/types/match";

export interface RematchOptions {
  matchId: string;
  viewerId: string;
  /** A participant on the result: the offer is read and kept fresh. */
  active: boolean;
  /** The offer the page was served (the match page attaches it). */
  initialOffer: RematchOffer | null;
  /** Called with the new match id when the rematch starts. */
  onNewMatch: (newMatchId: string) => void;
}

export interface RematchApi {
  /** The server's offer for this viewer; the view is derived from it (`deriveRematchView`). */
  offer: RematchOffer | null;
  error: ErrorCode | null;
  request: () => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  withdraw: () => Promise<void>;
  /** On a `rematch` poke: read the offer again, and follow an accepted request. */
  refresh: () => Promise<void>;
}

/** While the window is open or a request is out, the offer is re-read this often (presence changes send no poke). */
const REFRESH_MS = 5_000;

async function readOffer(matchId: string): Promise<RematchOffer | null> {
  try {
    const res = await fetch(`/api/match/${matchId}/state`, { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { rematch?: RematchOffer }).rematch ?? null;
  } catch {
    return null;
  }
}

function stillMoving(offer: RematchOffer | null, nowMs: number): boolean {
  if (!offer) return true;
  return offer.request?.status === "pending" || (offer.request === null && Date.parse(offer.windowEndsAt) > nowMs);
}

/**
 * Spec 071 (R9): the rematch for the result screen. The server decides everything (the window,
 * presence, one request, 30s); this hook holds its answer and sends the four commands.
 */
export function useRematchNegotiation({ matchId, viewerId, active, initialOffer, onNewMatch }: RematchOptions): RematchApi {
  const [offer, setOffer] = useState<RematchOffer | null>(initialOffer);
  const [error, setError] = useState<ErrorCode | null>(null);
  const offerRef = useRef(offer);
  const onNewMatchRef = useRef(onNewMatch);
  useEffect(() => {
    offerRef.current = offer;
  }, [offer]);
  useEffect(() => {
    onNewMatchRef.current = onNewMatch;
  }, [onNewMatch]);

  const refresh = useCallback(async () => {
    const next = await readOffer(matchId);
    if (!next) return;
    setOffer(next);
    if (next.request?.status === "accepted" && next.request.newMatchId) onNewMatchRef.current(next.request.newMatchId);
  }, [matchId]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (stillMoving(offerRef.current, Date.now())) void refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [active, refresh]);

  // A request that is still ours when the room goes away is withdrawn (FR-012).
  useEffect(
    () => () => {
      const pending = offerRef.current?.request;
      if (pending?.status === "pending" && pending.requesterId === viewerId) withdrawRematchAction(matchId).catch(() => undefined);
    },
    [matchId, viewerId],
  );

  const run = useCallback(
    async (command: () => Promise<{ status: string; matchId?: string }>, failure: ErrorCode) => {
      setError(null);
      try {
        const result = await command();
        if (result.status === "accepted" && result.matchId) return onNewMatchRef.current(result.matchId);
        await refresh();
      } catch (e) {
        console.warn("[rematch] command failed", e);
        setError(failure);
      }
    },
    [refresh],
  );

  const request = useCallback(() => run(() => requestRematchAction(matchId), "rematch_failed"), [run, matchId]);
  const accept = useCallback(() => run(() => acceptRematchAction(matchId), "accept_failed"), [run, matchId]);
  const decline = useCallback(() => run(() => declineRematchAction(matchId), "rematch_failed"), [run, matchId]);
  const withdraw = useCallback(() => run(() => withdrawRematchAction(matchId), "rematch_failed"), [run, matchId]);

  return { offer, error, request, accept, decline, withdraw, refresh };
}
