/**
 * Fixed UI strings for the Field & Ledger room (design system §8).
 *
 * Rules: sentence case for sentences, mono labels are uppercased by CSS (not
 * here), the wordmark is always lowercase, no exclamation marks, numerals carry
 * their unit or context. The clock budget is 5:00 (spec 044, decision Q1).
 */

export const WORDMARK = "wottle";

// Ledger context captions (spec 050: moves, one clock)
export const QUEUE_CONTEXT = "10 moves each · one 5:00 clock";
/** The ledger clock's label (2026-09-21): `match clock`, `last 12s` in the last 15 seconds, `time` at 0:00. */
export const MATCH_CLOCK = "match clock";
export const lastSeconds = (seconds: number): string => `last ${seconds}s`;
export const TIME_SPENT = "time";
export const lobbyContext = (hereCount: number): string => `lobby · ${hereCount} here`;
/** `final` is the phase word here, as `lobby` is in lobbyContext; the clock's place holds the match's duration. */
export const finalContext = (durationMmSs: string): string => `final · ${durationMmSs}`;

// Player bar — empty / searching seats
export const NO_OPPONENT = "No opponent yet";
export const NO_OPPONENT_SUBLINE = "about 0:10 to find one";
/** Every match is rated (spec 048), so the action says what it does: search for someone to play. */
export const FIND_OPPONENT = "find an opponent ▸";
export const PLAY = "play ▸";
export const CANCEL = "cancel ▸";
export const FINDING_OPPONENT = "Finding an opponent";
export const searchingSubline = (elapsedMmSs: string): string =>
  `searching · ${elapsedMmSs} · ${CANCEL}`;
export const startsIn = (seconds: number): string => `starts in ${seconds}`;
export const YOUR_NAME_PLACEHOLDER = "your name";
export const NO_ACCOUNT_NEEDED = "no account needed";
export const YOU = "you";
export const OPPONENT = "opponent";
export const RATING_PENDING = "rating pending";
export const reconnecting = (remainingMmSs: string): string =>
  `reconnecting · ${remainingMmSs} left`;
export const ratingSubline = (before: number, after: number, delta: number, wins: boolean) =>
  `${before} → ${after} · ${delta >= 0 ? "+" : "−"}${Math.abs(delta)}${wins ? " · wins" : ""}`;

// Live row states and hints
export const picking = (letter: string, value: number): string =>
  `picking · ${letter} (${value})`;
/** The live row while your own move is in flight or revealing (spec 050). */
export const SCORING = "scoring";
export const TAP_SECOND_LETTER = "tap a second letter";
export const TAP_AGAIN_TO_PLAY = "tap again to play";
export const ESC_CANCELS = "esc cancels";
/** Spec 047 amendment P1: the live row's two lines — a state, then an instruction. */
export const PICK_A_LETTER = "pick a letter";
export const PREVIEWING = "previewing";
export const NO_WORD = "no word";
export const PREVIEW_INSTRUCTION = `${TAP_AGAIN_TO_PLAY} · ${ESC_CANCELS}`;
/** `24 · hestur` or `0 · no word` — the priced preview on the live row's first line. */
export const previewLine = (total: number, words: string[]): string =>
  `${total} · ${words.length > 0 ? words.join(" · ") : NO_WORD}`;
export const HOVER_ROW_HINT = "hover a row to see its words";
export const frozenNotice = (ownerName: string, move: number): string =>
  `frozen · ${ownerName} M${move} · pick another`;
/** A move refused at resolution (spec 050 FR-005): the reason, then the next step. */
export const frozenJustNow = (name: string): string => `frozen · ${name} just froze it · pick another`;
export const movedJustNow = (name: string): string => `moved · ${name} just moved it · pick another`;
export const pickClearedMoved = (name: string): string => `pick cleared · ${name} moved that letter`;
export const settingField = (landed: number): string =>
  `setting the field · ${landed} of 100 letters`;

// Move state (spec 050, contracts/move-state.md): line 1 of the live row, and the bar sub-line suffixes
export const moveYourMove = (move: number): string => `move ${move} · your move`;
export const moveScoring = (move: number): string => `move ${move} · scoring`;
export const moveScored = (move: number): string => `move ${move} scored`;
const signed = (n: number): string => `${n < 0 ? "−" : "+"}${Math.abs(n)}`;
export const scoredDelta = (delta: number, next: number): string => `you ${signed(delta)} · move ${next} opens`;
export const DONE_PLAYED = "10 of 10 played";
export const doneFact = (opponentName: string, opponentMoves: number, clockMmSs: string): string =>
  `waiting for ${opponentName} · ${opponentMoves} of 10 · ${clockMmSs} left`;
export const TIME_SCORING = "time · scoring";
export const moveOfSuffix = (move: number): string => `move ${move} of 10`;
export const moveScoringSuffix = (move: number): string => `move ${move} of 10 · scoring`;
export const DONE_SUFFIX = "10 of 10 · done";
export const oppProgress = (moves: number, state: "playing" | "scoring"): string => `${moves} of 10 · ${state}`;

// Notices (live-row styled lines)
export const rematchRequest = (name: string): string =>
  `${name} asks for a rematch · accept ▸ · decline`;
export const waitingForRematch = (name: string): string => `waiting for ${name}`;
export const challengeNotice = (name: string): string =>
  `${name} challenges you · accept ▸ · decline`;
export const challengeSent = (name: string): string => `challenge sent · waiting for ${name}`;
export const challengeDeclined = (name: string): string => `${name} declined your challenge`;
export const challengeUnanswered = (name: string): string => `${name} did not answer`;
export const challengeTaken = (name: string): string => `${name} took another challenge`;

// The slip (spec 048, design system §5.9)
export const TAGLINE = "two players · one field · Icelandic words";
export const NEW_HERE_HOW_TO_PLAY = "new here · how to play ▸";
export const SIGN_IN_TO_SET_THE_FIELD = "sign in to set the field";
export const RESIGN_QUESTION = "Resign the match?";
export const resignConsequence = (opponentName: string): string =>
  `${opponentName} wins · your rating moves as a loss`;
export const resignLabel = (move: number, clockMmSs: string): string =>
  `move ${move} of 10 · ${clockMmSs} left`;
export const YES_RESIGN = "yes, resign ▸";
export const KEEP_PLAYING = "keep playing ▸";
export const KEEP_WAITING = "keep waiting ▸";
export const isGone = (name: string): string => `${name} is gone`;
/** The end-early slip's fact (spec 050 FR-012): the absent player's count and the spent window. */
export const isGoneFact = (name: string, moves: number): string => `${name} ${moves} of 10 · 0:00 left to reconnect`;
export const END_THE_MATCH = "end the match ▸";
export const endEarlyLabel = (clockMmSs: string): string => `10 of 10 played · ${clockMmSs} on the clock`;
export const MATCH_OVER = "match over";
/** `match over · 4:52`. Why it ended is the verdict's detail line, said once. */
export const matchOverLabel = (durationMmSs: string): string => `${MATCH_OVER} · ${durationMmSs}`;
export const winsHeadline = (winnerName: string): string => `${winnerName} wins`;
export const DRAW = "draw";
export const REVIEW_FIELD = "review the match ▸";
export const RESULT = "result ▸";
export const HOW_TO_PLAY = "how to play ▸";
export const ACCEPT = "accept ▸";
export const DECLINE = "decline";

// Verdict
/** A total as drawn: a negative one takes a real minus sign (rules §5.6 lets totals go below zero). */
export const points = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : `${n}`);
/** `134–88`; with a negative total `−4 to −12`, since a dash between minus signs cannot be read. */
const scoreSpan = (a: number, b: number): string => (a < 0 || b < 0 ? `${points(a)} to ${points(b)}` : `${a}–${b}`);
export const verdictLine = (winnerName: string, a: number, b: number): string => `${winnerName} wins ${scoreSpan(a, b)}`;
export const drawLine = (a: number, b: number): string => `draw ${scoreSpan(a, b)}`;
/** A forced end states what ended it, because `by 0 points` beside a rating change is a lie. */
export const forcedDetail = (loserName: string, reason: "forfeit" | "disconnect"): string =>
  reason === "forfeit" ? `${loserName} resigned` : `${loserName} left`;
/** Who was short of ten at 0:00 (rules §2a): their unplayed moves were penalised (§5.6). */
export const incompleteDetail = (name: string, moves: number): string => `${name} played ${moves} of 10`;
export const NEITHER_FINISHED = "neither finished";
export const marginDetail = (margin: number): string => `by ${margin} points`;
/** The ledger's spine (2026-09-21): header, total row and the miss cells. */
export const SPINE_HEADER = "move";
export const TOTAL_LABEL = "total";
export const NOT_PLAYED = "not played";
export const verdictDetail = (margin: number, wordsA: number, wordsB: number, terrA: number, terrB: number) =>
  `by ${margin} points · ${wordsA} words to ${wordsB} · territory ${terrA}–${terrB}`;

// Foot actions
export const REMATCH = "rematch ▸";
export const NEW_OPPONENT = "new opponent ▸";
export const LOBBY = "lobby";
export const CHALLENGE = "challenge ▸";
export const HERE_NOW = "here now";
export const YOUR_LAST_MATCHES = "your last matches";
export const EMPTY_LOBBY_HINT = "No runs yet. Start one from the lobby.";
/** The phone ledger's live row opens the rest of the ledger (design system §4). */
export const HISTORY = "history ▸";
/** A match id that resolves to nothing: the room says so, no page of its own. */
export const NO_SUCH_MATCH = "that match does not exist";
