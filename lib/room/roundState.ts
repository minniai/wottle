import {
  BOTH_PLAYED_SCORING,
  CLOCK_SPENT,
  opponentThinking,
  outOfTimeWaiting,
  PICK_A_LETTER,
  playedWaiting,
  PLAYED_SUFFIX,
  resolvingRound,
  roundScored,
  roundYourMove,
  scoredDeltas,
  SPENT_SUFFIX,
  THINKING_SUFFIX,
  YOUR_MOVE_SUFFIX,
} from "@/lib/constants/copy";
import type { Seat } from "@/lib/constants/seatColors";
import { liveText, type LiveState } from "./liveLines";
import type { LiveLines } from "./ledgerTypes";
import type { MatchState, PlayerSlot } from "@/lib/types/match";

/**
 * The beat the current round is in, from the viewer's seat (spec 048 US2,
 * contracts/round-state.md). Derived, never stored; it drives the live row's
 * first line, the field's turn frame and both bar sub-lines.
 */
export type RoundState =
  | { kind: "yourMove"; round: number; opponentName: string }
  | { kind: "oppPlayed"; round: number; opponentName: string }
  | { kind: "played"; round: number; opponentName: string }
  | { kind: "resolving"; round: number; opponentName: string }
  | { kind: "scored"; round: number; opponentName: string; you: number; opp: number; next: number }
  | { kind: "outOfTime"; round: number; opponentName: string };

export interface DeriveRoundStateInput {
  match: MatchState;
  viewerSlot: PlayerSlot;
  opponentName: string;
  /** The round whose scored row is held (spec 048 FR-022); null when no hold runs. */
  holdRound: number | null;
  /** A resolved round's reveal is still drawing (a first-mover partial reveal is not resolving). */
  revealing: boolean;
  /** The round that reveal belongs to; the server may already have opened the next. */
  revealRound?: number | null;
}

function scoredDeltasFor(match: MatchState, viewerSlot: PlayerSlot, round: number): { you: number; opp: number } {
  const summary = match.lastSummary;
  if (!summary || summary.roundNumber !== round) return { you: 0, opp: 0 };
  const youKey = viewerSlot === "player_a" ? "playerA" : "playerB";
  const oppKey = viewerSlot === "player_a" ? "playerB" : "playerA";
  return { you: summary.deltas[youKey], opp: summary.deltas[oppKey] };
}

export function deriveRoundState(input: DeriveRoundStateInput): RoundState {
  const { match, viewerSlot, opponentName, holdRound, revealing, revealRound = null } = input;
  const round = match.currentRound;
  const base = { round, opponentName };
  if (holdRound !== null && (holdRound === round - 1 || (match.state === "completed" && holdRound === round))) {
    return { kind: "scored", ...base, round: holdRound, next: holdRound + 1, ...scoredDeltasFor(match, viewerSlot, holdRound) };
  }
  if (revealing) return { kind: "resolving", ...base, round: revealRound ?? round };
  if (match.state === "resolving") return { kind: "resolving", ...base };
  const you = match.timers[viewerSlot === "player_a" ? "playerA" : "playerB"];
  const opp = match.timers[viewerSlot === "player_a" ? "playerB" : "playerA"];
  if (you.remainingMs <= 0 && you.status !== "paused") return { kind: "outOfTime", ...base };
  if (you.status === "paused") return { kind: "played", ...base };
  if (opp.status === "paused") return { kind: "oppPlayed", ...base };
  return { kind: "yourMove", ...base };
}

/** The field's instruction while it is the viewer's move; `played` from the reducer means the commit is in flight. */
function instructionFor(field: LiveState): string {
  if (field.kind === "idle") return PICK_A_LETTER;
  const { line1, line2 } = liveText(field);
  return line2 ? `${line1} · ${line2}` : line1;
}

/**
 * Line 1 is the round's state in the board face, line 2 the instruction or the
 * fact for that state (contracts/round-state.md).
 */
export function liveLinesFor(state: RoundState, field: LiveState): LiveLines {
  const yourTurn = state.kind === "yourMove" || state.kind === "oppPlayed";
  if (yourTurn && field.kind === "played") return { line1: playedWaiting(state.opponentName), line2: opponentThinking(state.opponentName) };
  switch (state.kind) {
    case "yourMove":
    case "oppPlayed":
      return { line1: roundYourMove(state.round), line2: instructionFor(field) };
    case "played":
      return { line1: playedWaiting(state.opponentName), line2: opponentThinking(state.opponentName) };
    case "resolving":
      return { line1: resolvingRound(state.round), line2: BOTH_PLAYED_SCORING };
    case "scored":
      return { line1: roundScored(state.round), line2: scoredDeltas(state.you, state.opp, state.opponentName, state.next) };
    case "outOfTime":
      return { line1: outOfTimeWaiting(state.opponentName), line2: CLOCK_SPENT };
  }
}

/** The suffix a bar's sub-line carries for this beat, or null outside a live round. */
export function barSuffixFor(state: RoundState, seat: Seat): string | null {
  if (seat === "you") {
    if (state.kind === "yourMove" || state.kind === "oppPlayed") return YOUR_MOVE_SUFFIX;
    if (state.kind === "played") return PLAYED_SUFFIX;
    if (state.kind === "outOfTime") return SPENT_SUFFIX;
    return null;
  }
  if (state.kind === "oppPlayed") return PLAYED_SUFFIX;
  if (state.kind === "yourMove" || state.kind === "played" || state.kind === "outOfTime") return THINKING_SUFFIX;
  return null;
}

export function barSublineFor(base: string, state: RoundState, seat: Seat): string {
  const suffix = barSuffixFor(state, seat);
  return suffix ? `${base} · ${suffix}` : base;
}

/** The field is framed in the viewer's seat colour while the move is theirs to make. */
export function turnFrameFor(state: RoundState): Seat | null {
  return state.kind === "yourMove" || state.kind === "oppPlayed" ? "you" : null;
}
