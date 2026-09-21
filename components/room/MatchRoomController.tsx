"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { logoutAction } from "@/app/actions/auth/logout";
import { claimWinAction } from "@/app/actions/match/claimWin";
import { getMatchRatings } from "@/app/actions/match/getMatchRatings";
import { resignMatch } from "@/app/actions/match/resignMatch";
import { settleMatch } from "@/app/actions/match/settleMatch";
import { useHapticFeedback } from "@/lib/haptics/useHapticFeedback";
import { usePreferencesStore } from "@/lib/preferences/preferencesStore";
import { bandIdForWord, bandsFromWords } from "@/lib/room/bandGeometry";
import { reportWordIntegrity } from "@/lib/room/wordIntegrity";
import { letterFactsOn, liveStateFor } from "@/lib/room/liveState";
import { formatClock, RECONNECT_WINDOW_MS_CLIENT } from "@/lib/room/clock";
import { applyLetterSwaps } from "@/lib/room/displayBoard";
import { buildVerdict, finalCaption, moveKeyOf, ratingLine, type AccumulatedWord, type LiveState, type RatingRow } from "@/lib/room/ledgerRows";
import { buildTerritory } from "@/lib/room/ledgerRows";
import { useRematchNegotiation } from "@/lib/room/useRematchNegotiation";
import { LOBBY, RESULT } from "@/lib/constants/copy";
import type { LedgerAction, Notice } from "@/lib/room/ledgerTypes";
import { useRoomStore } from "@/lib/room/roomStore";
import { useSoundEffects } from "@/lib/audio/useSoundEffects";
import type { Coordinate } from "@/lib/types/board";
import type { MatchPlayerProfiles, MatchState, MoveRejectionReason, MoveResolution, PlayerSlot } from "@/lib/types/match";
import { Field } from "./Field";
import { MatchRoomView } from "./MatchRoomView";
import { useAccumulatedMoves } from "./hooks/useAccumulatedMoves";
import { useWordHistory } from "./hooks/useWordHistory";
import { useDeadlineTick } from "./hooks/useDeadlineTick";
import { useFieldInteraction } from "./hooks/useFieldInteraction";
import { useMatchTransport } from "./hooks/useMatchTransport";
import { useNotices } from "./hooks/useNotices";
import { useNowTick } from "./hooks/useNowTick";
import { useRoomHotkeys } from "./hooks/useRoomHotkeys";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { useReveal } from "./hooks/useReveal";
import { useMoveHold } from "./hooks/useMoveHold";
import { useMatchOverSlip } from "./hooks/useMatchOverSlip";
import { deriveMoveState, turnFrameFor, viewerFacts } from "@/lib/room/moveState";

export interface MatchRoomControllerProps {
  initialState: MatchState;
  currentPlayerId: string;
  matchId: string;
  playerProfiles: MatchPlayerProfiles;
  pollIntervalMs?: number;
}

/** How long an illegal pick or a refused move holds the live row before it returns (spec 047 P1, spec 050). */
const NOTICE_HOLD_MS = 2000;

/**
 * The move a frozen letter was scored in. A letter covered by two scored words
 * takes the earlier move — that is when it actually froze (spec 045 FR-012).
 */
function frozenMove(words: AccumulatedWord[], at: Coordinate): number | null {
  const moves = words
    .filter((w) => w.coordinates.some((c) => c.x === at.x && c.y === at.y))
    .sort((a, b) => a.globalSeq - b.globalSeq)
    .map((w) => w.moveSeq);
  return moves.length > 0 ? moves[0] : null;
}

/** The letters an opponent's resolution touched: its swap and everything it froze. */
function touchedBy(r: MoveResolution): Coordinate[] {
  return [r.swap.from, r.swap.to, ...r.words.flatMap((w) => w.coordinates)];
}

/** The latest finished move of either player: the one whose bands are drawing. */
function latestResolution(match: MatchState): MoveResolution | null {
  const a = match.players.playerA.lastResolution;
  const b = match.players.playerB.lastResolution;
  if (!a) return b;
  if (!b) return a;
  return a.globalSeq >= b.globalSeq ? a : b;
}

/**
 * The match phase of the room (spec 044, spec 050). Owns nothing visual: it
 * hydrates the room store, runs transport, and wires the field interaction into
 * bars, field and ledger.
 */
/** The clock's length for this match (5:00 unless the playtest env shortens it); null before it is set. */
function clockLengthOf(clock: MatchState["clock"]): number | null {
  if (!clock?.startedAt || !clock.deadlineAt) return null;
  return new Date(clock.deadlineAt).getTime() - new Date(clock.startedAt).getTime();
}

export function MatchRoomController({ initialState, currentPlayerId, matchId, playerProfiles, pollIntervalMs }: MatchRoomControllerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showDebug = process.env.NODE_ENV !== "production" && searchParams.get("debug") === "1";
  const hydrateMatch = useRoomStore((s) => s.hydrateMatch);
  const match = useRoomStore((s) => s.match) ?? initialState;
  const participantSlot: PlayerSlot | null =
    initialState.players.playerA.playerId === currentPlayerId ? "player_a" : initialState.players.playerB.playerId === currentPlayerId ? "player_b" : null;
  /** Read-only non-participants (completed matches only, FR-043a) see player A as the bottom seat. */
  const readOnly = participantSlot === null;
  const viewerSlot: PlayerSlot = participantSlot ?? "player_a";

  useEffect(() => {
    hydrateMatch(initialState, currentPlayerId);
  }, [initialState, currentPlayerId, hydrateMatch]);

  const onNewMatch = useCallback((newMatchId: string) => router.replace(`/match/${newMatchId}`), [router]);
  const rematch = useRematchNegotiation({ matchId, currentPlayerId, onNewMatch });
  const transport = useMatchTransport(matchId, currentPlayerId, pollIntervalMs, rematch.handleEvent);
  const history = useWordHistory(matchId, match.resolvedSeq);
  const words = useAccumulatedMoves(match, history);

  // Spec 047 FR-002 / spec 049: a record the board does not spell is reported
  // once per match, in every environment.
  useEffect(() => reportWordIntegrity(matchId, match.board, words), [matchId, match.board, words]);
  const { notices, push, dismiss } = useNotices();
  // The tick runs from the deadline, so before started_at it reads more than
  // the clock's length: the excess is the server-anchored 3·2·1 (spec 050
  // FR-008), and the caption holds at the full clock meanwhile.
  const tickMs = useDeadlineTick(match.clock);
  const clockLengthMs = clockLengthOf(match.clock);
  const msToStart = clockLengthMs === null ? 0 : tickMs - clockLengthMs;
  const clockMs = clockLengthMs === null ? tickMs : Math.min(tickMs, clockLengthMs);
  const sound = useSoundEffects(usePreferencesStore((s) => s.soundEnabled));
  const haptics = useHapticFeedback(usePreferencesStore((s) => s.hapticsEnabled));
  const previewEnabled = usePreferencesStore((s) => s.previewEnabled);

  const opponentSlot = viewerSlot === "player_a" ? "player_b" : "player_a";
  const you = playerProfiles[viewerSlot === "player_a" ? "playerA" : "playerB"];
  const opp = playerProfiles[opponentSlot === "player_a" ? "playerA" : "playerB"];
  const { you: youFacts, opp: oppFacts } = viewerFacts(match, viewerSlot);
  const completed = match.state === "completed";
  const inProgress = match.state === "in_progress";
  const frozenTiles = match.frozenTiles;
  const frozenKeys = useMemo(() => new Set(Object.keys(frozenTiles)), [frozenTiles]);
  const ownerNames = useMemo(() => ({ player_a: playerProfiles.playerA.displayName, player_b: playerProfiles.playerB.displayName }), [playerProfiles]);

  // An illegal pick or a refused move is a live-row state for two seconds, not
  // a notice line (spec 047 amendment P1, spec 050): the beat stays where the
  // player is reading.
  const [illegal, setIllegal] = useState<{ ownerName: string; round: number } | null>(null);
  const [rejected, setRejected] = useState<MoveRejectionReason | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdNotice = useCallback((apply: () => void, clear: () => void) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    apply();
    noticeTimer.current = setTimeout(clear, NOTICE_HOLD_MS);
  }, []);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  const onNotice = useCallback(
    (kind: "frozen" | "pickCleared", at?: Coordinate) => {
      if (kind === "pickCleared") return push({ kind: "pickCleared", byName: opp.displayName });
      const owner = at ? frozenTiles[`${at.x},${at.y}`]?.owner : undefined;
      const ownerName = owner ? ownerNames[owner] : opp.displayName;
      const move = (at && frozenMove(words, at)) ?? youFacts.movesPlayed;
      holdNotice(() => setIllegal({ ownerName, round: move }), () => setIllegal(null));
    },
    [push, holdNotice, frozenTiles, ownerNames, opp.displayName, words, youFacts.movesPlayed],
  );
  const onRejected = useCallback((message: string) => push({ kind: "text", text: message.toLowerCase() }), [push]);
  const onCommitted = useCallback(() => {
    sound.playValidSwap();
    haptics.vibrateValidSwap();
  }, [sound, haptics]);

  // Reveal (design system §7): the latest resolution of either player starts a
  // plan over its words not yet drawn; drawn ids are remembered so nothing is
  // ever drawn twice. Only the viewer's own reveal locks the field and holds.
  const reducedMotion = useReducedMotion();
  const [drawnIds, setDrawnIds] = useState<Set<string>>(() => new Set());
  const latest = useMemo(() => latestResolution(match), [match]);
  const reveal = useMemo(() => {
    if (!latest || latest.status !== "resolved" || latest.seq === null) return { key: null as string | null, moveKey: null as string | null, ids: [] as string[], own: false };
    const moveKey = moveKeyOf({ playerId: latest.playerId, moveSeq: latest.seq });
    const ids = words.filter((w) => moveKeyOf(w) === moveKey).map(bandIdForWord).filter((id): id is string => Boolean(id));
    return { key: `move:${latest.moveId}`, moveKey, ids, own: latest.playerId === youFacts.playerId };
  }, [latest, words, youFacts.playerId]);
  const alreadyDrawn = useMemo(() => new Set(reveal.ids.filter((id) => drawnIds.has(id))), [reveal.ids, drawnIds]);
  const newIds = useMemo(() => reveal.ids.filter((id) => !alreadyDrawn.has(id)), [reveal.ids, alreadyDrawn]);
  const onBand = useCallback(() => sound.playWordDiscovery(), [sound]);
  const progress = useReveal({ key: reveal.key, wordIds: reveal.ids, alreadyDrawn, reducedMotion, onBand });
  useEffect(() => {
    if (!progress.settled || progress.planIds.length === 0) return;
    setDrawnIds((prev) => (progress.planIds.every((id) => prev.has(id)) ? prev : new Set([...prev, ...progress.planIds])));
  }, [progress.settled, progress.planIds]);
  const revealing = reveal.key !== null && !progress.settled;
  const revealingOwn = revealing && reveal.own;

  // The viewer's own move resolved while we were watching: a resolution this
  // client had not already seen, so a reload holds nothing. A rejected move
  // holds nothing either; it returns the letters and says why for two seconds.
  const ownResolution = youFacts.lastResolution;
  const seenOwn = useRef<string | null>(ownResolution?.moveId ?? null);
  const [resolvedOwn, setResolvedOwn] = useState<{ moveId: string; seq: number } | null>(null);
  const fieldDispatch = useRef<((e: { type: "moveResolved" } | { type: "moveRejected"; reason: MoveRejectionReason } | { type: "opponentResolved"; tiles: Coordinate[] }) => void) | null>(null);
  useEffect(() => {
    if (!ownResolution || ownResolution.moveId === seenOwn.current) return;
    seenOwn.current = ownResolution.moveId;
    if (ownResolution.status === "resolved" && ownResolution.seq !== null) {
      setResolvedOwn({ moveId: ownResolution.moveId, seq: ownResolution.seq });
      fieldDispatch.current?.({ type: "moveResolved" });
    } else if (ownResolution.rejectionReason) {
      const reason = ownResolution.rejectionReason;
      fieldDispatch.current?.({ type: "moveRejected", reason });
      holdNotice(() => setRejected(reason), () => setRejected(null));
    }
  }, [ownResolution, holdNotice]);
  useMoveHold({ matchId, resolved: resolvedOwn, settled: progress.settled && progress.planKey === reveal.key });

  // The opponent's resolution lands on the field at once; a pick it touched clears.
  const oppResolution = oppFacts.lastResolution;
  const seenOpp = useRef<string | null>(oppResolution?.moveId ?? null);
  useEffect(() => {
    if (!oppResolution || oppResolution.moveId === seenOpp.current) return;
    seenOpp.current = oppResolution.moveId;
    if (oppResolution.status === "resolved") fieldDispatch.current?.({ type: "opponentResolved", tiles: touchedBy(oppResolution) });
  }, [oppResolution]);

  const hiddenWordIds = useMemo(() => new Set(newIds.slice(progress.wordsWritten)), [newIds, progress.wordsWritten]);

  const holdMove = useRoomStore((s) => s.holdMove);
  const slipUp = useRoomStore((s) => s.slip !== null && !s.slipDismissed);
  const moveState = useMemo(
    () => deriveMoveState({ match, viewerSlot, opponentName: opp.displayName, holdMove, revealingOwn, rejected, clockMs, msToStart }),
    [match, viewerSlot, opp.displayName, holdMove, revealingOwn, rejected, clockMs, msToStart],
  );
  const canPick = !readOnly && inProgress && (moveState.kind === "yourMove" || moveState.kind === "rejected") && !slipUp;
  const field = useFieldInteraction({
    matchId,
    board: match.board,
    previewEnabled,
    frozenKeys,
    canPick,
    onPick: sound.playTileSelect,
    onCommitted,
    onRejected,
    onNotice,
  });
  useEffect(() => {
    fieldDispatch.current = field.dispatch;
  }, [field.dispatch]);

  const displayBoard = useMemo(() => applyLetterSwaps(match.board, [field.ownPins]), [match.board, field.ownPins]);

  const bands = useMemo(() => {
    const all = bandsFromWords({ words, board: match.board, frozenTiles, viewerSlot, playerAId: match.players.playerA.playerId, liveMoveKey: revealing ? reveal.moveKey : null, trustMoveKey: reveal.moveKey });
    // New bands of the running reveal go last so `drawnCount` can gate them.
    const fresh = new Set(newIds);
    return [...all.filter((b) => !fresh.has(b.id)), ...all.filter((b) => fresh.has(b.id))];
  }, [words, match.board, frozenTiles, viewerSlot, match.players.playerA.playerId, revealing, reveal.moveKey, newIds]);
  const drawnCount = revealing ? bands.length - newIds.length + Math.min(progress.bandsDrawn, newIds.length) : null;
  const drawingIndex = revealing && progress.bandsDrawn > 0 && progress.bandsDrawn <= newIds.length ? bands.length - newIds.length + progress.bandsDrawn - 1 : null;
  const [highlightMove, setHighlightMove] = useState<number | null>(null);

  const letterAt = useMemo(() => letterFactsOn(match.board), [match.board]);
  // The field's own state (pick / preview / illegal); the move's beat is layered on by
  // `moveState` (spec 050), which owns line 1 of the live row.
  const live: LiveState = useMemo(() => {
    const fromField = liveStateFor(field.interaction, letterAt);
    if (fromField.kind === "idle" && illegal) return { kind: "illegal", ...illegal };
    return fromField;
  }, [field.interaction, letterAt, illegal]);

  // At 0:00 the client nudges settlement once; the server decides (contracts/settlement.md).
  const timeUp = clockMs <= 0 && Boolean(match.clock.deadlineAt);
  const settleFired = useRef(false);
  useEffect(() => {
    if (timeUp && inProgress && !settleFired.current) {
      settleFired.current = true;
      Promise.resolve(settleMatch(matchId)).catch(() => undefined);
    }
  }, [timeUp, inProgress, matchId]);

  // Final phase (design system §7): the field stays; the bars take the rating
  // lines and the ledger states the verdict once. Ratings are read once the
  // server has written them, with one retry while pending.
  const matchEndFired = useRef(false);
  const [ratings, setRatings] = useState<RatingRow[] | null>(null);
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
      const result = await Promise.resolve(getMatchRatings(matchId)).catch(() => null);
      if (!active) return;
      if (result?.status === "ok" && result.ratings) setRatings(result.ratings);
      else if (attempt < 1) retry = setTimeout(() => void load(attempt + 1), 3_000);
    };
    void load(0);
    return () => {
      active = false;
      if (retry) clearTimeout(retry);
    };
  }, [completed, matchId]);

  // Disconnect (design system §5.3, spec 050): the opponent's bar counts the
  // server-anchored window down; the clock keeps running. Once the window has
  // elapsed and the viewer has all their moves, ending early is put on a slip.
  const opponentGone = match.disconnectedPlayerId === oppFacts.playerId && inProgress;
  const disconnectedAt = opponentGone ? match.disconnectedAt ?? null : null;
  const now = useNowTick(Boolean(disconnectedAt));
  const windowMs = match.reconnectWindowMs ?? RECONNECT_WINDOW_MS_CLIENT;
  const reconnectMsLeft = disconnectedAt ? Math.max(0, new Date(disconnectedAt).getTime() + windowMs - now) : null;
  const viewerDone = youFacts.movesPlayed >= match.moveLimit;
  const endable = reconnectMsLeft === 0 && viewerDone;
  const setSlip = useRoomStore((s) => s.setSlip);
  const clearSlip = useRoomStore((s) => s.clearSlip);
  // `keep waiting ▸` puts the offer away; the next window tick re-arms it (spec 048 US7).
  const [endDeferred, setEndDeferred] = useState(false);
  useEffect(() => {
    if (!endDeferred) return;
    const timer = setTimeout(() => setEndDeferred(false), 10_000);
    return () => clearTimeout(timer);
  }, [endDeferred, matchId]);
  useEffect(() => {
    if (endable && !endDeferred && !completed) setSlip({ kind: "endEarly", opponentName: opp.displayName, opponentMoves: oppFacts.movesPlayed, clockMs });
    else clearSlip("endEarly");
    if (!endable) setEndDeferred(false);
  }, [endable, endDeferred, completed, opp.displayName, oppFacts.movesPlayed, clockMs, setSlip, clearSlip]);
  const youScore = match.scores[viewerSlot === "player_a" ? "playerA" : "playerB"];
  const oppScore = match.scores[opponentSlot === "player_a" ? "playerA" : "playerB"];
  // The server's winner decides the verdict and the bars, not the totals (spec 048 US1, spec 050).
  const recordedWinnerSeat = match.winnerId ? (match.winnerId === youFacts.playerId ? "you" : "opp") : null;
  const youScoreWins = recordedWinnerSeat ? recordedWinnerSeat === "you" : youScore > oppScore;
  const draw = recordedWinnerSeat ? false : youScore === oppScore;
  const verdict = useMemo(
    () =>
      completed
        ? buildVerdict({
            viewerName: you.displayName,
            opponentName: opp.displayName,
            viewerScore: youScore,
            opponentScore: oppScore,
            viewerWords: words.filter((w) => w.playerId === youFacts.playerId).length,
            opponentWords: words.filter((w) => w.playerId === oppFacts.playerId).length,
            viewerMoves: youFacts.movesPlayed,
            opponentMoves: oppFacts.movesPlayed,
            territory: buildTerritory(frozenTiles, viewerSlot),
            winnerSeat: recordedWinnerSeat,
            endedReason: match.endedReason,
          })
        : null,
    [completed, you.displayName, opp.displayName, youScore, oppScore, words, youFacts.playerId, oppFacts.playerId, youFacts.movesPlayed, oppFacts.movesPlayed, frozenTiles, viewerSlot, recordedWinnerSeat, match.endedReason],
  );
  const durationMs = match.clock.startedAt
    ? Math.max(0, new Date(match.completedAt ?? match.clock.deadlineAt ?? match.clock.startedAt).getTime() - new Date(match.clock.startedAt).getTime())
    : 0;
  const [revealedOnce, setRevealedOnce] = useState(false);
  useEffect(() => {
    if (revealing) setRevealedOnce(true);
  }, [revealing]);
  const slipDismissed = useRoomStore((s) => s.slipDismissed);
  const dismissSlip = useRoomStore((s) => s.dismissSlip);
  const restoreSlip = useRoomStore((s) => s.restoreSlip);
  useMatchOverSlip({
    match,
    viewerSlot,
    completed,
    readOnly,
    verdict,
    durationMmSs: formatClock(durationMs),
    viewerName: you.displayName,
    opponentName: opp.displayName,
    ratings,
    rematch: rematch.phase,
    busy: revealing || holdMove !== null,
    revealed: revealedOnce,
  });

  const handleAction = useCallback(
    (action: LedgerAction) => {
      if (action === "rematch") void rematch.request();
      else if (action === "acceptRematch") void rematch.accept();
      else if (action === "declineRematch") void rematch.decline();
      else if (action === "reviewField") dismissSlip();
      else if (action === "result") restoreSlip();
      else if (action === "newOpponent") {
        // A queue-found match runs under /matchmaking, so the route alone would
        // not remount the queue; the store's search counter does.
        useRoomStore.getState().requestNewSearch();
        router.replace("/matchmaking");
      }
      else if (action === "lobby") {
        // The slip belongs to the match: take it down before the lobby draws.
        dismissSlip();
        router.replace("/lobby");
      }
      // The final ⋯ menu offers profile and sign out (reported 2026-09-21: they did nothing here).
      else if (action === "profile") router.push("/profile");
      else if (action === "signOut") {
        void logoutAction({}).finally(() => {
          useRoomStore.getState().setViewer(null);
          router.replace("/");
          router.refresh();
        });
      }
      else if (action === "resign" || action === "leave") setSlip({ kind: "resign", move: Math.min(youFacts.movesPlayed + 1, match.moveLimit), clockMs, opponentName: opp.displayName });
      else if (action === "keepPlaying") clearSlip("resign");
      else if (action === "confirmResign") {
        clearSlip("resign");
        resignMatch(matchId).catch((e: Error) => push({ kind: "text", text: e.message.toLowerCase() }));
      } else if (action === "keepWaiting") {
        setEndDeferred(true);
        clearSlip("endEarly");
      } else if (action === "endEarly") {
        clearSlip("endEarly");
        claimWinAction(matchId).then((r) => r.status !== "ok" && r.status !== "already_completed" && push({ kind: "text", text: r.status.replace("_", " ") }));
      }
    },
    [matchId, push, rematch, router, dismissSlip, restoreSlip, setSlip, clearSlip, youFacts.movesPlayed, match.moveLimit, clockMs, opp.displayName],
  );

  // `M` mutes; rules are reached through the menu (design system §9).
  useRoomHotkeys(handleAction);

  const rematchLine = rematch.phase === "declined" ? `${opp.displayName} declined` : rematch.phase === "expired" ? "rematch request expired" : rematch.error;
  const allNotices: Notice[] = [
    ...notices,
    ...(completed && rematchLine ? [{ kind: "text", text: rematchLine } as Notice] : []),
    ...(transport.isReconnecting && match.disconnectedPlayerId === currentPlayerId ? [{ kind: "text", text: "reconnecting" } as Notice] : []),
    ...(transport.usePolling && !transport.isReconnecting ? [{ kind: "text", text: "realtime lost · polling" } as Notice] : []),
    ...(transport.pollError ? [{ kind: "text", text: transport.pollError } as Notice] : []),
  ];
  void dismiss;

  return (
    <>
      <MatchRoomView
        matchId={matchId}
        viewerSlot={viewerSlot}
        you={{ name: you.displayName, profileHref: `/profile/${you.username}`, profileInNewTab: !completed, rating: you.eloRating ?? null, finalLine: completed ? ratingLine(ratings, youFacts.playerId, youScoreWins) : undefined, movesPlayed: youFacts.movesPlayed, scoring: youFacts.inFlight !== null, score: youScore }}
        opp={{ name: opp.displayName, profileHref: `/profile/${opp.username}`, profileInNewTab: !completed, rating: opp.eloRating ?? null, finalLine: completed ? ratingLine(ratings, oppFacts.playerId, !youScoreWins && !draw) : undefined, movesPlayed: oppFacts.movesPlayed, scoring: oppFacts.inFlight !== null, score: oppScore, reconnectMsLeft }}
        clockMs={clockMs}
        clockLengthMs={clockLengthMs ?? undefined}
        penalizeUnplayed={completed && (match.endedReason === "incomplete" || match.endedReason === "both_incomplete")}
        moveLimit={match.moveLimit}
        completed={completed}
        caption={completed ? finalCaption(durationMs) : undefined}
        verdict={verdict ?? undefined}
        readOnly={readOnly}
        footActions={
          completed && !readOnly ? (
            <>
              {slipDismissed ? (
                <button type="button" className="action-secondary" data-testid="ledger-result" onClick={() => handleAction("result")}>
                  {RESULT}
                </button>
              ) : null}
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
        playerAId={match.players.playerA.playerId}
        frozenTiles={frozenTiles}
        live={live}
        moveState={moveState}
        holdMove={holdMove}
        notices={allNotices}
        onRowHover={setHighlightMove}
        onAction={handleAction}
      >
        <Field
          board={displayBoard}
          frozenTiles={frozenTiles}
          viewerSlot={viewerSlot}
          ownerNames={ownerNames}
          disabled={completed || readOnly || !canPick}
          turnFrame={completed || readOnly ? null : turnFrameFor(moveState)}
          bands={bands}
          highlightMove={highlightMove}
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
            <dt>Moves</dt>
            <dd>{youFacts.movesPlayed} · {oppFacts.movesPlayed} of {match.moveLimit}</dd>
            <dt>Status</dt>
            <dd>{match.state}</dd>
          </dl>
        </details>
      ) : null}
    </>
  );
}
