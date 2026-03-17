"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cancelRematchAction } from "@/app/actions/match/cancelRematch";
import { requestRematchAction } from "@/app/actions/match/requestRematch";
import {
  acceptRematchAction,
  declineRematchAction,
} from "@/app/actions/match/respondToRematch";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { subscribeToMatchChannel } from "@/lib/realtime/matchChannel";
import type { RematchEvent } from "@/lib/types/match";

export type RematchPhase =
  | "idle"
  | "requesting"
  | "waiting"
  | "incoming"
  | "accepted"
  | "declined"
  | "expired"
  | "interstitial";

const TIMEOUT_MS = 30_000;
const INTERSTITIAL_MS = 500;

export interface UseRematchNegotiationResult {
  phase: RematchPhase;
  requestRematch: () => void;
  acceptRematch: () => void;
  declineRematch: () => void;
  newMatchId: string | null;
  requesterName: string | null;
  error: string | null;
}

export function useRematchNegotiation(
  matchId: string,
  currentPlayerId: string,
  opponentDisplayName: string,
): UseRematchNegotiationResult {
  const router = useRouter();
  const [phase, setPhase] = useState<RematchPhase>("idle");
  const [newMatchId, setNewMatchId] = useState<string | null>(null);
  const [requesterName, setRequesterName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interstitialRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof subscribeToMatchChannel> | null>(null);
  const phaseRef = useRef<RematchPhase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (interstitialRef.current) {
      clearTimeout(interstitialRef.current);
      interstitialRef.current = null;
    }
  }, []);

  const startInterstitial = useCallback(
    (targetMatchId: string) => {
      setPhase("interstitial");
      setNewMatchId(targetMatchId);
      interstitialRef.current = setTimeout(() => {
        router.push(`/match/${targetMatchId}`);
      }, INTERSTITIAL_MS);
    },
    [router],
  );

  // Subscribe to rematch events on the match channel
  useEffect(() => {
    const client = getBrowserSupabaseClient();
    const channel = subscribeToMatchChannel(client, matchId, {
      onRematchEvent: (event: RematchEvent) => {
        // Ignore events from ourselves
        if (event.requesterId === currentPlayerId) {
          if (event.type === "rematch-accepted" && event.newMatchId) {
            clearTimers();
            startInterstitial(event.newMatchId);
          }
          if (event.type === "rematch-declined") {
            clearTimers();
            setPhase("declined");
          }
          if (event.type === "rematch-expired") {
            clearTimers();
            setPhase("expired");
            setTimeout(() => router.push("/"), 2000);
          }
          return;
        }

        // Events from opponent
        if (event.type === "rematch-request") {
          setRequesterName(opponentDisplayName);
          setPhase("incoming");
        }
        if (event.type === "rematch-accepted" && event.newMatchId) {
          clearTimers();
          startInterstitial(event.newMatchId);
        }
        if (event.type === "rematch-declined") {
          clearTimers();
          setPhase("declined");
        }
        if (event.type === "rematch-expired") {
          clearTimers();
          setPhase("expired");
          setTimeout(() => router.push("/"), 2000);
        }
      },
    });

    channelRef.current = channel;

    return () => {
      clearTimers();
      channel.unsubscribe();
      // FR-018: cancel pending request when requester navigates away
      if (phaseRef.current === "waiting") {
        cancelRematchAction(matchId).catch(() => {
          // Fire-and-forget; ignore errors on unmount
        });
      }
    };
  }, [matchId, currentPlayerId, opponentDisplayName, clearTimers, startInterstitial, router]);

  const requestRematch = useCallback(async () => {
    if (phase !== "idle") return;

    setPhase("requesting");
    setError(null);

    try {
      const result = await requestRematchAction(matchId);

      if (result.status === "accepted") {
        // Simultaneous detection — go straight to interstitial
        startInterstitial(result.matchId);
        return;
      }

      setPhase("waiting");

      // Start 30s timeout
      timeoutRef.current = setTimeout(() => {
        setPhase("expired");
        setTimeout(() => router.push("/"), 2000);
      }, TIMEOUT_MS);
    } catch (err) {
      setPhase("idle");
      setError(
        err instanceof Error ? err.message : "Unable to request rematch.",
      );
    }
  }, [phase, matchId, startInterstitial, router]);

  const acceptRematch = useCallback(async () => {
    if (phase !== "incoming") return;

    setPhase("requesting");
    setError(null);

    try {
      const result = await acceptRematchAction(matchId);

      if (result.status === "accepted") {
        startInterstitial(result.matchId);
      } else if (result.status === "expired") {
        setPhase("expired");
        setTimeout(() => router.push("/"), 2000);
      }
    } catch (err) {
      setPhase("incoming");
      setError(
        err instanceof Error ? err.message : "Unable to accept rematch.",
      );
    }
  }, [phase, matchId, startInterstitial, router]);

  const declineRematch = useCallback(async () => {
    if (phase !== "incoming") return;

    setPhase("declined");
    setError(null);

    try {
      await declineRematchAction(matchId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to decline rematch.",
      );
    }
  }, [phase, matchId]);

  return {
    phase,
    requestRematch,
    acceptRematch,
    declineRematch,
    newMatchId,
    requesterName,
    error,
  };
}
