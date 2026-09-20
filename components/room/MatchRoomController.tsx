"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { claimWinAction } from "@/app/actions/match/claimWin";
import { getMatchRatings } from "@/app/actions/match/getMatchRatings";
import { resignMatch } from "@/app/actions/match/resignMatch";
import { triggerTimeoutCheck } from "@/app/actions/match/triggerTimeoutCheck";
import { useHapticFeedback } from "@/lib/haptics/useHapticFeedback";
import { usePreferencesStore } from "@/lib/preferences/preferencesStore";
import { bandIdForWord, bandsFromWords } from "@/lib/room/bandGeometry";
import { assertWordsSpellBoard } from "@/lib/room/wordIntegrity";
import { letterFactsOn, liveStateFor } from "@/lib/room/liveState";
import { RECONNECT_WINDOW_MS_CLIENT } from "@/lib/room/clock";
import { applyLetterSwaps } from "@/lib/room/displayBoard";
import { buildVerdict, finalCaption, ratingLine, type AccumulatedWord, type LiveState, type RatingRow } from "@/lib/room/ledgerRows";
import { buildTerritory } from "@/lib/room/ledgerRows";
import { useRematchNegotiation } from "@/lib/room/useRematchNegotiation";
import { LOBBY, NEW_OPPONENT, REMATCH, waitingForRematch } from "@/lib/constants/copy";
import type { LedgerAction, Notice } from "@/lib/room/ledgerTypes";
import { resignConfirm } from "@/lib/room/notices";
import { useRoomStore } from "@/lib/room/roomStore";
import { useSoundEffects } from "@/lib/audio/useSoundEffects";
import type { Coordinate } from "@/lib/types/board";
import type { MatchPlayerProfiles, MatchState, PlayerSlot } from "@/lib/types/match";
import { Field } from "./Field";
import { MatchRoomView } from "./MatchRoomView";
import { useAccumulatedRounds } from "./hooks/useAccumulatedRounds";
import { useWordHistory } from "./hooks/useWordHistory";
import { useClockTick } from "./hooks/useClockTick";
import { useFieldInteraction } from "./hooks/useFieldInteraction";
import { useMatchTransport } from "./hooks/useMatchTransport";
import { useNotices } from "./hooks/useNotices";
import { useNowTick } from "./hooks/useNowTick";
import { useRoomHotkeys } from "./hooks/useRoomHotkeys";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { useReveal } from "./hooks/useReveal";
import { useSettleHold } from "./hooks/useSettleHold";
import { deriveRoundState, turnFrameFor } from "@/lib/room/roundState";
import { buildPartialRevealKey } from "@/lib/match/partialReveal";

export interface MatchRoomControllerProps {
  initialState: MatchState;
  currentPlayerId: string;
  matchId: string;
  playerProfiles: MatchPlayerProfiles;
  pollIntervalMs?: number;
}

/** How long an illegal pick holds the live row before it returns to idle (spec 047 P1). */
const ILLEGAL_HOLD_MS = 2000;

/**
 * The round a frozen letter was scored in. A letter covered by two scored words
 * takes the earlier round — that is when it actually froze (spec 045 FR-012).
 */
function frozenRound(words: AccumulatedWord[], at: Coordinate, fallback: number): number {
  const rounds = words
    .filter((w) => w.coordinates.some((c) => c.x === at.x && c.y === at.y))
    .map((w) => w.roundNumber);
  return rounds.length > 0 ? Math.min(...rounds) : fallback;
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
  const participantSlot: PlayerSlot | null =
    initialState.timers.playerA.playerId === currentPlayerId ? "player_a" : initialState.timers.playerB.playerId === currentPlayerId ? "player_b" : null;
  /** Read-only non-participants (completed matches only, FR-043a) see player A as the bottom seat. */
  const readOnly = participantSlot === null;
  const viewerSlot: PlayerSlot = participantSlot ?? "player_a";

  useEffect(() => {
    hydrateMatch(initialState, currentPlayerId);
  }, [initialState, currentPlayerId, hydrateMatch]);

  const onNewMatch = useCallback((newMatchId: string) => router.replace(`/match/${newMatchId}`), [router]);
  const rematch = useRematchNegotiation({ matchId, currentPlayerId, onNewMatch });
  const transport = useMatchTransport(matchId, currentPlayerId, pollIntervalMs, rematch.handleEvent);
  const history = useWordHistory(matchId, match.currentRound);
  const words = useAccumulatedRounds(match, history);

  // Spec 047 FR-002: outside production, a band that would not spell its word
  // is reported once per match — the review saw NHMÖ drawn under "úðu".
  const integrityReported = useRef<string | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || integrityReported.current === matchId) return;
    const problems = assertWordsSpellBoard(match.board, words);
    if (problems.length === 0) return;
    integrityReported.current = matchId;
    console.error(`[wordIntegrity] ${matchId}`, problems);
  }, [matchId, match.board, words]);
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

  // An illegal pick is a live-row state for two seconds, not a notice line
  // (spec 047 amendment P1): the beat stays where the player is reading.
  const [illegal, setIllegal] = useState<{ ownerName: string; round: number } | null>(null);
  const illegalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showIllegal = useCallback((ownerName: string, round: number) => {
    if (illegalTimer.current) clearTimeout(illegalTimer.current);
    setIllegal({ ownerName, round });
    illegalTimer.current = setTimeout(() => setIllegal(null), ILLEGAL_HOLD_MS);
  }, []);
  useEffect(() => () => { if (illegalTimer.current) clearTimeout(illegalTimer.current); }, []);

  const onNotice = useCallback(
    (kind: "frozen" | "pinned" | "pickCleared", at?: Coordinate) => {
      if (kind === "pickCleared") return push({ kind: "pickCleared", reason: "opponentPinned" });
      const owner = at ? frozenTiles[`${at.x},${at.y}`]?.owner : undefined;
      showIllegal(owner ? ownerNames[owner] : opp.displayName, at ? frozenRound(words, at, match.currentRound) : match.currentRound);
    },
    [push, showIllegal, frozenTiles, ownerNames, opp.displayName, words, match.currentRound],
  );
  const onRejected = useCallback((message: string) => push({ kind: "text", text: message.toLowerCase() }), [push]);
  const onCommitted = useCallback(() => {
    sound.playValidSwap();
    haptics.vibrateValidSwap();
  }, [sound, haptics]);


  // Reveal (design system §7, Clarifications Q3): a new summary or first-mover
  // partial starts a plan over the words not yet drawn; drawn ids are remembered
  // so nothing is ever drawn twice.
  const reducedMotion = useReducedMotion();
  const [drawnIds, setDrawnIds] = useState<Set<string>>(() => new Set());
  const reveal = useMemo(() => {
    const partial = match.partialSummary;
    const summary = match.lastSummary;
    const source = summary && (!partial || summary.roundNumber >= partial.roundNumber) ? { key: `summary:${summary.roundNumber}`, round: summary.roundNumber } : partial ? { key: `partial:${buildPartialRevealKey(partial)}`, round: partial.roundNumber } : null;
    if (!source) return { key: null as string | null, round: null as number | null, ids: [] as string[] };
    const ids = words.filter((w) => w.roundNumber === source.round).map(bandIdForWord).filter((id): id is string => Boolean(id));
    return { key: source.key, round: source.round, ids };
  }, [match.lastSummary, match.partialSummary, words]);
  const alreadyDrawn = useMemo(() => new Set(reveal.ids.filter((id) => drawnIds.has(id))), [reveal.ids, drawnIds]);
  const newIds = useMemo(() => reveal.ids.filter((id) => !alreadyDrawn.has(id)), [reveal.ids, alreadyDrawn]);
  const onBand = useCallback(() => sound.playWordDiscovery(), [sound]);
  const progress = useReveal({ key: reveal.key, wordIds: reveal.ids, alreadyDrawn, reducedMotion, onBand });
  useEffect(() => {
    if (!progress.settled || progress.planIds.length === 0) return;
    setDrawnIds((prev) => (progress.planIds.every((id) => prev.has(id)) ? prev : new Set([...prev, ...progress.planIds])));
  }, [progress.settled, progress.planIds]);
  const revealing = reveal.key !== null && !progress.settled;
  // Only a resolved round's reveal is "resolving" and holds afterwards; the
  // first-mover partial reveal (spec 042) draws while the viewer may still pick.
  const summaryReveal = reveal.key?.startsWith("summary:") ?? false;
  const resolvingNow = revealing && summaryReveal;
  useSettleHold({ round: reveal.round, settled: progress.settled, drew: summaryReveal && progress.planIds.length > 0 });
  const hiddenWordIds = useMemo(() => new Set(newIds.slice(progress.wordsWritten)), [newIds, progress.wordsWritten]);

  const holdRound = useRoomStore((s) => s.holdRound);
  const slipUp = useRoomStore((s) => s.slip !== null && !s.slipDismissed);
  const field = useFieldInteraction({
    matchId,
    previewEnabled,
    frozenKeys,
    opponentPins,
    canPick: !readOnly && isActive && youTimer.status === "running" && holdRound === null && !slipUp && !resolvingNow,
    currentRound: match.currentRound,
    onPick: sound.playTileSelect,
    onCommitted,
    onRejected,
    onNotice,
  });

  const displayBoard = useMemo(() => applyLetterSwaps(match.board, [opponentPins, field.ownPins]), [match.board, opponentPins, field.ownPins]);

  const bands = useMemo(() => {
    const all = bandsFromWords({ words, frozenTiles, viewerSlot, playerAId: match.timers.playerA.playerId, liveRound: revealing ? reveal.round : null, trustRound: reveal.round });
    // New bands of the running reveal go last so `drawnCount` can gate them.
    const fresh = new Set(newIds);
    return [...all.filter((b) => !fresh.has(b.id)), ...all.filter((b) => fresh.has(b.id))];
  }, [words, frozenTiles, viewerSlot, match.timers.playerA.playerId, revealing, reveal.round, newIds]);
  const drawnCount = revealing ? bands.length - newIds.length + Math.min(progress.bandsDrawn, newIds.length) : null;
  const drawingIndex = revealing && progress.bandsDrawn > 0 && progress.bandsDrawn <= newIds.length ? bands.length - newIds.length + progress.bandsDrawn - 1 : null;
  const [highlightRound, setHighlightRound] = useState<number | null>(null);

  const letterAt = useMemo(() => letterFactsOn(match.board), [match.board]);
  // The field's own state (pick / preview / illegal); the round's beat is layered on by
  // `roundState` (spec 048 US2), which owns line 1 of the live row.
  const live: LiveState = useMemo(() => {
    const fromField = liveStateFor(field.interaction, letterAt);
    if (fromField.kind === "idle" && illegal) return { kind: "illegal", ...illegal };
    return fromField;
  }, [field.interaction, letterAt, illegal]);
  const roundState = useMemo(
    () => deriveRoundState({ match, viewerSlot, opponentName: opp.displayName, holdRound, revealing: resolvingNow, revealRound: reveal.round }),
    [match, viewerSlot, opp.displayName, holdRound, resolvingNow, reveal.round],
  );

  const dualTimeout = match.timers.playerA.remainingMs <= 0 && match.timers.playerB.remainingMs <= 0;
  const timeoutFired = useRef(false);
  useEffect(() => {
    if (dualTimeout && !completed && !timeoutFired.current) {
      timeoutFired.current = true;
      triggerTimeoutCheck(matchId).catch(() => undefined);
    }
  }, [dualTimeout, completed, matchId]);

  // Final phase (design system §7): the field stays; the bars take the rating
  // lines and the ledger states the verdict once. Ratings are read once the
  // server has written them, with one retry while pending.
  const matchEndFired = useRef(false);
  const [ratings, setRatings] = useState<RatingRow[] | null>(null);
  // useSoundEffects/useHapticFeedback return fresh objects each render; hold them in refs
  // so the completion effect runs once per completion, not once per render.
  const feedbackRef = useRef({ sound, haptics });
  useEffect(() => {
    feedbackRef.current = { sound, haptics };
  }, [sound, haptics]);
  useEffect(() => {
    if (!completed) return;
    if (!matchEndFired.current) {
      matchEndFired.current = true;
      feedbackRef.current.sound.playMatchEnd();
      feedbackRef.current.haptics.vibrateMatchEnd();
    }
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = async (attempt: number) => {
      // Promise.resolve, not a bare .catch: the action is called through a
      // boundary that can hand back a non-promise, and this runs inside a timer
      // with nothing to catch the TypeError — it surfaces as an unhandled
      // rejection and fails the run even when every test passes.
      const result = await Promise.resolve(getMatchRatings(matchId)).catch(() => null);
      if (!active) return;
      if (result?.status === "ok" && result.ratings) setRatings(result.ratings);
      else if (attempt < 1) retry = setTimeout(() => void load(attempt + 1), 3_000);
    };
    void load(0);
    return () => {
      active = false;
      // The flag stops the state update; the timer has to be stopped too, or it
      // fires three seconds after unmount into a torn-down component.
      if (retry) clearTimeout(retry);
    };
  }, [completed, matchId]);

  // Disconnect (design system §5.3, §7 "Disconnect"): no overlay. The opponent's bar
  // counts the server-anchored window down, both lanes hold, and once the window
  // has elapsed the ledger offers the claim as a line.
  const opponentGone = match.disconnectedPlayerId === oppTimer.playerId && isActive;
  const disconnectedAt = opponentGone ? match.disconnectedAt ?? null : null;
  const now = useNowTick(Boolean(disconnectedAt));
  const windowMs = match.reconnectWindowMs ?? RECONNECT_WINDOW_MS_CLIENT;
  const reconnectMsLeft = disconnectedAt ? Math.max(0, new Date(disconnectedAt).getTime() + windowMs - now) : null;
  const claimable = reconnectMsLeft === 0;
  useEffect(() => {
    if (claimable) push({ kind: "claimWin", opponentName: opp.displayName });
    else dismiss("claimWin");
  }, [claimable, opp.displayName, push, dismiss]);
  const clocksHeld = match.disconnectedPlayerId != null && isActive;
  const youScore = match.scores[viewerSlot === "player_a" ? "playerA" : "playerB"];
  const oppScore = match.scores[opponentSlot === "player_a" ? "playerA" : "playerB"];
  const youScoreWins = youScore > oppScore;
  const draw = youScore === oppScore;

  // First match (server-side gamesPlayed === 0, Clarifications Q2): the three-sentence rules live in the ledger.
  const firstMatch = you.gamesPlayed === 0;
  useEffect(() => {
    if (firstMatch) push({ kind: "firstMatchRules" });
  }, [firstMatch, push]);

  useEffect(() => {
    if (rematch.phase === "incoming") push({ kind: "rematchRequest", requesterName: opp.displayName });
    else dismiss("rematchRequest");
  }, [rematch.phase, opp.displayName, push, dismiss]);

  const handleAction = useCallback(
    (action: LedgerAction) => {
      if (action === "rules") push({ kind: "firstMatchRules" });
      else if (action === "rematch") void rematch.request();
      else if (action === "acceptRematch") void rematch.accept();
      else if (action === "declineRematch") void rematch.decline();
      else if (action === "newOpponent") router.replace("/matchmaking");
      else if (action === "lobby") router.replace("/lobby");
      else if (action === "resign" || action === "leave") push(resignConfirm());
      else if (action === "cancelResign") dismiss("resignConfirm");
      else if (action === "confirmResign") {
        dismiss("resignConfirm");
        resignMatch(matchId).catch((e: Error) => push({ kind: "text", text: e.message.toLowerCase() }));
      } else if (action === "claimWin") {
        claimWinAction(matchId).then((r) => r.status !== "ok" && r.status !== "already_completed" && push({ kind: "text", text: r.status.replace("_", " ") }));
      }
    },
    [matchId, push, dismiss, rematch, router],
  );

  // `?` opens the rules, `M` mutes (design system §9, FR-026).
  useRoomHotkeys(handleAction);

  const rematchLine =
    rematch.phase === "waiting" ? waitingForRematch(opp.displayName) : rematch.phase === "declined" ? `${opp.displayName} declined` : rematch.phase === "expired" ? "rematch request expired" : rematch.error;
  const allNotices: Notice[] = [
    ...notices,
    ...(completed && rematchLine ? [{ kind: "text", text: rematchLine } as Notice] : []),
    ...(transport.isReconnecting && match.disconnectedPlayerId === currentPlayerId ? [{ kind: "text", text: "reconnecting" } as Notice] : []),
    ...(transport.usePolling && !transport.isReconnecting ? [{ kind: "text", text: "realtime lost · polling" } as Notice] : []),
    ...(dualTimeout && !completed ? [{ kind: "text", text: "both players timed out" } as Notice] : []),
    ...(transport.pollError ? [{ kind: "text", text: transport.pollError } as Notice] : []),
  ];

  return (
    <>
      <MatchRoomView
        matchId={matchId}
        viewerSlot={viewerSlot}
        you={{ name: you.displayName, rating: you.eloRating ?? null, finalLine: completed ? ratingLine(ratings, youTimer.playerId, youScoreWins, match.rated !== false) : undefined, clockMs: clocks[viewerSlot === "player_a" ? "playerA" : "playerB"], running: youTimer.status === "running" && !clocksHeld, score: match.scores[viewerSlot === "player_a" ? "playerA" : "playerB"] }}
        opp={{ name: opp.displayName, rating: opp.eloRating ?? null, finalLine: completed ? ratingLine(ratings, oppTimer.playerId, !youScoreWins && !draw, match.rated !== false) : undefined, clockMs: clocks[opponentSlot === "player_a" ? "playerA" : "playerB"], running: oppTimer.status === "running" && !clocksHeld, score: match.scores[opponentSlot === "player_a" ? "playerA" : "playerB"], reconnectMsLeft }}
        currentRound={match.currentRound}
        completed={completed}
        rated={match.rated !== false}
        caption={completed ? finalCaption(match.timers.playerA.remainingMs, match.timers.playerB.remainingMs, match.rated !== false) : undefined}
        verdict={
          completed
            ? buildVerdict({
                viewerName: you.displayName,
                opponentName: opp.displayName,
                viewerScore: match.scores[viewerSlot === "player_a" ? "playerA" : "playerB"],
                opponentScore: match.scores[opponentSlot === "player_a" ? "playerA" : "playerB"],
                viewerWords: words.filter((w) => w.playerId === youTimer.playerId).length,
                opponentWords: words.filter((w) => w.playerId === oppTimer.playerId).length,
                territory: buildTerritory(frozenTiles, viewerSlot),
              })
            : undefined
        }
        readOnly={readOnly}
        footActions={
          completed && !readOnly ? (
            <>
              <button type="button" className="action-secondary" data-testid="ledger-rematch" onClick={() => handleAction("rematch")} disabled={rematch.phase === "waiting" || rematch.phase === "requesting"}>
                {REMATCH}
              </button>
              <button type="button" className="action-secondary" data-testid="ledger-new-opponent" onClick={() => handleAction("newOpponent")}>
                {NEW_OPPONENT}
              </button>
              <button type="button" className="action-secondary" data-testid="ledger-lobby" onClick={() => handleAction("lobby")}>
                {LOBBY}
              </button>
            </>
          ) : readOnly ? (
            <button type="button" className="action-secondary" data-testid="ledger-lobby" onClick={() => handleAction("lobby")}>
              ◂ {LOBBY}
            </button>
          ) : undefined
        }
        words={words}
        hiddenWordIds={hiddenWordIds}
        playerAId={match.timers.playerA.playerId}
        frozenTiles={frozenTiles}
        live={live}
        roundState={roundState}
        holdRound={holdRound}
        notices={allNotices}
        onRowHover={setHighlightRound}
        onAction={handleAction}
      >
        <Field
          board={displayBoard}
          frozenTiles={frozenTiles}
          viewerSlot={viewerSlot}
          ownerNames={ownerNames}
          disabled={completed || readOnly || holdRound !== null || resolvingNow}
          turnFrame={completed || readOnly ? null : turnFrameFor(roundState)}
          bands={bands}
          highlightRound={highlightRound}
          drawnCount={drawnCount}
          drawingIndex={drawingIndex}
          cellStateFor={field.cellStateFor}
          seatFor={field.seatFor}
          shakeAt={field.shakeAt}
          focusAt={field.focusAt}
          onActivate={(at) => field.dispatch({ type: "tap", at })}
        onDrag={(from, to) => field.dispatch({ type: "drag", from, to })}
        exchange={field.ownPins}
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
