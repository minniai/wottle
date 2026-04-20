"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";

import { BoardGrid } from "@/components/game/BoardGrid";
import { PlayerPanel } from "@/components/match/PlayerPanel";
import { RoundHistoryPanel } from "@/components/match/RoundHistoryPanel";
import { TilesClaimedCard } from "@/components/match/TilesClaimedCard";
import type { ScoreDelta } from "@/components/match/ScoreDeltaPopup";
import { deriveScoreDelta } from "@/components/match/deriveScoreDelta";
import { deriveHighlightPlayerColors } from "@/components/match/deriveHighlightPlayerColors";
import { deriveRoundHistory } from "@/components/match/deriveRoundHistory";
import { deriveRevealSequence } from "@/lib/match/revealSequence";
import { deriveBiggestSwing, deriveHighestScoringWord } from "@/components/match/deriveCallouts";
import type { WordHistoryRow, ScoreboardRow } from "@/components/match/FinalSummary";
import type { MatchPlayerProfiles, MatchState, TimerState, Coordinate } from "@/lib/types/match";
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
  playerProfiles: MatchPlayerProfiles;
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
  playerProfiles,
  pollIntervalMs = 3_000,
}: MatchClientProps) {
  const router = useRouter();
  const [matchState, setMatchState] = useState<MatchState>(initialState);
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

  // Animation phase machine for post-round combined recap flash
  type AnimationPhase = "idle" | "round-recap";
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>("idle");
  const [highlightPlayerColors, setHighlightPlayerColors] = useState<Record<string, string>>({});
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tracks the last summary id that triggered the recap animation (prevents double-fire). */
  const lastAnimatedRoundRef = useRef<string | null>(null);
  const accumulatedRoundsRef = useRef<Set<number>>(new Set());
  const prefersReducedMotionRef = useRef(
    typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // Round announce overlay
  const [roundAnnounce, setRoundAnnounce] = useState<string | null>(null);
  const roundAnnounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnnouncedRoundRef = useRef<number>(0);

  /** Ref so the safety-net poller always reads the freshest round. */
  const matchStateRef = useRef(matchState);
  useEffect(() => {
    matchStateRef.current = matchState;
  }, [matchState]);

  /** Apply a server snapshot into local state, preserving lastSummary and non-zero scores. */
  const applySnapshot = useCallback((snapshot: MatchState) => {
    setMatchState((prev) => {
      // Preserve accumulated scores when the server snapshot reports zeros
      // (race: round advances before scoreboard_snapshots row is written)
      const prevTotal = prev.scores.playerA + prev.scores.playerB;
      const snapTotal = snapshot.scores.playerA + snapshot.scores.playerB;
      const scores =
        snapTotal === 0 && prevTotal > 0 ? prev.scores : snapshot.scores;

      return {
        ...prev,
        ...snapshot,
        scores,
        lastSummary: snapshot.lastSummary ?? prev.lastSummary,
      };
    });
  }, []);

  /**
   * Show round announce overlay. `nextRound` is the upcoming round number.
   * Deduplicates by round number so multiple triggers for the same round are no-ops.
   */
  const showRoundAnnounce = useCallback((nextRound: number, isCompleted: boolean) => {
    const isFinal = isCompleted || nextRound > 10;
    // Use negative value for "completed" to distinguish from normal rounds in dedup
    const dedup = isFinal ? -1 : nextRound;
    if (lastAnnouncedRoundRef.current === dedup) return;
    lastAnnouncedRoundRef.current = dedup;

    const text = isFinal
      ? "Rounds Complete"
      : nextRound === 10
        ? "Final Round"
        : `Round ${nextRound}`;
    const durationMs = isFinal ? 2400 : 1200;

    setRoundAnnounce(text);
    if (roundAnnounceTimerRef.current) clearTimeout(roundAnnounceTimerRef.current);
    roundAnnounceTimerRef.current = setTimeout(() => {
      setRoundAnnounce(null);
    }, durationMs);
  }, []);

  useEffect(() => {
    setMatchState(initialState);
  }, [initialState]);

  // Trigger round-recap animation whenever a new lastSummary arrives (via onState or onSummary).
  // Using lastSummary as the source-of-truth means the animation fires reliably regardless
  // of whether the Realtime "round-summary" broadcast or the "state" broadcast arrives first.
  useEffect(() => {
    if (!matchState.lastSummary) return;
    if (animationPhase === "round-recap") return;

    const nextSummary = matchState.lastSummary;
    const id = `${nextSummary.matchId}-${nextSummary.roundNumber}`;

    if (id === lastAnimatedRoundRef.current) return;

    lastAnimatedRoundRef.current = id;

    // Show round announce overlay (backup — also triggered directly from onSummary callback)
    showRoundAnnounce(nextSummary.roundNumber + 1, matchState.state === "completed");

    const announceDurationMs = (matchState.state === "completed" || nextSummary.roundNumber >= 10) ? 2400 : 1200;

    // Accumulate round history (works regardless of delivery path: onSummary, onState, or poller)
    if (!accumulatedRoundsRef.current.has(nextSummary.roundNumber)) {
      accumulatedRoundsRef.current.add(nextSummary.roundNumber);
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
    }

    // Derive score delta inline (no overlay to wait for)
    setScoreDelta(deriveScoreDelta(nextSummary, currentPlayerId));

    if (prefersReducedMotionRef.current) {
      // Skip highlight animation entirely
      setMoveLocked(false);
      setLockedSwapTiles(null);
      if (matchState.state === "completed" || nextSummary.roundNumber >= 10) {
        setTimeout(() => setFinalRecapDone(true), announceDurationMs);
      }
      return;
    }

    const colors = deriveHighlightPlayerColors(
      nextSummary.words,
      matchState.timers.playerA.playerId,
    );
    setHighlightPlayerColors(colors);

    const sequence = deriveRevealSequence(nextSummary);
    const opponentMove = sequence.orderedMoves.find(
      (m) => m.playerId !== currentPlayerId,
    );
    setActiveRevealMove(opponentMove ? { from: opponentMove.from, to: opponentMove.to } : null);
    setActiveRevealHighlights(nextSummary.highlights);
    setMoveLocked(false);
    setLockedSwapTiles(null);
    setAnimationPhase("round-recap");

    if (nextSummary.highlights.length > 0) playWordDiscovery();

    const isCompleted = matchState.state === "completed" || nextSummary.roundNumber >= 10;

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setAnimationPhase("idle");
      if (isCompleted) setFinalRecapDone(true);
    }, announceDurationMs);
  }, [matchState.lastSummary, matchState.state, animationPhase, currentPlayerId, matchState.timers.playerA.playerId, playWordDiscovery, showRoundAnnounce]);

  // Play match start sound + haptic on mount
  useEffect(() => {
    playMatchStart();
    vibrateMatchStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigate to final summary when match completes — wait for all animations to finish
  const matchEndSoundFiredRef = useRef(false);
  const [finalRecapDone, setFinalRecapDone] = useState(
    // If already completed on mount (page load), skip waiting for recap
    initialState.state === "completed",
  );
  useEffect(() => {
    if (matchState.state !== "completed") return;

    // Play sound/haptic once
    if (!matchEndSoundFiredRef.current) {
      matchEndSoundFiredRef.current = true;
      playMatchEnd();
      vibrateMatchEnd();
    }

    // Wait for recap to start, play, AND finish before navigating.
    // finalRecapDone is set to true only after the recap + announce complete,
    // or immediately if the match was already completed on mount.
    if (!finalRecapDone) {
      // Safety fallback: if the recap timer was cancelled (e.g. channel
      // re-subscribe during the 2.4 s window), force navigation after 5 s
      // so we never get stuck on the match page.
      const fallback = setTimeout(() => setFinalRecapDone(true), 5_000);
      return () => clearTimeout(fallback);
    }

    router.push(`/match/${matchId}/summary`);
  }, [matchId, matchState.state, finalRecapDone, router, playMatchEnd, vibrateMatchEnd]);

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
        // Trigger round announce immediately (before React render cycle)
        showRoundAnnounce(nextSummary.roundNumber + 1, false);

        // Update match state — accumulation + recap animation trigger via the lastSummary useEffect
        // (word/score accumulation is handled exclusively in the lastSummary useEffect
        //  with accumulatedRoundsRef dedup to prevent duplicates)
        setMatchState((prev) => ({
          ...prev,
          scores: nextSummary.totals,
          lastSummary: nextSummary,
        }));
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
    };
  }, [
    matchId,
    usePolling,
    currentPlayerId,
    disconnectedPlayerId,
    applySnapshot,
    showRoundAnnounce,
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

  // Client-side timer tick: decrement displayed time every second
  const [timerTick, setTimerTick] = useState(0);
  const timerSnapshotRef = useRef(Date.now());

  // Reset the tick reference whenever the server sends new timer data
  useEffect(() => {
    setTimerTick(0);
    timerSnapshotRef.current = Date.now();
  }, [currentTimer.remainingMs, currentTimer.status]);

  useEffect(() => {
    if (currentTimer.status !== "running" || currentTimer.remainingMs <= 0) {
      return;
    }
    const id = setInterval(() => {
      const elapsed = Date.now() - timerSnapshotRef.current;
      setTimerTick(elapsed);
    }, 200);
    return () => clearInterval(id);
  }, [currentTimer.status, currentTimer.remainingMs]);

  const timeLeftSeconds = Math.max(
    0,
    Math.floor(
      (currentTimer.remainingMs - (currentTimer.status === "running" ? timerTick : 0)) / 1000,
    ),
  );
  const isPaused = currentTimer.status !== "running";

  // Reset move lock when round advances (US1)
  useEffect(() => {
    setMoveLocked(false);
    setLockedSwapTiles(null);
  }, [matchState.currentRound]);

  // Fallback: announce round when currentRound changes (catches missed summary broadcasts)
  useEffect(() => {
    if (matchState.currentRound <= 1) return;
    showRoundAnnounce(matchState.currentRound, matchState.state === "completed");
  }, [matchState.currentRound, matchState.state, showRoundAnnounce]);

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

  const playerSlot: "player_a" | "player_b" =
    matchState.timers.playerA.playerId === currentPlayerId ? "player_a" : "player_b";

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

  // Client-side opponent timer tick
  const [opponentTick, setOpponentTick] = useState(0);
  const opponentSnapshotRef = useRef(Date.now());

  useEffect(() => {
    setOpponentTick(0);
    opponentSnapshotRef.current = Date.now();
  }, [opponentTimer.remainingMs, opponentTimer.status]);

  useEffect(() => {
    if (opponentTimer.status !== "running" || opponentTimer.remainingMs <= 0) {
      return;
    }
    const id = setInterval(() => {
      const elapsed = Date.now() - opponentSnapshotRef.current;
      setOpponentTick(elapsed);
    }, 200);
    return () => clearInterval(id);
  }, [opponentTimer.status, opponentTimer.remainingMs]);

  const opponentTimeLeft = Math.max(
    0,
    Math.floor(
      (opponentTimer.remainingMs - (opponentTimer.status === "running" ? opponentTick : 0)) / 1000,
    ),
  );

  // Derive in-game round history from accumulated data (US4)
  const playerAId = matchState.timers.playerA.playerId;
  const playerBId = matchState.timers.playerB.playerId;
  const playerADisplayName = playerProfiles.playerA.displayName;
  const playerBDisplayName = playerProfiles.playerB.displayName;

  const roundHistory = useMemo(
    () =>
      deriveRoundHistory(
        accumulatedWords,
        accumulatedScores,
        playerAId,
        playerADisplayName,
        playerBId,
        playerBDisplayName,
      ),
    [accumulatedWords, accumulatedScores, playerAId, playerBId, playerADisplayName, playerBDisplayName],
  );

  const usernameMap = useMemo(
    () => ({ [playerAId]: playerADisplayName, [playerBId]: playerBDisplayName }),
    [playerAId, playerBId, playerADisplayName, playerBDisplayName],
  );
  const completedRounds = useMemo(
    () => accumulatedScores.map((s) => s.roundNumber),
    [accumulatedScores],
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
        {/* Desktop: left panel (current player) */}
        <div className="match-layout__panel match-layout__panel--left flex flex-col gap-3">
          <PlayerPanel
            player={playerSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB}
            gameState={{
              score: playerScore,
              timerSeconds: timeLeftSeconds,
              isPaused,
              hasSubmitted: currentTimer.status === "paused",
              currentRound: matchState.currentRound,
              totalRounds: 10,
              playerColor: getPlayerColors(playerSlot).hex,
            }}
            controls={{
              scoreDelta,
              scoreDeltaRound: matchState.lastSummary?.roundNumber,
              roundHistoryCount: roundHistory.length,
              onHistoryToggle: () => setHistoryOpen((v) => !v),
              onResign: () => setShowResignDialog(true),
              resignDisabled:
                matchState.state === "resolving" ||
                matchState.state === "completed" ||
                isResigning,
            }}
            roundHistory={{
              playerId: currentPlayerId,
              accumulatedWords,
              completedRounds,
            }}
            variant="full"
            isDisconnected={matchState.disconnectedPlayerId === currentPlayerId}
          />
          <TilesClaimedCard
            frozenTiles={matchState.frozenTiles ?? {}}
            currentPlayerSlot={playerSlot}
          />
        </div>

        {/* Board area */}
        <div className="match-layout__board">
          {/* Mobile: compact opponent bar */}
          <div className="match-layout__compact-top" data-testid="game-chrome-opponent">
            <PlayerPanel
              player={opponentSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB}
              gameState={{
                score: opponentScore,
                timerSeconds: opponentTimeLeft,
                isPaused: opponentTimer.status !== "running",
                hasSubmitted: opponentTimer.status === "paused",
                currentRound: matchState.currentRound,
                totalRounds: 10,
                playerColor: getPlayerColors(opponentSlot).hex,
              }}
              variant="compact"
              isDisconnected={matchState.disconnectedPlayerId === opponentTimer.playerId}
            />
          </div>

          <BoardGrid
            grid={matchState.board}
            matchId={matchId}
            frozenTiles={matchState.frozenTiles ?? {}}
            playerSlot={playerSlot}
            disabled={moveLocked}
            showLockBanner={false}
            lockedTiles={lockedSwapTiles}
            opponentRevealTiles={
              animationPhase === "round-recap" && activeRevealMove
                ? [activeRevealMove.from, activeRevealMove.to]
                : null
            }
            scoredTileHighlights={
              animationPhase === "round-recap"
                ? activeRevealHighlights
                : []
            }
            highlightPlayerColors={
              animationPhase === "round-recap"
                ? highlightPlayerColors
                : {}
            }
            highlightDurationMs={animationPhase === "round-recap" ? (matchState.state === "completed" ? 2400 : 1200) : 800}
            highlightDelayMs={animationPhase === "round-recap" ? 450 : 0}
            onSwapComplete={handleSwapComplete}
            onSwapError={({ message }) => handleSwapError(message)}
            onTileSelect={playTileSelect}
            onValidSwap={() => { playValidSwap(); vibrateValidSwap(); }}
            onInvalidMove={() => { playInvalidMove(); vibrateInvalidMove(); }}
          />

          {roundAnnounce && (
            <div
              key={`${matchState.currentRound}-${roundAnnounce}`}
              className={`round-announce${roundAnnounce === "Rounds Complete" ? " round-announce--final" : ""}`}
              style={{ position: "absolute", top: "50%", left: "50%", zIndex: 25 }}
              data-testid="round-announce"
            >
              {roundAnnounce}
            </div>
          )}

          {/* Mobile: compact player bar */}
          <div className="match-layout__compact-bottom" data-testid="game-chrome-player">
            <PlayerPanel
              player={playerSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB}
              gameState={{
                score: playerScore,
                timerSeconds: timeLeftSeconds,
                isPaused,
                hasSubmitted: currentTimer.status === "paused",
                currentRound: matchState.currentRound,
                totalRounds: 10,
                playerColor: getPlayerColors(playerSlot).hex,
              }}
              variant="compact"
            />
          </div>

        </div>

        {/* Desktop: right panel (opponent) */}
        <div className="match-layout__panel match-layout__panel--right">
          <PlayerPanel
            player={opponentSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB}
            gameState={{
              score: opponentScore,
              timerSeconds: opponentTimeLeft,
              isPaused: opponentTimer.status !== "running",
              hasSubmitted: opponentTimer.status === "paused",
              currentRound: matchState.currentRound,
              totalRounds: 10,
              playerColor: getPlayerColors(opponentSlot).hex,
            }}
            roundHistory={{
              playerId: opponentTimer.playerId,
              accumulatedWords,
              completedRounds,
            }}
            variant="full"
            isDisconnected={matchState.disconnectedPlayerId === opponentTimer.playerId}
          />
        </div>
      </div>

      {showDebug && (
        <details
          className="mt-4 rounded-lg border border-hair bg-paper-2 p-3 text-xs text-ink-soft"
          data-testid="debug-metadata"
        >
          <summary className="cursor-pointer text-ink-soft">
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
            className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-hair bg-paper p-4 shadow-2xl sm:rounded-2xl"
            role="dialog"
            aria-label="Round history"
            data-testid="history-overlay"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Round History</h2>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-ink-soft transition hover:bg-paper-2 hover:text-ink"
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
            className="w-full max-w-sm rounded-2xl border border-hair bg-paper p-6 shadow-2xl"
            role="alertdialog"
            aria-label="Confirm resignation"
            data-testid="resign-dialog"
          >
            <h2 className="text-lg font-semibold text-ink">
              Resign?
            </h2>
            <p className="mt-2 text-sm text-ink-3">
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
                className="rounded-xl border border-hair-strong px-4 py-2 text-sm text-ink transition hover:bg-paper-2"
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

