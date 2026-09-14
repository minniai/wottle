"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";

import { BoardGrid } from "@/components/game/BoardGrid";
import { RoundHistoryPanel } from "@/components/match/RoundHistoryPanel";
import { MatchRoomView } from "@/components/room/MatchRoomView";
import type { LiveState } from "@/lib/room/ledgerRows";
import type { LedgerAction, Notice } from "@/lib/room/ledgerTypes";
import { RECONNECT_WINDOW_MS_CLIENT } from "@/lib/room/clock";
import { deriveHighlightPlayerColors } from "@/components/match/deriveHighlightPlayerColors";
import { deriveRoundHistory } from "@/components/match/deriveRoundHistory";
import { deriveRevealSequence } from "@/lib/match/revealSequence";
import {
  buildPartialRevealKey,
  deriveFirstMoverReveal,
  deriveRevealHighlightsFromPartial,
} from "@/lib/match/partialReveal";
import {
  buildCurrentRoundScoredFromPartial,
  buildCurrentRoundScoredFromSummary,
} from "@/lib/match/currentRoundScored";
import { shouldApplySafetySnapshot } from "@/lib/match/safetySnapshot";
import { deriveBiggestSwing, deriveHighestScoringWord } from "@/components/match/deriveCallouts";
import type { WordHistoryRow, ScoreboardRow } from "@/components/match/FinalSummary";
import type { MatchPlayerProfiles, MatchState, TimerState, Coordinate } from "@/lib/types/match";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { subscribeToMatchChannel } from "@/lib/realtime/matchChannel";
import { claimWinAction } from "@/app/actions/match/claimWin";
import { DisconnectionModal } from "@/components/match/DisconnectionModal";
import { handlePlayerDisconnect } from "@/app/actions/match/handleDisconnect";
import { resignMatch } from "@/app/actions/match/resignMatch";
import { triggerTimeoutCheck } from "@/app/actions/match/triggerTimeoutCheck";
import { useSensoryPreferences } from "@/lib/preferences/useSensoryPreferences";
import { useSoundEffects } from "@/lib/audio/useSoundEffects";
import { useHapticFeedback } from "@/lib/haptics/useHapticFeedback";


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

function formatClockMMSS(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [disconnectedPlayerId, setDisconnectedPlayerId] = useState<
    string | null
  >(null);
  /**
   * Mirrors `disconnectedPlayerId` so the Realtime channel useEffect can read
   * the current value without listing it in deps. Listing it caused the channel
   * to be torn down + remounted on every flip; the teardown emits a presence
   * "leave" to the opponent, who then fires `onOpponentLeave` and triggers
   * a cascading round-trip flicker. See discussion under issue #161.
   */
  const disconnectedPlayerIdRef = useRef<string | null>(null);
  useEffect(() => {
    disconnectedPlayerIdRef.current = disconnectedPlayerId;
  }, [disconnectedPlayerId]);
  // Phase 6 — disconnection modal state. disconnectStartedAt anchors the 90s
  // countdown on the wall clock when the opponent first drops.
  const [disconnectStartedAt, setDisconnectStartedAt] = useState<number | null>(
    null,
  );
  const [showDisconnectModal, setShowDisconnectModal] = useState(true);
  const [isClaimingWin, setIsClaimingWin] = useState(false);

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
  // Spec 043 / O-74: the swap lift stays on the swapped tiles until SCORING is
  // revealed for the round (not a fixed timer). Once revealed, BoardGrid
  // promotes scored swap tiles to the current-round mark and fades the rest.
  // Cleared on round advance. This keeps both players' boards consistent: the
  // swap highlight never disappears before the scored words appear.
  const [scoringRevealed, setScoringRevealed] = useState(false);
  const [selectedTile, setSelectedTile] = useState<Coordinate | null>(null);

  // Sequential reveal state (US1): active player's swap tiles and highlights during reveal phases
  const [activeRevealMove, setActiveRevealMove] = useState<{ from: Coordinate; to: Coordinate } | null>(null);
  const [activeRevealHighlights, setActiveRevealHighlights] = useState<Coordinate[][]>([]);

  // Issue #210 — opponent's swap reveal mid-round.
  // `externalSwap` is passed to BoardGrid to drive the FLIP animation when a
  // new opponent pendingMove arrives via state broadcast. Each move's
  // `submittedAt` becomes a stable key so the same move isn't re-animated
  // across re-renders. The "already animated" set is also consulted by the
  // round-recap effect to suppress the duplicate sky-blue glow.
  const [externalSwap, setExternalSwap] = useState<
    { from: Coordinate; to: Coordinate; key: string } | null
  >(null);
  // The opponent's revealed swap tiles, held in the opponent's identity color
  // and click-locked until the round resolves (issue #210 follow-up).
  const [opponentSwapTiles, setOpponentSwapTiles] = useState<
    [Coordinate, Coordinate] | null
  >(null);
  const animatedOpponentMoveKeysRef = useRef<Set<string>>(new Set());
  /**
   * Dedupe key set for instant-scoring partial reveals (spec 042 / O-57).
   * Mirrors `animatedOpponentMoveKeysRef`'s `${playerId}-${submittedAt}` shape
   * so a partial reveal that fires before `lastSummary` arrives suppresses
   * the redundant round-recap animation for the same swap.
   */
  const animatedPartialRevealsRef = useRef<Set<string>>(new Set());

  // Resign state
  const [showResignDialog, setShowResignDialog] = useState(false);
  const [isResigning, setIsResigning] = useState(false);

  // Animation phase machine for post-round combined recap flash
  type AnimationPhase = "idle" | "round-recap";
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>("idle");
  const [highlightPlayerColors, setHighlightPlayerColors] = useState<Record<string, string>>({});
  // Spec 043 (US1): persistent "scored THIS round" tile→color map. Fed by both
  // the lastSummary recap and the spec-042 partial reveal; held until the round
  // advances (cleared in the round-reset effect) so current-round scored tiles
  // stay visually distinct from previously-frozen tiles.
  const [currentRoundScored, setCurrentRoundScored] = useState<Record<string, string>>({});
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

  // Sync the matchState's disconnectedPlayerId (which can be set by Realtime
  // onState OR by polling via applySnapshot) into the dedicated state field
  // that the modal and reconnect UI read from. The Realtime onState handler
  // also calls setDisconnectedPlayerId directly, but polling paths don't —
  // this effect closes the gap so the modal renders even when Realtime is
  // unavailable.
  useEffect(() => {
    const fromSnapshot = matchState.disconnectedPlayerId ?? null;
    setDisconnectedPlayerId((prev) => (prev === fromSnapshot ? prev : fromSnapshot));
    if (fromSnapshot && fromSnapshot !== currentPlayerId) {
      setIsReconnecting(false);
    }
  }, [matchState.disconnectedPlayerId, currentPlayerId]);

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

    // Spec 043 (US1) — merge this round's scored tiles into the persistent
    // current-round mark BEFORE the reduced-motion branch so the mark applies
    // in both motion modes (the CSS provides a static reduced-motion ring).
    // Additive + dedupe-safe: the partial reveal may have already added the
    // first mover's tiles; re-adding the same key with the same color is a
    // no-op (FR-011). Cleared on round advance (FR-009/FR-012).
    if (nextSummary.words.length > 0) {
      const scored = buildCurrentRoundScoredFromSummary(
        nextSummary,
        matchState.timers.playerA.playerId,
      );
      setCurrentRoundScored((prev) => ({ ...prev, ...scored }));
    }
    // O-74: scoring is now revealed for the round — swap lifts may transition
    // (scored tiles promote, unscored fade). Set even for zero-word rounds so
    // unscored swap tiles still fade on resolution.
    setScoringRevealed(true);

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
    // Issue #210 — if the opponent's move was already animated mid-round
    // via the externalSwap pipeline, suppress the recap's sky-blue glow on
    // those tiles so the player doesn't see the same swap twice. Highlights
    // and the summary popup still play normally.
    const opponentMoveKey = opponentMove
      ? `${opponentMove.playerId}-${opponentMove.submittedAt}`
      : null;
    const opponentMoveAlreadyAnimated =
      opponentMoveKey !== null &&
      animatedOpponentMoveKeysRef.current.has(opponentMoveKey);
    setActiveRevealMove(
      opponentMoveAlreadyAnimated || !opponentMove
        ? null
        : { from: opponentMove.from, to: opponentMove.to },
    );
    setActiveRevealHighlights(nextSummary.highlights);
    // Intentionally keep moveLocked / lockedSwapTiles set through the whole
    // round-recap window. Clearing them here races with the `state` broadcast
    // that carries the post-swap board: when `round-summary` arrives first,
    // unlocking immediately makes BoardGrid re-sync its optimistic grid to
    // the stale pre-swap `grid` prop for a split second before the post-swap
    // state lands. Unlocking after announceDurationMs (below) ensures the
    // new matchState.board has settled before the grid sync runs.
    setAnimationPhase("round-recap");

    if (nextSummary.highlights.length > 0) playWordDiscovery();

    const isCompleted = matchState.state === "completed" || nextSummary.roundNumber >= 10;

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setAnimationPhase("idle");
      setMoveLocked(false);
      setLockedSwapTiles(null);
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
      presenceKey: currentPlayerId,
      onState: (snapshot) => {
        if (snapshot.disconnectedPlayerId) {
          setDisconnectedPlayerId(snapshot.disconnectedPlayerId);
          setIsReconnecting(
            snapshot.disconnectedPlayerId !== currentPlayerId,
          );
        } else if (
          disconnectedPlayerIdRef.current &&
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
      // Opponent's WebSocket dropped (tab close, crash, network drop). Supabase
      // Realtime emits a presence "leave" to every other subscriber, so the
      // surviving client (us) is responsible for telling the server — the
      // disconnecting client can't be trusted to fire a fetch on its way out.
      onOpponentLeave: ({ playerId: opponentId }) => {
        setDisconnectedPlayerId(opponentId);
        void handlePlayerDisconnect(matchId, opponentId).catch((error) => {
          console.error(
            "[MatchClient] Failed to notify server of opponent disconnect:",
            error,
          );
        });
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
      // Use removeChannel (not just unsubscribe) so the server-side join state
      // for `match:${matchId}` is fully released. Plain unsubscribe leaves the
      // channel cached on the SupabaseClient, and a re-subscribe (e.g. React
      // StrictMode double-mount in dev) collides with the prior server-side
      // join — the second subscribe stalls at TIMED_OUT and presence never
      // joins, so opponent-leave events never fire.
      void client.removeChannel(channel);
    };
  }, [
    matchId,
    usePolling,
    currentPlayerId,
    applySnapshot,
    showRoundAnnounce,
    matchState.timers.playerA.playerId,
    playWordDiscovery,
  ]);

  // ── pagehide → sendBeacon disconnect notification ────────────────
  // Best-effort: tells the server "I'm leaving" before the tab dies. Note that
  // some test runners (e.g. Playwright `BrowserContext.close()`) force-kill
  // the page without firing pagehide, so detection ALSO falls back to the
  // server-side heartbeat staleness check in `loadMatchState`.
  useEffect(() => {
    const notifyDisconnect = () => {
      if (typeof navigator === "undefined" || !navigator.sendBeacon) {
        return;
      }
      navigator.sendBeacon(`/api/match/${matchId}/disconnect`);
    };
    window.addEventListener("pagehide", notifyDisconnect);
    return () => {
      window.removeEventListener("pagehide", notifyDisconnect);
    };
  }, [matchId]);

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

      // Applies on round advance, match completion, disconnect flips, and
      // mid-round instant-scoring changes (frozen tiles / partial summary) —
      // each is a broadcast-carried signal the client can't recover from
      // when Realtime delivery fails silently.
      if (shouldApplySafetySnapshot(matchStateRef.current, snapshot)) {
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
    // O-74 — a new round starts with no scoring revealed, so the next swap's
    // lift shows until that round's scoring lands.
    setScoringRevealed(false);
    // Issue #210 — drop the externally-driven swap, the persistent opponent-
    // color tiles, and forget which opponent moves were animated; the next
    // round starts with a clean slate.
    setExternalSwap(null);
    setOpponentSwapTiles(null);
    animatedOpponentMoveKeysRef.current = new Set();
    // Spec 042 — drop the partial-reveal dedupe set so a new round can fire
    // its own first-mover animation without colliding with the prior round's key.
    animatedPartialRevealsRef.current = new Set();
    // Spec 043 (US1) — clear the current-round scored mark so this round's
    // freshly-scored tiles settle into the calm frozen tint and only the NEW
    // round's scored tiles carry the bright mark (FR-009).
    setCurrentRoundScored({});
  }, [matchState.currentRound]);

  // ── Instant scoring partial reveal (spec 042 / Linear O-57) ────────────
  // When the server's fast-path scoring lands during `collecting`, the
  // `state` broadcast carries a `partialSummary` for the first mover's
  // words. We animate the highlights + play the discovery sound once per
  // unique `(firstMoverId, firstSubmissionAt)` pair so a repeated broadcast
  // (or a polling-fallback poll) doesn't re-fire the animation.
  //
  // We also seed `animatedOpponentMoveKeysRef` with the same key so when
  // the eventual `lastSummary` for this round arrives, the existing
  // opponent-move suppression skips re-animating the first mover's swap.
  useEffect(() => {
    const partial = matchState.partialSummary;
    if (!partial) return;
    if (partial.words.length === 0) return; // defensive — fast path returns "no-score" instead

    const key = buildPartialRevealKey(partial);
    if (animatedPartialRevealsRef.current.has(key)) return;
    animatedPartialRevealsRef.current.add(key);
    animatedOpponentMoveKeysRef.current.add(key);

    // O-58 / O-68 — the opponent's board is the pre-swap snapshot, so apply the
    // first mover's swap here (the #210 externalSwap path is suppressed above via
    // the shared dedupe key) so the revealed scored word shows the post-swap
    // letters rather than the original ones.
    const reveal = deriveFirstMoverReveal(
      partial,
      matchState.pendingMoves,
      currentPlayerId,
    );
    if (reveal) {
      setExternalSwap(reveal);
      setOpponentSwapTiles([reveal.from, reveal.to]);
    }

    const colors = deriveHighlightPlayerColors(
      partial.words,
      matchState.timers.playerA.playerId,
    );
    setHighlightPlayerColors((prev) => ({ ...prev, ...colors }));
    // Spec 043 (US1) — persist the first mover's scored tiles as current-round
    // marks. Same dedupe key as the recap merge, so when `lastSummary` lands
    // these tiles are already present and are not re-flashed/recolored (FR-011).
    setCurrentRoundScored((prev) => ({
      ...prev,
      ...buildCurrentRoundScoredFromPartial(partial, matchState.timers.playerA.playerId),
    }));
    // O-74: first-mover scoring revealed mid-round — swap lifts transition.
    setScoringRevealed(true);
    setActiveRevealHighlights(deriveRevealHighlightsFromPartial(partial));
    setAnimationPhase("round-recap");
    playWordDiscovery();

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      // Only revert to idle if the lastSummary recap hasn't taken over by
      // now. `lastAnimatedRoundRef` is set by the lastSummary useEffect on
      // its first run; when set, leave the highlights up so the combined
      // recap continues without flicker.
      setAnimationPhase((prev) => (prev === "round-recap" ? "idle" : prev));
    }, 1200);
  }, [
    matchState.partialSummary,
    matchState.pendingMoves,
    matchState.timers.playerA.playerId,
    currentPlayerId,
    playWordDiscovery,
  ]);

  // Issue #210 — when a state snapshot carries a new opponent pendingMove,
  // surface it to BoardGrid as an externalSwap so the FLIP animates the
  // opponent's swap immediately on the current player's board, and pin the
  // tiles in the opponent's identity color until the round resolves.
  useEffect(() => {
    const opponentPlayerId =
      currentPlayerId === matchState.timers.playerA.playerId
        ? matchState.timers.playerB.playerId
        : matchState.timers.playerA.playerId;
    const opponentMove = matchState.pendingMoves?.find(
      (m) => m.playerId === opponentPlayerId,
    );
    if (!opponentMove) return;
    const key = `${opponentMove.playerId}-${opponentMove.submittedAt}`;
    if (animatedOpponentMoveKeysRef.current.has(key)) return;
    animatedOpponentMoveKeysRef.current.add(key);
    setExternalSwap({
      from: opponentMove.from,
      to: opponentMove.to,
      key,
    });
    setOpponentSwapTiles([opponentMove.from, opponentMove.to]);
  }, [
    matchState.pendingMoves,
    currentPlayerId,
    matchState.timers.playerA.playerId,
    matchState.timers.playerB.playerId,
  ]);

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
      // O-74: the lift persists until scoring is revealed (see `scoringRevealed`).
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

  const handleClaimWin = useCallback(async () => {
    setIsClaimingWin(true);
    try {
      const result = await claimWinAction(matchId);
      if (result.status === "ok" || result.status === "already_completed") {
        // Realtime broadcast will drive both clients to the post-game screen.
        return;
      }
      if (result.status === "too_early") {
        setSwapError(
          `Opponent still has ${Math.ceil(result.remainingMs / 1000)}s to reconnect.`,
        );
      } else if (result.status === "rate_limited") {
        setSwapError(
          `Too many claim attempts. Try again in ${result.retryAfterSeconds}s.`,
        );
      } else if (result.status === "not_disconnected") {
        setSwapError("Your opponent is still connected.");
      } else if (result.status === "forbidden") {
        setSwapError("You are not a participant in this match.");
      } else if (result.status === "unauthenticated") {
        setSwapError("Please log in again.");
      } else if (result.status === "error") {
        setSwapError(result.message);
      }
    } catch (e) {
      setSwapError(
        e instanceof Error ? e.message : "Failed to claim win.",
      );
    } finally {
      setIsClaimingWin(false);
    }
  }, [matchId]);

  // Derive opponent timer
  const opponentTimer: TimerState = useMemo(() => {
    if (matchState.timers.playerA.playerId === currentPlayerId) {
      return matchState.timers.playerB;
    }
    return matchState.timers.playerA;
  }, [currentPlayerId, matchState.timers.playerA, matchState.timers.playerB]);

  // Phase 6 — capture the wall-clock moment the opponent drops so the modal's
  // countdown stays in sync across re-renders. Clears when the opponent
  // reconnects (disconnectedPlayerId flips back to null).
  const opponentDisconnected =
    disconnectedPlayerId !== null &&
    disconnectedPlayerId === opponentTimer.playerId;
  // Only count active play states. `pending`, `completed`, and `abandoned`
  // must never trigger the disconnect modal — match-end navigation triggers
  // a presence "leave" on the opponent's channel which would otherwise flash
  // the modal during the 1-frame window before the completed snapshot
  // commits (see follow-up to issue #161).
  const isMatchActive =
    matchState.state === "collecting" || matchState.state === "resolving";
  useEffect(() => {
    if (!isMatchActive) {
      // Drop any modal state we may have queued — once the match is past
      // active play we never want to open the modal regardless of late
      // disconnect signals.
      if (disconnectStartedAt !== null) setDisconnectStartedAt(null);
      return;
    }
    if (opponentDisconnected && disconnectStartedAt === null) {
      setDisconnectStartedAt(Date.now());
      setShowDisconnectModal(true);
    } else if (!opponentDisconnected && disconnectStartedAt !== null) {
      setDisconnectStartedAt(null);
      setShowDisconnectModal(true);
    }
  }, [opponentDisconnected, disconnectStartedAt, isMatchActive]);

  const opponentSlot: "player_a" | "player_b" =
    playerSlot === "player_a" ? "player_b" : "player_a";

  const centerStatus: "your-move" | "waiting" | "resolving" =
    matchState.state === "resolving"
      ? "resolving"
      : currentTimer.status === "paused"
        ? "waiting"
        : "your-move";

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

  const liveState: LiveState =
    centerStatus === "resolving"
      ? { kind: "resolving" }
      : centerStatus === "waiting"
        ? { kind: "played" }
        : selectedTile
          ? { kind: "picking", letter: matchState.board[selectedTile.y]?.[selectedTile.x] ?? "", value: 0 }
          : { kind: "idle" };

  const notices: Notice[] = [];
  if (isReconnecting && disconnectedPlayerId === currentPlayerId) notices.push({ kind: "text", text: "reconnecting" });
  if (usePolling && !isReconnecting) notices.push({ kind: "text", text: "realtime lost · polling" });
  if (dualTimeoutDetected && matchState.state !== "completed") notices.push({ kind: "text", text: "both players timed out" });
  if (pollError || swapError) notices.push({ kind: "text", text: (swapError ?? pollError) as string });

  const opponentReconnectMsLeft =
    opponentDisconnected && disconnectStartedAt !== null && isMatchActive
      ? Math.max(0, disconnectStartedAt + RECONNECT_WINDOW_MS_CLIENT - Date.now())
      : null;

  const handleLedgerAction = (action: LedgerAction) => {
    if (action === "resign" || action === "leave") setShowResignDialog(true);
  };

  const youProfile = playerSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB;
  const oppProfile = opponentSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB;

  return (
    <>
      {opponentDisconnected &&
      showDisconnectModal &&
      disconnectStartedAt !== null &&
      isMatchActive ? (
        <DisconnectionModal
          opponentDisplayName={oppProfile.displayName}
          disconnectedAt={disconnectStartedAt}
          windowMs={90_000}
          onClose={() => setShowDisconnectModal(false)}
          onClaimWin={handleClaimWin}
          isClaiming={isClaimingWin}
        />
      ) : null}

      <MatchRoomView
        matchId={matchId}
        viewerSlot={playerSlot}
        you={{
          name: youProfile.displayName,
          rating: youProfile.eloRating ?? null,
          clockMs: timeLeftSeconds * 1000,
          running: !isPaused,
          score: playerScore,
        }}
        opp={{
          name: oppProfile.displayName,
          rating: oppProfile.eloRating ?? null,
          clockMs: opponentTimeLeft * 1000,
          running: opponentTimer.status === "running",
          score: opponentScore,
          reconnectMsLeft: opponentReconnectMsLeft,
        }}
        currentRound={matchState.currentRound}
        completed={matchState.state === "completed"}
        words={accumulatedWords}
        playerAId={playerAId}
        frozenTiles={matchState.frozenTiles ?? {}}
        live={liveState}
        notices={notices}
        footActions={
          roundHistory.length > 0 ? (
            <button
              type="button"
              className="action-secondary"
              onClick={() => setHistoryOpen((v) => !v)}
              data-testid="hud-history-button"
              aria-label="Round history"
            >
              history ▸
            </button>
          ) : null
        }
        onAction={handleLedgerAction}
      >
        <BoardGrid
          grid={matchState.board}
          matchId={matchId}
          frozenTiles={matchState.frozenTiles ?? {}}
          playerSlot={playerSlot}
          disabled={moveLocked}
          lockedTiles={lockedSwapTiles}
          swapScoringRevealed={scoringRevealed}
          opponentLockedTiles={opponentSwapTiles}
          opponentRevealTiles={
            animationPhase === "round-recap" && activeRevealMove
              ? [activeRevealMove.from, activeRevealMove.to]
              : null
          }
          scoredTileHighlights={animationPhase === "round-recap" ? activeRevealHighlights : []}
          highlightPlayerColors={animationPhase === "round-recap" ? highlightPlayerColors : {}}
          currentRoundScoredTiles={currentRoundScored}
          highlightDurationMs={animationPhase === "round-recap" ? (matchState.state === "completed" ? 2400 : 1200) : 800}
          highlightDelayMs={animationPhase === "round-recap" ? 450 : 0}
          externalSwap={externalSwap}
          onSwapComplete={handleSwapComplete}
          onSwapError={({ message }) => handleSwapError(message)}
          onTileSelect={playTileSelect}
          onValidSwap={() => { playValidSwap(); vibrateValidSwap(); }}
          onInvalidMove={() => { playInvalidMove(); vibrateInvalidMove(); }}
          onSelectionChange={setSelectedTile}
        />
      </MatchRoomView>

      {showDebug && (
        <details className="mt-4 border border-rule p-3 text-xs text-muted" data-testid="debug-metadata">
          <summary className="cursor-pointer">Debug Info</summary>
          <dl className="mt-2 grid grid-cols-2 gap-1">
            <dt>Match ID</dt>
            <dd className="font-mono">{matchId}</dd>
            <dt>Round</dt>
            <dd>{matchState.currentRound} / 10</dd>
            <dt>Status</dt>
            <dd>{matchState.state}</dd>
            <dt>Player A</dt>
            <dd className="font-mono">{matchState.timers.playerA.playerId}</dd>
            <dt>Player B</dt>
            <dd className="font-mono">{matchState.timers.playerB.playerId}</dd>
          </dl>
        </details>
      )}

      {historyOpen && roundHistory.length > 0 && createPortal(
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" data-testid="history-overlay-backdrop">
          <div
            ref={historyOverlayRef}
            className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto border border-ink bg-paper p-4"
            role="dialog"
            aria-label="Round history"
            data-testid="history-overlay"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Round history</h2>
              <button type="button" onClick={() => setHistoryOpen(false)} className="action-secondary" aria-label="Close round history" data-testid="history-close">
                close
              </button>
            </div>
            <RoundHistoryPanel
              rounds={roundHistory}
              playerAUsername={playerADisplayName}
              playerBUsername={playerBDisplayName}
              playerASlotId={playerAId}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="resign-dialog-backdrop">
          <div className="w-full max-w-sm border border-ink bg-paper p-6" role="alertdialog" aria-label="Confirm resignation" data-testid="resign-dialog">
            <h2 className="text-lg font-semibold text-ink">resign the match?</h2>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={handleResignConfirm} disabled={isResigning} className="action-primary" data-testid="resign-confirm">
                {isResigning ? "resigning" : "yes, resign ▸"}
              </button>
              <button type="button" onClick={() => setShowResignDialog(false)} className="action-secondary" data-testid="resign-cancel">
                no
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

