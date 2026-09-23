"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { logoutAction } from "@/app/actions/auth/logout";
import { claimWinAction } from "@/app/actions/match/claimWin";
import { getMatchRatings } from "@/app/actions/match/getMatchRatings";
import { resignMatch } from "@/app/actions/match/resignMatch";
import { settleMatch } from "@/app/actions/match/settleMatch";
import { leaveTableAction } from "@/app/actions/match/leaveTable";
import { seatAction } from "@/app/actions/match/seat";
import { sendChallengeAction } from "@/app/actions/challenge/send";
import { useLocalePath } from "@/components/i18n/LocaleProvider";
import type { ErrorCode } from "@/lib/i18n/copy/types";
import { useHapticFeedback } from "@/lib/haptics/useHapticFeedback";
import { usePreferencesStore } from "@/lib/preferences/preferencesStore";
import { bandIdForWord, bandsFromWords } from "@/lib/room/bandGeometry";
import { reportWordIntegrity } from "@/lib/room/wordIntegrity";
import { letterFactsOn, liveStateFor } from "@/lib/room/liveState";
import { formatClock, RECONNECT_WINDOW_MS_CLIENT } from "@/lib/room/clock";
import { applyLetterSwaps } from "@/lib/room/displayBoard";
import { tabTitle } from "@/lib/room/tabTitle";
import { tableSlipFor } from "@/lib/room/tableSlip";
import { lastMoves } from "@/lib/room/lastMoves";
import { PICK_CLEARED_HOLD_MS } from "@/lib/room/notices";
import type { Line2Extras } from "@/lib/room/moveState";
import { timeoutPenalty } from "@/lib/scoring/missPenalty";
import { buildVerdict, finalCaption, moveKeyOf, ratingLine, type AccumulatedWord, type LiveState, type RatingRow } from "@/lib/room/ledgerRows";
import { buildTerritory } from "@/lib/room/ledgerRows";
import { useRematchNegotiation } from "@/lib/room/useRematchNegotiation";
import { useCopy } from "@/components/i18n/LocaleProvider";
import type { LedgerAction, Notice } from "@/lib/room/ledgerTypes";
import { useRoomStore } from "@/lib/room/roomStore";
import { useSoundEffects } from "@/lib/audio/useSoundEffects";
import type { Coordinate } from "@/lib/types/board";
import type { MatchPlayerProfiles, MatchState, MoveRejectionReason, MoveResolution, PlayerSlot } from "@/lib/types/match";
import { boardOrBlank } from "@/lib/constants/board";
import { Field } from "./Field";
import { useStandingSlot } from "@/components/standing/StandingProvider";
import { MatchRoomView } from "./MatchRoomView";
import { useAccumulatedMoves } from "./hooks/useAccumulatedMoves";
import { useWordHistory } from "./hooks/useWordHistory";
import { useDeadlineTick, useServerDrift } from "./hooks/useDeadlineTick";
import { useAnnouncements } from "./hooks/useAnnouncements";
import { useFieldInteraction } from "./hooks/useFieldInteraction";
import { useMatchTransport } from "./hooks/useMatchTransport";
import { useNotices } from "./hooks/useNotices";
import { useNowTick } from "./hooks/useNowTick";
import { tableFacts, useSeatAnnouncement, useTableBackGuard, useTableDeadlineRead } from "./hooks/useTable";
import { useWakeLock } from "./hooks/useWakeLock";
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

/** How long `back · away 0:34 · the clock ran on` holds line 2 (game flow C8). */
const BACK_HOLD_MS = 4_000;

/** How long an illegal pick or a refused move holds the live row before it returns (spec 047 P1, spec 050). */
const NOTICE_HOLD_MS = 2000;
const END_EARLY_RETRIES = 3;
const END_EARLY_RETRY_MARGIN_MS = 250;

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

/** The word a frozen letter belongs to, the earliest that froze it, as the field shows words (spec 068 FR-030). */
function frozenWordAt(words: AccumulatedWord[], at: Coordinate): string | undefined {
  const first = words
    .filter((w) => w.coordinates.some((c) => c.x === at.x && c.y === at.y))
    .sort((a, b) => a.globalSeq - b.globalSeq)[0];
  return first?.word.toLocaleUpperCase();
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

/** The clock's length for this match (5:00 unless the playtest env shortens it); null before it is set. */
function clockLengthOf(clock: MatchState["clock"]): number | null {
  if (!clock?.startedAt || !clock.deadlineAt) return null;
  return new Date(clock.deadlineAt).getTime() - new Date(clock.startedAt).getTime();
}

/**
 * The match phase of the room (spec 044, spec 050). Owns nothing visual: it
 * hydrates the room store, runs transport, and wires the field interaction into
 * bars, field and ledger.
 */
export function MatchRoomController({ initialState, currentPlayerId, matchId, playerProfiles, pollIntervalMs }: MatchRoomControllerProps) {
  const copy = useCopy();
  const { LOBBY, RESULT } = copy;
  const router = useRouter();
  const to = useLocalePath();
  const searchParams = useSearchParams();
  const showDebug = process.env.NODE_ENV !== "production" && searchParams.get("debug") === "1";
  const hydrateMatch = useRoomStore((s) => s.hydrateMatch);
  const match = useRoomStore((s) => s.match) ?? initialState;
  // Spec 069: at the table the server holds the letters; the field is the empty ruled frame.
  const board = useMemo(() => boardOrBlank(match.board), [match.board]);
  const participantSlot: PlayerSlot | null =
    initialState.players.playerA.playerId === currentPlayerId ? "player_a" : initialState.players.playerB.playerId === currentPlayerId ? "player_b" : null;
  /** Read-only non-participants (completed matches only, FR-043a) see player A as the bottom seat. */
  const readOnly = participantSlot === null;
  const viewerSlot: PlayerSlot = participantSlot ?? "player_a";

  useEffect(() => {
    hydrateMatch(initialState, currentPlayerId);
  }, [initialState, currentPlayerId, hydrateMatch]);

  // A rematch's table is a new page (spec 069): Back from it leaves it.
  const onNewMatch = useCallback((newMatchId: string) => router.push(to(`/match/${newMatchId}`)), [router, to]);
  const rematch = useRematchNegotiation({ matchId, currentPlayerId, onNewMatch });
  const transport = useMatchTransport(matchId, currentPlayerId, pollIntervalMs, rematch.handleEvent);
  // Back after an outage: line 2 says how long you were away, for four seconds (spec 068 FR-038).
  const [backAwayMs, setBackAwayMs] = useState<number | null>(null);
  useEffect(() => {
    if (transport.awayMs === null) return;
    setBackAwayMs(transport.awayMs);
    const timer = setTimeout(() => setBackAwayMs(null), BACK_HOLD_MS);
    return () => clearTimeout(timer);
  }, [transport.awayMs]);
  const history = useWordHistory(matchId, match.resolvedSeq);
  const words = useAccumulatedMoves(match, history);

  // Spec 047 FR-002 / spec 049: a record the board does not spell is reported
  // once per match, in every environment.
  useEffect(() => reportWordIntegrity(matchId, board, words), [matchId, board, words]);
  const { notices, push, dismiss } = useNotices();
  // The tick runs from the deadline, so before started_at it reads more than
  // the clock's length: the excess is the server-anchored 3·2·1 (spec 050
  // FR-008), and the caption holds at the full clock meanwhile.
  const tickMs = useDeadlineTick(match.clock);
  const serverDrift = useServerDrift(match.clock);
  const clockLengthMs = clockLengthOf(match.clock);
  const msToStart = clockLengthMs === null ? 0 : tickMs - clockLengthMs;
  const clockMs = clockLengthMs === null ? tickMs : Math.min(tickMs, clockLengthMs);
  const sound = useSoundEffects(usePreferencesStore((s) => s.soundEnabled));
  const haptics = useHapticFeedback(usePreferencesStore((s) => s.hapticsEnabled));

  const opponentSlot = viewerSlot === "player_a" ? "player_b" : "player_a";
  const you = playerProfiles[viewerSlot === "player_a" ? "playerA" : "playerB"];
  const opp = playerProfiles[opponentSlot === "player_a" ? "playerA" : "playerB"];
  const { you: youFacts, opp: oppFacts } = viewerFacts(match, viewerSlot);
  // A void table was never a match (spec 069): it has no result, no ratings and no match-over slip.
  const voided = match.state === "completed" && match.endedReason === "void";
  const completed = match.state === "completed" && !voided;
  const inProgress = match.state === "in_progress";
  const wordmark = copy.WORDMARK;
  useEffect(() => () => void (document.title = wordmark), [wordmark]);
  const frozenTiles = match.frozenTiles;
  // Each player's last swap, ticked in their colour until its letters freeze (spec 068 FR-027).
  const lastResolved = useRoomStore((s) => s.lastResolved);
  const ticks = useMemo(() => {
    const cells = lastMoves({ you: lastResolved[youFacts.playerId] ?? null, opp: lastResolved[oppFacts.playerId] ?? null }, frozenTiles);
    return [
      ...cells.you.map((at) => ({ at, seat: "you" as const, name: you.displayName })),
      ...cells.opp.map((at) => ({ at, seat: "opp" as const, name: opp.displayName })),
    ];
  }, [lastResolved, youFacts.playerId, oppFacts.playerId, frozenTiles, you.displayName, opp.displayName]);
  const frozenKeys = useMemo(() => new Set(Object.keys(frozenTiles)), [frozenTiles]);
  const ownerNames = useMemo(() => ({ player_a: playerProfiles.playerA.displayName, player_b: playerProfiles.playerB.displayName }), [playerProfiles]);

  // An illegal pick or a refused move is a live-row state for two seconds, not
  // a notice line (spec 047 amendment P1, spec 050): the beat stays where the
  // player is reading.
  const [illegal, setIllegal] = useState<{ ownerName: string; round: number; word?: string } | null>(null);
  // Line 2's own holds (spec 068 FR-031): each source keeps its timer; the ledger shows the highest.
  const [pickClearedBy, setPickClearedBy] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdFor = useCallback((timer: typeof pickTimer, set: (v: string | null) => void, value: string, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    set(value);
    timer.current = setTimeout(() => set(null), ms);
  }, []);
  useEffect(() => () => [pickTimer, errorTimer].forEach((t) => t.current && clearTimeout(t.current)), []);
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
      if (kind === "pickCleared") return holdFor(pickTimer, setPickClearedBy, opp.displayName, PICK_CLEARED_HOLD_MS);
      const owner = at ? frozenTiles[`${at.x},${at.y}`]?.owner : undefined;
      const ownerName = owner ? ownerNames[owner] : opp.displayName;
      const move = (at && frozenMove(words, at)) ?? youFacts.movesPlayed;
      const word = at ? frozenWordAt(words, at) : undefined;
      holdNotice(() => setIllegal({ ownerName, round: move, word }), () => setIllegal(null));
    },
    [holdFor, holdNotice, frozenTiles, ownerNames, opp.displayName, words, youFacts.movesPlayed],
  );
  const onRejected = useCallback((code: ErrorCode) => holdFor(errorTimer, setSubmitError, copy.errors[code], NOTICE_HOLD_MS), [holdFor, copy]);
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
  const liveResolution = useRoomStore((st) => st.liveResolution);
  const announcement = useAnnouncements({ liveResolution, opponentId: oppFacts.playerId, opponentName: opp.displayName, opponentSlot: opponentSlot === "player_a" ? "playerA" : "playerB", revealingOwn, clockMs, copy });

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
  // The tab says the table, the count, or the clock and your move (spec 068 FR-025, spec 069 FR-026).
  const tableTitle = moveState.kind === "table" ? { opponentName: opp.displayName } : moveState.kind === "starting" ? { opponentName: opp.displayName, startsIn: moveState.seconds } : undefined;
  const title = tabTitle({ live: inProgress && !readOnly, clockMs, move: Math.min(match.moveLimit, youFacts.movesPlayed + 1), table: readOnly ? undefined : tableTitle }, copy);
  useEffect(() => {
    document.title = title;
  }, [title]);

  // The table (spec 069): its slip is derived from the match and the server-corrected second.
  const atTable = !readOnly && (match.state === "pending" || voided || msToStart > 0);
  const tableNow = useNowTick(atTable) + serverDrift;
  // A phone stays awake at the table (FR-029).
  useWakeLock(atTable && !voided);
  const table = tableFacts(match, viewerSlot);
  // A seated searcher whose table voided is back in the queue (FR-017); spec 070: the search is the
  // standing provider's, one poll for the whole app, and the void slip reads it.
  const standing = useStandingSlot().machine;
  const requeued = standing?.slot.kind === "search" ? standing.slot.search : null;
  const derivedSlip = atTable ? tableSlipFor({ match, viewerSlot, you: { name: you.displayName, rating: you.eloRating ?? null }, opp: { name: opp.displayName, rating: opp.eloRating ?? null }, nowMs: tableNow, copy }) : null;
  const tableSlip = derivedSlip?.kind === "void" && requeued?.kind === "searching" && table.youRequeued
    ? { ...derivedSlip, model: { ...derivedSlip.model, searching: `${copy.SEARCHING} · ${formatClock(requeued.elapsedSeconds * 1000)}` } }
    : derivedSlip;
  const leaveTheTable = useCallback(() => void leaveTableAction(matchId).then(() => router.push(to("/"))), [matchId, router, to]);
  useTableBackGuard(!readOnly && (match.state === "pending" || msToStart > 0), leaveTheTable);
  const tableAnnouncement = useSeatAnnouncement(match, viewerSlot, opp.displayName, copy);
  const refreshMatch = transport.refresh;
  useTableDeadlineRead(match, serverDrift, refreshMatch);

  // At go, focus moves to the field; the live row's polite line announces the first move (spec 068 FR-034).
  const startingNow = moveState.kind === "starting";
  const wasStarting = useRef(startingNow);
  useEffect(() => {
    if (wasStarting.current && !startingNow && !readOnly) {
      document.querySelector<HTMLButtonElement>('[data-testid="field"] [data-testid="field-cell"][tabindex="0"]')?.focus();
      // Go (spec 069 FR-011): the clock runs and `match-start` sounds.
      feedbackRef.current.sound.playMatchStart();
    }
    wasStarting.current = startingNow;
  }, [startingNow, readOnly]);
  // A table that opens while the tab is hidden calls the player with the `challenge` cue (spec 069 FR-027).
  const atTableNow = moveState.kind === "table";
  useEffect(() => {
    if (atTableNow && !readOnly && document.hidden) feedbackRef.current.sound.playChallenge();
  }, [atTableNow, readOnly]);
  const canPick = !readOnly && inProgress && (moveState.kind === "yourMove" || moveState.kind === "rejected") && !slipUp;
  const field = useFieldInteraction({
    matchId,
    board,
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

  const displayBoard = useMemo(() => applyLetterSwaps(board, [field.ownPins]), [board, field.ownPins]);

  const bands = useMemo(() => {
    const all = bandsFromWords({ words, board, frozenTiles, viewerSlot, playerAId: match.players.playerA.playerId, liveMoveKey: revealing ? reveal.moveKey : null, trustMoveKey: reveal.moveKey });
    // New bands of the running reveal go last so `drawnCount` can gate them.
    const fresh = new Set(newIds);
    return [...all.filter((b) => !fresh.has(b.id)), ...all.filter((b) => fresh.has(b.id))];
  }, [words, board, frozenTiles, viewerSlot, match.players.playerA.playerId, revealing, reveal.moveKey, newIds]);
  const drawnCount = revealing ? bands.length - newIds.length + Math.min(progress.bandsDrawn, newIds.length) : null;
  const drawingIndex = revealing && progress.bandsDrawn > 0 && progress.bandsDrawn <= newIds.length ? bands.length - newIds.length + progress.bandsDrawn - 1 : null;
  const [highlightMove, setHighlightMove] = useState<number | null>(null);

  const letterAt = useMemo(() => letterFactsOn(board, match.language), [board, match.language]);
  // The field's own state (pick / illegal); the move's beat is layered on by
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
  // Measured on the server-corrected clock: a wrong device clock must not move the 90s window (spec 068 R9).
  const now = useNowTick(Boolean(disconnectedAt)) + serverDrift;
  const windowMs = match.reconnectWindowMs ?? RECONNECT_WINDOW_MS_CLIENT;
  const reconnectMsLeft = disconnectedAt ? Math.max(0, new Date(disconnectedAt).getTime() + windowMs - now) : null;
  // Past the window the scoreboard counts how long they have been gone, never a frozen 0:00 (spec 068 FR-037).
  const goneForMs = disconnectedAt && reconnectMsLeft === 0 ? Math.max(0, now - new Date(disconnectedAt).getTime() - windowMs) : null;
  const viewerDone = youFacts.movesPlayed >= match.moveLimit;
  const endable = reconnectMsLeft === 0 && viewerDone;
  const setSlip = useRoomStore((s) => s.setSlip);
  const clearSlip = useRoomStore((s) => s.clearSlip);
  // `keep waiting ▸` puts the slip away for the rest of the match; the offer moves to
  // the live row's second line (spec 068 FR-036; the 10s re-raise is gone).
  const [endDeferredFor, setEndDeferredFor] = useState<string | null>(null);
  const endDeferred = endDeferredFor === matchId;
  useEffect(() => {
    if (endable && !endDeferred && !completed) setSlip({ kind: "endEarly", opponentName: opp.displayName, opponentMoves: oppFacts.movesPlayed, clockMs });
    else clearSlip("endEarly");
  }, [endable, endDeferred, completed, opp.displayName, oppFacts.movesPlayed, clockMs, setSlip, clearSlip]);

  // Under 1:00 with a move to make, line 2 prices the moves left at 0:00 (spec 068 FR-029).
  const youMovesLeft = Math.max(0, match.moveLimit - youFacts.movesPlayed);
  const stakes = inProgress && clockMs > 0 && clockMs < 60_000 && youMovesLeft > 0 ? { movesLeft: youMovesLeft, penalty: timeoutPenalty(youFacts.score, youMovesLeft) } : null;
  const line2Extras: Line2Extras = {
    offline: transport.offline && !completed,
    backAwayMs,
    pickClearedBy,
    submitError,
    stakes,
    endEarlyOffer: endable && endDeferred && !completed ? opp.displayName : null,
  };
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
          }, copy)
        : null,
    [copy, completed, you.displayName, opp.displayName, youScore, oppScore, words, youFacts.playerId, oppFacts.playerId, youFacts.movesPlayed, oppFacts.movesPlayed, frozenTiles, viewerSlot, recordedWinnerSeat, match.endedReason],
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

  // The slip counts the window on this device's clock; the server's record can
  // be a few ms younger, so `too_early` is retried once its remaining time passes.
  const endEarly = useCallback(
    function claim(attempt: number): void {
      void claimWinAction(matchId).then((r) => {
        if (r.status === "too_early" && attempt < END_EARLY_RETRIES) setTimeout(() => claim(attempt + 1), r.remainingMs + END_EARLY_RETRY_MARGIN_MS);
        else if (r.status !== "ok" && r.status !== "already_completed") push({ kind: "text", text: r.status.replace("_", " ") });
      });
    },
    [matchId, push],
  );

  const handleAction = useCallback(
    (action: LedgerAction) => {
      if (action === "rematch") void rematch.request();
      else if (action === "acceptRematch") void rematch.accept();
      else if (action === "declineRematch") void rematch.decline();
      else if (action === "reviewField") dismissSlip();
      else if (action === "result" && !voided) restoreSlip();
      else if (action === "newOpponent") {
        // Spec 070: a search runs in the line slot, from the lobby.
        standing?.search.start();
        router.replace(to("/"));
      }
      else if (action === "lobby") {
        // The slip belongs to the match: take it down before the lobby draws.
        dismissSlip();
        router.replace(to("/"));
      }
      // The final ⋯ menu offers profile and sign out (reported 2026-09-21: they did nothing here).
      else if (action === "profile") {
        dismissSlip();
        router.push(to("/profile"));
      }
      else if (action === "signOut") {
        const leave = () => {
          useRoomStore.getState().setViewer(null);
          router.replace(to("/"));
          router.refresh();
        };
        // Signing out is refused while a match is live (spec 067); it never resigns.
        void logoutAction().then((r) => (r.status === "refused" ? push({ kind: "text", text: copy.errors[r.code] }) : leave()), leave);
      }
      else if (action === "sitDown") void seatAction(matchId).then(refreshMatch);
      else if (action === "leaveTable") leaveTheTable();
      else if (action === "cancelQueue") {
        standing?.onAction("cancelSearch");
        router.push(to("/"));
      }
      else if (action === "challengeAgain") {
        // The same player, through the ordinary send (spec 069 clarification Q2); a refusal stays here and says why.
        void sendChallengeAction({ recipientId: oppFacts.playerId }).then((r) => {
          if (r.status === "crossed") router.push(to(`/match/${r.matchId}`));
          else if (r.status === "sent") router.push(to("/"));
          else push({ kind: "text", text: copy.errors[r.status === "cooldown" ? "table_cooldown" : "invite_failed"] });
        });
      }
      else if (action === "result" && voided && match.table.rematchOf) router.push(to(`/match/${match.table.rematchOf}`));
      else if (action === "resign" || action === "leave") {
        // The loss stake the table showed (spec 069 US8); none after a mid-match reload.
        const loss = useRoomStore.getState().stakes?.[youFacts.playerId]?.loss;
        setSlip({ kind: "resign", move: Math.min(youFacts.movesPlayed + 1, match.moveLimit), clockMs, opponentName: opp.displayName, ...(loss === undefined ? {} : { loss }) });
      }
      else if (action === "keepPlaying") clearSlip("resign");
      else if (action === "confirmResign") {
        clearSlip("resign");
        resignMatch(matchId).catch(() => push({ kind: "text", text: copy.errors.resign_failed }));
      } else if (action === "keepWaiting") {
        setEndDeferredFor(matchId);
        clearSlip("endEarly");
      } else if (action === "endEarly") {
        clearSlip("endEarly");
        endEarly(0);
      }
    },
    [copy, endEarly, matchId, push, rematch, router, to, dismissSlip, restoreSlip, setSlip, clearSlip, youFacts.movesPlayed, youFacts.playerId, match.moveLimit, clockMs, opp.displayName, refreshMatch, leaveTheTable, standing, oppFacts.playerId, voided, match.table.rematchOf],
  );

  // `M` mutes; rules are reached through the menu (design system §9).
  useRoomHotkeys(handleAction);

  const rematchLine =
    rematch.phase === "declined" ? copy.rematchDeclined(opp.displayName) : rematch.phase === "expired" ? copy.REMATCH_EXPIRED : rematch.phase === "busy" ? copy.opponentBusy(opp.displayName) : rematch.error ? copy.errors[rematch.error] : null;
  // Steady transport lines first, pushed notices last: on the desktop grid the state row shows the
  // latest one, so a fresh error or rematch line is never hidden behind `realtime lost` (spec 068).
  const allNotices: Notice[] = [
    ...(transport.usePolling && !transport.isReconnecting ? [{ kind: "text", text: copy.REALTIME_LOST } as Notice] : []),
    ...(transport.pollError ? [{ kind: "text", text: transport.pollError } as Notice] : []),
    ...(completed && rematchLine ? [{ kind: "text", text: rematchLine } as Notice] : []),
    ...notices,
  ];
  void dismiss;

  return (
    <>
      <MatchRoomView
        matchId={matchId}
        viewerSlot={viewerSlot}
        you={{ name: you.displayName, profileHref: to(`/profile/${you.username}`), profileInNewTab: !completed, offline: transport.offline && !completed, rating: you.eloRating ?? null, finalLine: completed ? ratingLine(ratings, youFacts.playerId, youScoreWins, copy) : undefined, movesPlayed: youFacts.movesPlayed, scoring: youFacts.inFlight !== null, score: youScore }}
        opp={{ name: opp.displayName, profileHref: to(`/profile/${opp.username}`), profileInNewTab: !completed, rating: opp.eloRating ?? null, finalLine: completed ? ratingLine(ratings, oppFacts.playerId, !youScoreWins && !draw, copy) : undefined, movesPlayed: oppFacts.movesPlayed, scoring: oppFacts.inFlight !== null, score: oppScore, reconnectMsLeft, goneForMs }}
        clockMs={clockMs}
        clockLengthMs={clockLengthMs ?? undefined}
        msToStart={Math.max(0, msToStart)}
        elapsedMs={completed ? durationMs : undefined}
        penalizeUnplayed={completed && (match.endedReason === "incomplete" || match.endedReason === "both_incomplete")}
        moveLimit={match.moveLimit}
        completed={completed}
        caption={completed ? finalCaption(durationMs, copy) : moveState.kind === "table" ? copy.table.CONTEXT : voided ? copy.table.VOID_LABEL : undefined}
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
        line2Extras={line2Extras}
        announcement={tableAnnouncement ?? announcement}
        table={table}
        tableSlip={tableSlip}
        holdMove={holdMove}
        notices={allNotices}
        onRowHover={setHighlightMove}
        onAction={handleAction}
      >
        <Field
          board={displayBoard}
          language={match.language}
          frozenTiles={frozenTiles}
          viewerSlot={viewerSlot}
          ownerNames={ownerNames}
          ticks={ticks}
          disabled={completed || readOnly || !canPick || transport.offline}
          turnFrame={completed || readOnly || transport.offline ? null : turnFrameFor(moveState)}
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
