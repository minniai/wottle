"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";

import { BoardGrid } from "@/components/game/BoardGrid";
import { GameChrome } from "@/components/match/GameChrome";
import { RoundSummaryPanel } from "@/components/match/RoundSummaryPanel";
import { RoundHistoryPanel } from "@/components/match/RoundHistoryPanel";
import type { ScoreDelta } from "@/components/match/ScoreDeltaPopup";
import { deriveScoreDelta } from "@/components/match/deriveScoreDelta";
import { deriveHighlightPlayerColors } from "@/components/match/deriveHighlightPlayerColors";
import { deriveRoundHistory } from "@/components/match/deriveRoundHistory";
import { deriveRevealSequence } from "@/lib/match/revealSequence";
import { deriveBiggestSwing, deriveHighestScoringWord } from "@/components/match/deriveCallouts";
import type { WordHistoryRow, ScoreboardRow } from "@/components/match/FinalSummary";
import type { MatchState, RoundSummary, TimerState, Coordinate } from "@/lib/types/match";
import { getPlayerColors } from "@/lib/constants/playerColors";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { subscribeToMatchChannel } from "@/lib/realtime/matchChannel";
import { handlePlayerDisconnect } from "@/app/actions/match/handleDisconnect";
import { resignMatch } from "@/app/actions/match/resignMatch";
import { triggerTimeoutCheck } from "@/app/actions/match/triggerTimeoutCheck";
import { useSensoryPreferences } from "@/lib/preferences/useSensoryPreferences";
import { useSoundEffects } from "@/lib/audio/useSoundEffects";
import { useHapticFeedback } from "@/lib/haptics/useHapticFeedback";
import { MatchShell } from "./MatchShell";


interface MatchClientProps {
  initialState: MatchState;
  currentPlayerId: string;
  matchId: string;
  pollIntervalMs?: number;
}

const POLL_ENDPOINT = (matchId: string) => `/api/match/${matchId}/state`;

/** Interval for the background safety-net poller (runs alongside Realtime). */
const SAFETY_POLL_INTERVAL_MS = 2_000;

/**
 * Fetch the latest match state from the REST endpoint.
 * Returns `null` on failure so callers can decide how to handle errors.
 */
async function fetchMatchSnapshot(matchId: string): Promise<MatchState | null> {
  try {
    const response = await fetch(POLL_ENDPOINT(matchId), {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as MatchState;
  } catch {
    return null;
  }
}

export function MatchClient({
  initialState,
  currentPlayerId,
  matchId,
  pollIntervalMs = 3_000,
}: MatchClientProps) {
  const router = useRouter();
  const isAutomation =
    typeof navigator !== "undefined" && navigator.webdriver;
  const summaryAutoDismissMs = isAutomation ? 15_000 : 0;
  const [matchState, setMatchState] = useState<MatchState>(initialState);
  const [summary, setSummary] = useState<RoundSummary | null>(
    initialState.lastSummary ?? null,
  );
  /** ID of the summary the player explicitly dismissed — prevents re-flash on safety-poll. */
  const dismissedSummaryIdRef = useRef<string | null>(null);
  const realtimeDisabled =
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_DISABLE_REALTIME === "true";
  const [usePolling, setUsePolling] = useState(realtimeDisabled);
  const [pollError, setPollError] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [scoreDelta, setScoreDelta] = useState<ScoreDelta | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [disconnectedPlayerId, setDisconnectedPlayerId] = useState<
    string | null
  >(null);

  // In-game round history accumulation (US4)
  const [accumulatedWords, setAccumulatedWords] = useState<WordHistoryRow[]>([]);
  const [accumulatedScores, setAccumulatedScores] = useState<ScoreboardRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Sensory preferences, audio, and haptic feedback (US3/US4/US5)
  const { preferences } = useSensoryPreferences();
  const { playTileSelect, playValidSwap, playInvalidMove, playWordDiscovery, playMatchStart, playMatchEnd } =
    useSoundEffects(preferences.soundEnabled);
  const { vibrateValidSwap, vibrateInvalidMove, vibrateMatchStart, vibrateMatchEnd } =
    useHapticFeedback(preferences.hapticsEnabled);

  // Move lock state (US1): after swap, board is locked until next round
  const [moveLocked, setMoveLocked] = useState(false);
  const [lockedSwapTiles, setLockedSwapTiles] = useState<[Coordinate, Coordinate] | null>(null);

  // Sequential reveal state (US1): active player's swap tiles and highlights during reveal phases
  const [activeRevealMove, setActiveRevealMove] = useState<{ from: Coordinate; to: Coordinate } | null>(null);
  const [activeRevealHighlights, setActiveRevealHighlights] = useState<Coordinate[][]>([]);

  // Resign state
  const [showResignDialog, setShowResignDialog] = useState(false);
  const [isResigning, setIsResigning] = useState(false);

  // Animation phase machine for post-round sequential reveal (US1)
  type AnimationPhase = "idle" | "revealing-player-one" | "revealing-player-two" | "showing-summary";
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>("idle");
  const [pendingSummary, setPendingSummary] = useState<RoundSummary | null>(null);
  const [highlightPlayerColors, setHighlightPlayerColors] = useState<Record<string, string>>({});
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotionRef = useRef(
    typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  /** Ref so the safety-net poller always reads the freshest round. */
  const matchStateRef = useRef(matchState);
  useEffect(() => {
    matchStateRef.current = matchState;
  }, [matchState]);

  /** Apply a server snapshot into local state, preserving lastSummary. */
  const applySnapshot = useCallback((snapshot: MatchState) => {
    setMatchState((prev) => ({
      ...prev,
      ...snapshot,
      lastSummary: snapshot.lastSummary ?? prev.lastSummary,
    }));
  }, []);

  useEffect(() => {
    setMatchState(initialState);
  }, [initialState]);

  // Sync summary from polled/realtime state updates.
  // Guard against re-showing a summary the player already dismissed.
  // Also guard while reveal animation is playing — onSummary handles that path.
  useEffect(() => {
    if (!matchState.lastSummary) return;
    if (animationPhase === "revealing-player-one" || animationPhase === "revealing-player-two") return;
    const id = `${matchState.lastSummary.matchId}-${matchState.lastSummary.roundNumber}`;
    if (id !== dismissedSummaryIdRef.current) {
      setSummary(matchState.lastSummary);
    }
  }, [matchState.lastSummary, animationPhase]);

  // Play match start sound + haptic on mount
  useEffect(() => {
    playMatchStart();
    vibrateMatchStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigate to final summary when match completes; play match end sound + haptic
  useEffect(() => {
    if (matchState.state === "completed") {
      playMatchEnd();
      vibrateMatchEnd();
      router.push(`/match/${matchId}/summary`);
    }
  }, [matchId, matchState.state, router, playMatchEnd, vibrateMatchEnd]);

  // ── Realtime channel ──────────────────────────────────────────────
  useEffect(() => {
    if (usePolling) {
      return;
    }

    const client = getBrowserSupabaseClient();
    const channel = subscribeToMatchChannel(client, matchId, {
      onState: (snapshot) => {
        if (snapshot.disconnectedPlayerId) {
          setDisconnectedPlayerId(snapshot.disconnectedPlayerId);
          setIsReconnecting(
            snapshot.disconnectedPlayerId !== currentPlayerId,
          );
        } else if (
          disconnectedPlayerId &&
          snapshot.disconnectedPlayerId === null
        ) {
          setIsReconnecting(false);
          setDisconnectedPlayerId(null);
        }
        applySnapshot(snapshot);
      },
      onSummary: (nextSummary) => {
        const colors = deriveHighlightPlayerColors(
          nextSummary.words,
          matchState.timers.playerA.playerId,
        );
        setHighlightPlayerColors(colors);
        setPendingSummary(nextSummary);
        setMatchState((prev) => ({
          ...prev,
          scores: nextSummary.totals,
          lastSummary: nextSummary,
        }));

        // Accumulate round history for in-game panel (US4)
        const newWords: WordHistoryRow[] = nextSummary.words.map((w) => ({
          roundNumber: nextSummary.roundNumber,
          playerId: w.playerId,
          word: w.word,
          totalPoints: w.totalPoints,
          lettersPoints: w.lettersPoints,
          bonusPoints: w.bonusPoints,
          coordinates: w.coordinates,
        }));
        const newScore: ScoreboardRow = {
          roundNumber: nextSummary.roundNumber,
          playerAScore: nextSummary.totals.playerA,
          playerBScore: nextSummary.totals.playerB,
          playerADelta: nextSummary.deltas.playerA,
          playerBDelta: nextSummary.deltas.playerB,
        };
        setAccumulatedWords((prev) => [...prev, ...newWords]);
        setAccumulatedScores((prev) => [...prev, newScore]);

        if (prefersReducedMotionRef.current) {
          setAnimationPhase("showing-summary");
          setSummary(nextSummary);
          return;
        }

        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);

        const sequence = deriveRevealSequence(nextSummary);

        if (sequence.orderedMoves.length === 0) {
          // No moves — show global highlights briefly before summary
          setActiveRevealMove(null);
          setActiveRevealHighlights(nextSummary.highlights);
          setAnimationPhase("revealing-player-one");
          highlightTimerRef.current = setTimeout(() => {
            setAnimationPhase("showing-summary");
            setSummary(nextSummary);
          }, 700);
          return;
        }

        // Step 1: reveal first submitter's swap + their word highlights
        const firstMove = sequence.orderedMoves[0];
        const firstHighlights = nextSummary.words
          .filter((w) => w.playerId === firstMove.playerId)
          .map((w) => w.coordinates);
        setActiveRevealMove({ from: firstMove.from, to: firstMove.to });
        setActiveRevealHighlights(firstHighlights);
        setMoveLocked(false);
        setLockedSwapTiles(null);
        setAnimationPhase("revealing-player-one");
        if (firstHighlights.length > 0) playWordDiscovery();

        highlightTimerRef.current = setTimeout(() => {
          if (sequence.orderedMoves.length > 1) {
            // Step 2: reveal second submitter's swap + their word highlights
            const secondMove = sequence.orderedMoves[1];
            const secondHighlights = nextSummary.words
              .filter((w) => w.playerId === secondMove.playerId)
              .map((w) => w.coordinates);
            setActiveRevealMove({ from: secondMove.from, to: secondMove.to });
            setActiveRevealHighlights(secondHighlights);
            setAnimationPhase("revealing-player-two");
            if (secondHighlights.length > 0) playWordDiscovery();
            highlightTimerRef.current = setTimeout(() => {
              setAnimationPhase("showing-summary");
              setSummary(nextSummary);
            }, 700);
          } else {
            // Single submission — skip player-two reveal
            setAnimationPhase("showing-summary");
            setSummary(nextSummary);
          }
        }, 700);
      },
      onError: (error) => {
        console.error(
          "[Realtime] Match channel error, enabling polling fallback",
          error,
        );
        setIsReconnecting(true);
        setUsePolling(true);
      },
    });

    channel.on("system", {}, async (payload) => {
      if (
        payload.status === "CLOSED" ||
        payload.status === "CHANNEL_ERROR"
      ) {
        console.warn("[Realtime] Channel closed, marking as reconnecting");
        setIsReconnecting(true);
        setDisconnectedPlayerId(currentPlayerId);
        setUsePolling(true);

        try {
          await handlePlayerDisconnect(matchId, currentPlayerId);
        } catch (error) {
          console.error(
            "[MatchClient] Failed to notify server of disconnect:",
            error,
          );
        }
      }
    });

    return () => {
      channel.unsubscribe();
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [
    matchId,
    usePolling,
    currentPlayerId,
    disconnectedPlayerId,
    applySnapshot,
    matchState.timers.playerA.playerId,
    playWordDiscovery,
  ]);

  // ── Primary polling (only when Realtime is confirmed down) ────────
  useEffect(() => {
    if (!usePolling) {
      return;
    }

    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;

    const poll = async () => {
      const snapshot = await fetchMatchSnapshot(matchId);
      if (!isMounted) return;
      if (snapshot) {
        applySnapshot(snapshot);
        setPollError(null);
      } else {
        setPollError("Connection interrupted. Retrying…");
      }
    };

    poll();
    timer = setInterval(poll, pollIntervalMs);

    return () => {
      isMounted = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [matchId, pollIntervalMs, usePolling, applySnapshot]);

  // ── Background safety-net poller ──────────────────────────────────
  // Runs *always* (even when Realtime is the primary transport) at a
  // slow cadence.  This catches the case where the server-side
  // Realtime broadcast fails silently (e.g. in local act/Docker).
  // It only fetches when the client has not yet seen the round advance
  // that the server already committed.
  useEffect(() => {
    let isMounted = true;

    const safetyPoll = async () => {
      if (!isMounted) return;
      const snapshot = await fetchMatchSnapshot(matchId);
      if (!isMounted || !snapshot) return;

      const current = matchStateRef.current;
      const roundAdvanced = snapshot.currentRound > current.currentRound;
      const matchCompleted =
        snapshot.state === "completed" && current.state !== "completed";

      if (roundAdvanced || matchCompleted) {
        applySnapshot(snapshot);
      }
    };

    const timer = setInterval(safetyPoll, SAFETY_POLL_INTERVAL_MS);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [matchId, applySnapshot]);

  const currentTimer: TimerState = useMemo(() => {
    if (matchState.timers.playerA.playerId === currentPlayerId) {
      return matchState.timers.playerA;
    }
    return matchState.timers.playerB;
  }, [currentPlayerId, matchState.timers.playerA, matchState.timers.playerB]);

  const timeLeftSeconds = Math.max(
    0,
    Math.floor(currentTimer.remainingMs / 1000),
  );
  const isPaused = currentTimer.status !== "running";

  // Reset move lock when round advances (US1)
  useEffect(() => {
    setMoveLocked(false);
    setLockedSwapTiles(null);
  }, [matchState.currentRound]);

  // Dual timeout detection (US4): both players' timers at zero
  const dualTimeoutDetected =
    matchState.timers.playerA.remainingMs <= 0 &&
    matchState.timers.playerB.remainingMs <= 0;

  // Trigger server-side timeout check when dual timeout detected
  const timeoutCheckFiredRef = useRef(false);
  useEffect(() => {
    if (
      dualTimeoutDetected &&
      matchState.state !== "completed" &&
      !timeoutCheckFiredRef.current
    ) {
      timeoutCheckFiredRef.current = true;
      triggerTimeoutCheck(matchId).catch(() => {});
    }
  }, [dualTimeoutDetected, matchState.state, matchId]);

  const handleSummaryDismiss = useCallback(() => {
    setSummary((prev) => {
      if (prev) {
        dismissedSummaryIdRef.current = `${prev.matchId}-${prev.roundNumber}`;
      }
      return null;
    });
    setAnimationPhase("idle");
    setPendingSummary(null);
    setHighlightPlayerColors({});
  }, []);

  const playerSlot: "player_a" | "player_b" =
    matchState.timers.playerA.playerId === currentPlayerId ? "player_a" : "player_b";

  // Derive score delta popup data from the latest round summary.
  useEffect(() => {
    if (!summary) {
      setScoreDelta(null);
      return;
    }
    setScoreDelta(deriveScoreDelta(summary, currentPlayerId));
  }, [summary, currentPlayerId, playerSlot]);

  const handleSwapComplete = useCallback(
    ({ move }: { move: { from: Coordinate; to: Coordinate } }) => {
      setSwapError(null);
      setMoveLocked(true);
      setLockedSwapTiles([move.from, move.to]);
    },
    [],
  );

  const handleSwapError = useCallback((message: string) => {
    setSwapError(message);
  }, []);

  const handleResignConfirm = useCallback(async () => {
    setIsResigning(true);
    try {
      await resignMatch(matchId);
      setShowResignDialog(false);
    } catch (e) {
      setSwapError(
        e instanceof Error ? e.message : "Failed to resign.",
      );
      setShowResignDialog(false);
    } finally {
      setIsResigning(false);
    }
  }, [matchId]);

  // Derive opponent timer
  const opponentTimer: TimerState = useMemo(() => {
    if (matchState.timers.playerA.playerId === currentPlayerId) {
      return matchState.timers.playerB;
    }
    return matchState.timers.playerA;
  }, [currentPlayerId, matchState.timers.playerA, matchState.timers.playerB]);

  const opponentSlot: "player_a" | "player_b" =
    playerSlot === "player_a" ? "player_b" : "player_a";

  const playerScore =
    playerSlot === "player_a"
      ? matchState.scores.playerA
      : matchState.scores.playerB;
  const opponentScore =
    opponentSlot === "player_a"
      ? matchState.scores.playerA
      : matchState.scores.playerB;

  const opponentTimeLeft = Math.max(
    0,
    Math.floor(opponentTimer.remainingMs / 1000),
  );

  // Derive in-game round history from accumulated data (US4)
  const playerAId = matchState.timers.playerA.playerId;
  const playerBId = matchState.timers.playerB.playerId;
  const roundHistory = useMemo(
    () =>
      deriveRoundHistory(
        accumulatedWords,
        accumulatedScores,
        playerAId,
        playerAId,
        playerBId,
        playerBId,
      ),
    [accumulatedWords, accumulatedScores, playerAId, playerBId],
  );

  const usernameMap = useMemo(
    () => ({ [playerAId]: playerAId, [playerBId]: playerBId }),
    [playerAId, playerBId],
  );
  const biggestSwing = useMemo(() => deriveBiggestSwing(accumulatedScores), [accumulatedScores]);
  const highestWord = useMemo(() => deriveHighestScoringWord(accumulatedWords, usernameMap), [accumulatedWords, usernameMap]);

  const historyOverlayRef = useRef<HTMLDivElement>(null);

  // Dismiss overlay on Escape key
  useEffect(() => {
    if (!historyOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHistoryOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [historyOpen]);

  // Dismiss overlay on outside click
  useEffect(() => {
    if (!historyOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        historyOverlayRef.current &&
        !historyOverlayRef.current.contains(e.target as Node)
      ) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [historyOpen]);

  const searchParams = useSearchParams();
  const showDebug =
    process.env.NODE_ENV !== "production" &&
    searchParams.get("debug") === "1";

  return (
    <MatchShell matchId={matchId}>
      {isReconnecting && (
        <div
          className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200"
          data-testid="reconnect-banner"
        >
          {disconnectedPlayerId === currentPlayerId
            ? "Reconnecting... Please wait."
            : "Opponent disconnected. Waiting for reconnection..."}
        </div>
      )}

      {usePolling && !isReconnecting && (
        <div
          className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200"
          data-testid="polling-fallback-banner"
        >
          Realtime connection lost. Falling back to polling updates.
        </div>
      )}

      {dualTimeoutDetected && matchState.state !== "completed" && (
        <div
          className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-center text-sm font-semibold text-red-200"
          data-testid="dual-timeout-overlay"
        >
          Both players timed out
        </div>
      )}

      {(pollError || swapError) && (
        <div
          className="mt-2 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-200"
          data-testid="round-alert"
        >
          {swapError ?? pollError}
        </div>
      )}

      <div className="match-layout">
        {/* Board area */}
        <div className="match-layout__board">
          <GameChrome
            position="opponent"
            playerName={opponentTimer.playerId}
            score={opponentScore}
            timerSeconds={opponentTimeLeft}
            isPaused={opponentTimer.status !== "running"}
            hasSubmitted={opponentTimer.status === "paused"}
            moveCounter={matchState.currentRound}
            playerColor={getPlayerColors(opponentSlot).hex}
          />

          <BoardGrid
            grid={matchState.board}
            matchId={matchId}
            frozenTiles={matchState.frozenTiles ?? {}}
            playerSlot={playerSlot}
            disabled={moveLocked}
            showLockBanner={moveLocked}
            lockedTiles={lockedSwapTiles}
            opponentRevealTiles={
              (animationPhase === "revealing-player-one" || animationPhase === "revealing-player-two") && activeRevealMove
                ? [activeRevealMove.from, activeRevealMove.to]
                : null
            }
            scoredTileHighlights={
              (animationPhase === "revealing-player-one" || animationPhase === "revealing-player-two")
                ? activeRevealHighlights
                : []
            }
            highlightPlayerColors={
              (animationPhase === "revealing-player-one" || animationPhase === "revealing-player-two")
                ? highlightPlayerColors
                : {}
            }
            highlightDurationMs={800}
            onSwapComplete={handleSwapComplete}
            onSwapError={({ message }) => handleSwapError(message)}
            onTileSelect={playTileSelect}
            onValidSwap={() => { playValidSwap(); vibrateValidSwap(); }}
            onInvalidMove={() => { playInvalidMove(); vibrateInvalidMove(); }}
          />

          <GameChrome
            position="player"
            playerName={currentTimer.playerId}
            score={playerScore}
            timerSeconds={timeLeftSeconds}
            isPaused={isPaused}
            hasSubmitted={currentTimer.status === "paused"}
            moveCounter={matchState.currentRound}
            playerColor={getPlayerColors(playerSlot).hex}
            scoreDelta={scoreDelta}
            scoreDeltaRound={summary?.roundNumber}
            roundHistoryCount={roundHistory.length}
            onHistoryToggle={() => setHistoryOpen((v) => !v)}
            onResign={() => setShowResignDialog(true)}
            resignDisabled={
              matchState.state === "resolving" ||
              matchState.state === "completed" ||
              isResigning
            }
          />
        </div>

        {/* Round summary — right of board on >=900px, below on smaller.
             Container always rendered to reserve layout space (no shift). */}
        <div className="match-layout__summary">
          {animationPhase !== "revealing-player-one" && animationPhase !== "revealing-player-two" && summary && (
            <RoundSummaryPanel
              summary={summary}
              currentPlayerId={currentPlayerId}
              playerAId={playerAId}
              onDismiss={handleSummaryDismiss}
              autoDismissMs={summaryAutoDismissMs}
            />
          )}
        </div>
      </div>

      {showDebug && (
        <details
          className="mt-4 rounded-lg border border-white/10 bg-slate-900/50 p-3 text-xs text-white/60"
          data-testid="debug-metadata"
        >
          <summary className="cursor-pointer text-white/40">
            Debug Info
          </summary>
          <dl className="mt-2 grid grid-cols-2 gap-1">
            <dt>Match ID</dt>
            <dd className="font-mono">{matchId}</dd>
            <dt>Round</dt>
            <dd>{matchState.currentRound} / 10</dd>
            <dt>Status</dt>
            <dd>{matchState.state}</dd>
            <dt>Player A</dt>
            <dd className="font-mono">
              {matchState.timers.playerA.playerId}
            </dd>
            <dt>Player B</dt>
            <dd className="font-mono">
              {matchState.timers.playerB.playerId}
            </dd>
          </dl>
        </details>
      )}

      {historyOpen && roundHistory.length > 0 && createPortal(
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center"
          data-testid="history-overlay-backdrop"
        >
          <div
            ref={historyOverlayRef}
            className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl sm:rounded-2xl"
            role="dialog"
            aria-label="Round history"
            data-testid="history-overlay"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Round History</h2>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Close round history"
                data-testid="history-close"
              >
                Close
              </button>
            </div>
            <RoundHistoryPanel
              rounds={roundHistory}
              playerAUsername={playerAId}
              playerBUsername={playerBId}
              scores={accumulatedScores}
              wordHistory={accumulatedWords}
              biggestSwing={biggestSwing}
              highestWord={highestWord}
            />
          </div>
        </div>,
        document.body,
      )}
      {showResignDialog && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          data-testid="resign-dialog-backdrop"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
            role="alertdialog"
            aria-label="Confirm resignation"
            data-testid="resign-dialog"
          >
            <h2 className="text-lg font-semibold text-white">
              Resign?
            </h2>
            <p className="mt-2 text-sm text-white/70">
              Are you sure you want to resign? Your opponent will win.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleResignConfirm}
                disabled={isResigning}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-400 disabled:opacity-50"
                data-testid="resign-confirm"
              >
                {isResigning ? "Resigning..." : "Yes, Resign"}
              </button>
              <button
                type="button"
                onClick={() => setShowResignDialog(false)}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                data-testid="resign-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </MatchShell>
  );
}

