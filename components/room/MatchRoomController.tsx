"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { claimWinAction } from "@/app/actions/match/claimWin";
import { resignMatch } from "@/app/actions/match/resignMatch";
import { triggerTimeoutCheck } from "@/app/actions/match/triggerTimeoutCheck";
import { DisconnectionModal } from "@/components/match/DisconnectionModal";
import { useHapticFeedback } from "@/lib/haptics/useHapticFeedback";
import { usePreferencesStore } from "@/lib/preferences/preferencesStore";
import { RECONNECT_WINDOW_MS_CLIENT } from "@/lib/room/clock";
import { applyLetterSwaps } from "@/lib/room/displayBoard";
import type { LiveState } from "@/lib/room/ledgerRows";
import type { LedgerAction, Notice } from "@/lib/room/ledgerTypes";
import { frozen as frozenNotice, resignConfirm } from "@/lib/room/notices";
import { useRoomStore } from "@/lib/room/roomStore";
import { useSoundEffects } from "@/lib/audio/useSoundEffects";
import type { Coordinate } from "@/lib/types/board";
import type { MatchPlayerProfiles, MatchState } from "@/lib/types/match";
import { Field } from "./Field";
import { MatchRoomView } from "./MatchRoomView";
import { useAccumulatedRounds } from "./hooks/useAccumulatedRounds";
import { useClockTick } from "./hooks/useClockTick";
import { useFieldInteraction } from "./hooks/useFieldInteraction";
import { useMatchTransport } from "./hooks/useMatchTransport";
import { useNotices } from "./hooks/useNotices";

export interface MatchRoomControllerProps {
  initialState: MatchState;
  currentPlayerId: string;
  matchId: string;
  playerProfiles: MatchPlayerProfiles;
  pollIntervalMs?: number;
}

/**
 * The match phase of the room (spec 044). Owns nothing visual: it hydrates the
 * room store, runs transport, and wires the field interaction into bars, field
 * and ledger. Replaces MatchClient.
 */
export function MatchRoomController({ initialState, currentPlayerId, matchId, playerProfiles, pollIntervalMs }: MatchRoomControllerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showDebug = process.env.NODE_ENV !== "production" && searchParams.get("debug") === "1";
  const hydrateMatch = useRoomStore((s) => s.hydrateMatch);
  const match = useRoomStore((s) => s.match) ?? initialState;
  const viewerSlot = useRoomStore((s) => s.viewerSlot) ?? (initialState.timers.playerA.playerId === currentPlayerId ? "player_a" : "player_b");

  useEffect(() => {
    hydrateMatch(initialState, currentPlayerId);
  }, [initialState, currentPlayerId, hydrateMatch]);

  const transport = useMatchTransport(matchId, currentPlayerId, pollIntervalMs);
  const words = useAccumulatedRounds(match);
  const { notices, push, dismiss } = useNotices();
  const clocks = useClockTick(match.timers);
  const sound = useSoundEffects(usePreferencesStore((s) => s.soundEnabled));
  const haptics = useHapticFeedback(usePreferencesStore((s) => s.hapticsEnabled));
  const previewEnabled = usePreferencesStore((s) => s.previewEnabled);

  const opponentSlot = viewerSlot === "player_a" ? "player_b" : "player_a";
  const you = playerProfiles[viewerSlot === "player_a" ? "playerA" : "playerB"];
  const opp = playerProfiles[opponentSlot === "player_a" ? "playerA" : "playerB"];
  const youTimer = match.timers[viewerSlot === "player_a" ? "playerA" : "playerB"];
  const oppTimer = match.timers[opponentSlot === "player_a" ? "playerA" : "playerB"];
  const completed = match.state === "completed";
  const isActive = match.state === "collecting" || match.state === "resolving";

  const opponentPins = useMemo<[Coordinate, Coordinate] | null>(() => {
    const move = match.pendingMoves?.find((m) => m.playerId === oppTimer.playerId);
    return move ? [move.from, move.to] : null;
  }, [match.pendingMoves, oppTimer.playerId]);
  const frozenTiles = useMemo(() => ({ ...(match.frozenTiles ?? {}), ...(match.partialSummary?.frozenTiles ?? {}) }), [match.frozenTiles, match.partialSummary]);
  const frozenKeys = useMemo(() => new Set(Object.keys(frozenTiles)), [frozenTiles]);
  const ownerNames = useMemo(() => ({ player_a: playerProfiles.playerA.displayName, player_b: playerProfiles.playerB.displayName }), [playerProfiles]);

  const onNotice = useCallback(
    (kind: "frozen" | "pinned" | "pickCleared", at?: Coordinate) => {
      if (kind === "pickCleared") return push({ kind: "pickCleared", reason: "opponentPinned" });
      const owner = at ? frozenTiles[`${at.x},${at.y}`]?.owner : undefined;
      push(frozenNotice(owner ? ownerNames[owner] : opp.displayName, match.currentRound));
    },
    [push, frozenTiles, ownerNames, opp.displayName, match.currentRound],
  );
  const onRejected = useCallback((message: string) => push({ kind: "text", text: message.toLowerCase() }), [push]);
  const onCommitted = useCallback(() => {
    sound.playValidSwap();
    haptics.vibrateValidSwap();
  }, [sound, haptics]);

  const field = useFieldInteraction({
    matchId,
    previewEnabled,
    frozenKeys,
    opponentPins,
    canPick: isActive && youTimer.status === "running",
    currentRound: match.currentRound,
    onPick: sound.playTileSelect,
    onCommitted,
    onRejected,
    onNotice,
  });

  const displayBoard = useMemo(() => applyLetterSwaps(match.board, [opponentPins, field.ownPins]), [match.board, opponentPins, field.ownPins]);

  const live: LiveState = useMemo(() => {
    if (match.state === "resolving") return { kind: "resolving" };
    if (youTimer.status === "paused" || field.interaction.kind === "committed") return { kind: "played" };
    if (field.interaction.kind === "picked") {
      const letter = match.board[field.interaction.a.y]?.[field.interaction.a.x] ?? "";
      return { kind: "picking", letter, value: 0 };
    }
    return { kind: "idle" };
  }, [match.state, youTimer.status, field.interaction, match.board]);

  const dualTimeout = match.timers.playerA.remainingMs <= 0 && match.timers.playerB.remainingMs <= 0;
  const timeoutFired = useRef(false);
  useEffect(() => {
    if (dualTimeout && !completed && !timeoutFired.current) {
      timeoutFired.current = true;
      triggerTimeoutCheck(matchId).catch(() => undefined);
    }
  }, [dualTimeout, completed, matchId]);

  const matchEndFired = useRef(false);
  useEffect(() => {
    if (!completed) return;
    if (!matchEndFired.current) {
      matchEndFired.current = true;
      sound.playMatchEnd();
      haptics.vibrateMatchEnd();
    }
    router.push(`/match/${matchId}/summary`);
  }, [completed, matchId, router, sound, haptics]);

  const disconnectedAt = match.disconnectedPlayerId === oppTimer.playerId && isActive ? match.disconnectedAt ?? null : null;
  const reconnectMsLeft = disconnectedAt ? Math.max(0, new Date(disconnectedAt).getTime() + (match.reconnectWindowMs ?? RECONNECT_WINDOW_MS_CLIENT) - Date.now()) : null;

  const handleAction = useCallback(
    (action: LedgerAction) => {
      if (action === "resign" || action === "leave") push(resignConfirm());
      else if (action === "cancelResign") dismiss("resignConfirm");
      else if (action === "confirmResign") {
        dismiss("resignConfirm");
        resignMatch(matchId).catch((e: Error) => push({ kind: "text", text: e.message.toLowerCase() }));
      } else if (action === "claimWin") {
        claimWinAction(matchId).then((r) => r.status !== "ok" && r.status !== "already_completed" && push({ kind: "text", text: r.status.replace("_", " ") }));
      }
    },
    [matchId, push, dismiss],
  );

  const allNotices: Notice[] = [
    ...notices,
    ...(transport.isReconnecting && match.disconnectedPlayerId === currentPlayerId ? [{ kind: "text", text: "reconnecting" } as Notice] : []),
    ...(transport.usePolling && !transport.isReconnecting ? [{ kind: "text", text: "realtime lost · polling" } as Notice] : []),
    ...(dualTimeout && !completed ? [{ kind: "text", text: "both players timed out" } as Notice] : []),
    ...(transport.pollError ? [{ kind: "text", text: transport.pollError } as Notice] : []),
  ];

  return (
    <>
      {disconnectedAt && reconnectMsLeft !== null ? (
        <DisconnectionModal opponentDisplayName={opp.displayName} disconnectedAt={new Date(disconnectedAt).getTime()} windowMs={match.reconnectWindowMs ?? RECONNECT_WINDOW_MS_CLIENT} onClose={() => undefined} onClaimWin={() => handleAction("claimWin")} isClaiming={false} />
      ) : null}
      <MatchRoomView
        matchId={matchId}
        viewerSlot={viewerSlot}
        you={{ name: you.displayName, rating: you.eloRating ?? null, clockMs: clocks[viewerSlot === "player_a" ? "playerA" : "playerB"], running: youTimer.status === "running", score: match.scores[viewerSlot === "player_a" ? "playerA" : "playerB"] }}
        opp={{ name: opp.displayName, rating: opp.eloRating ?? null, clockMs: clocks[opponentSlot === "player_a" ? "playerA" : "playerB"], running: oppTimer.status === "running", score: match.scores[opponentSlot === "player_a" ? "playerA" : "playerB"], reconnectMsLeft }}
        currentRound={match.currentRound}
        completed={completed}
        words={words}
        playerAId={match.timers.playerA.playerId}
        frozenTiles={frozenTiles}
        live={live}
        hint={field.hint}
        notices={allNotices}
        onAction={handleAction}
      >
        <Field
          board={displayBoard}
          frozenTiles={frozenTiles}
          viewerSlot={viewerSlot}
          ownerNames={ownerNames}
          disabled={completed}
          cellStateFor={field.cellStateFor}
          seatFor={field.seatFor}
          shakeAt={field.shakeAt}
          focusAt={field.focusAt}
          onActivate={(at) => field.dispatch({ type: "tap", at })}
          onKeyDown={field.onKeyDown}
        />
      </MatchRoomView>
      {showDebug ? (
        <details className="mt-4 border border-rule p-3 text-xs text-muted" data-testid="debug-metadata">
          <summary className="cursor-pointer">Debug Info</summary>
          <dl className="mt-2 grid grid-cols-2 gap-1">
            <dt>Match ID</dt>
            <dd className="font-mono">{matchId}</dd>
            <dt>Round</dt>
            <dd>{match.currentRound} / 10</dd>
            <dt>Status</dt>
            <dd>{match.state}</dd>
          </dl>
        </details>
      ) : null}
    </>
  );
}
