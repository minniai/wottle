/**
 * English strings for the room (design system §8; spec 060: one object per locale,
 * `lib/i18n/copy/is.ts` is the Icelandic).
 *
 * Rules: sentence case for sentences, mono labels are uppercased by CSS (not
 * here), the name is capitalised (Wottle, spec 068), no exclamation marks,
 * numerals carry their unit or context. The clock budget is 5:00 (spec 044, decision Q1).
 */

import { LOCALES } from "@/lib/i18n/locales";

import { pagesEn as pages } from "./pages.en";

/** The game's name, from the locale registry (spec 068: one source, capitalised). */
const WORDMARK = LOCALES.en.wordmark;

// Ledger context captions (spec 050: moves, one clock)
const QUEUE_CONTEXT = "10 moves each · one 5:00 clock";
/** The ledger clock's label (2026-09-21): `match clock`, `last 12s` in the last 15 seconds, `time` at 0:00. */
const MATCH_CLOCK = "match clock";
const lastSeconds = (seconds: number): string => `last ${seconds}s`;
const TIME_SPENT = "time";
const lobbyContext = (hereCount: number): string => `lobby · ${hereCount} here`;
/** `final` is the phase word here, as `lobby` is in lobbyContext; the clock's place holds the match's duration. */
const finalContext = (durationMmSs: string): string => `final · ${durationMmSs}`;

// Player bar — empty / searching seats
const NO_OPPONENT = "No opponent yet";
const NO_OPPONENT_SUBLINE = "about 0:10 to find one";
/** Every match is rated (spec 048), so the action says what it does: search for someone to play. */
const FIND_OPPONENT = "find an opponent ▸";
const PLAY = "play ▸";
const CANCEL = "cancel ▸";
const FINDING_OPPONENT = "Finding an opponent";
const searchingSubline = (elapsedMmSs: string): string =>
  `searching · ${elapsedMmSs} · ${CANCEL}`;
const startsIn = (seconds: number): string => `starts in ${seconds}`;
const YOUR_NAME_PLACEHOLDER = "your name";
const NO_ACCOUNT_NEEDED = "no account needed";
// The returning door (spec 067 US3, artboard DoorReturning)
const THIS_BROWSER_KEEPS_YOUR_NAME = "this browser keeps your name";
const WELCOME_BACK = "welcome back";
const ENTER_LOBBY = "enter the lobby ▸";
const notYou = (name: string): string => `not ${name}? · use another name`;
const returningLine = (rating: number | null): string => (rating === null ? "english" : `${rating} · english`);
const YOU = "you";
const OPPONENT = "opponent";
const RATING_PENDING = "rating pending";
const reconnecting = (remainingMmSs: string): string =>
  `reconnecting · ${remainingMmSs} left`;
const ratingSubline = (before: number, after: number, delta: number, wins: boolean) =>
  `${before} → ${after} · ${delta >= 0 ? "+" : "−"}${Math.abs(delta)}${wins ? " · wins" : ""}`;

// Live row states and hints
const picking = (letter: string, value: number): string =>
  `picking · ${letter} (${value})`;
/** The live row while your own move is in flight or revealing (spec 050). */
const SCORING = "scoring";
const TAP_SECOND_LETTER = "tap a second letter";
/** Spec 047 amendment P1: the live row's two lines — a state, then an instruction. */
const PICK_A_LETTER = "pick a letter";
const NO_WORD = "no word";
const HOVER_ROW_HINT = "hover a row to see its words";
const frozenNotice = (ownerName: string, move: number): string =>
  `frozen · ${ownerName} M${move} · pick another`;
/** A move refused at resolution (spec 050 FR-005): the reason, then the next step. */
// Line 2 fits one line at 1440 (spec 068 FR-032, ≈40 mono characters): these were shortened for it.
const frozenJustNow = (name: string): string => `frozen · ${name} froze it · pick another`;
const movedJustNow = (name: string): string => `moved · ${name} moved it · pick another`;
const pickClearedMoved = (name: string): string => `pick cleared · ${name} moved that letter`;
const settingField = (landed: number): string =>
  `setting the field · ${landed} of 100 letters`;

// Move state (spec 050, contracts/move-state.md): line 1 of the live row, and the bar sub-line suffixes
const moveYourMove = (move: number): string => `move ${move} · your move`;
const moveScoring = (move: number): string => `move ${move} · scoring`;
const moveScored = (move: number): string => `move ${move} scored`;
const signed = (n: number): string => `${n < 0 ? "−" : "+"}${Math.abs(n)}`;
const scoredDelta = (delta: number, next: number): string => `you ${signed(delta)} · move ${next} opens`;
const DONE_PLAYED = "10 of 10 played";
/** Game flow C4's form: the opponent's name, their count and the clock (spec 068 FR-032). */
const doneFact = (opponentName: string, opponentMoves: number, clockMmSs: string): string =>
  `${opponentName} · ${opponentMoves} of 10 · ${clockMmSs} left`;
const TIME_SCORING = "time · scoring";
const moveOfSuffix = (move: number): string => `move ${move} of 10`;
const moveScoringSuffix = (move: number): string => `move ${move} of 10 · scoring`;
const DONE_SUFFIX = "10 of 10 · done";
const oppProgress = (moves: number, state: "playing" | "scoring"): string => `${moves} of 10 · ${state}`;

// The scoreboard (spec 068): the clock row's label and the player rows' states
const SCOREBOARD = "scoreboard";
/** The clock row's label while the move is yours: time left per move left. */
const paceLabel = (seconds: number): string => (seconds < 1 ? "<1s a move" : `≈${seconds}s a move`);
const clockOfLength = (elapsedMmSs: string, lengthMmSs: string): string => `${elapsedMmSs} of ${lengthMmSs}`;
const UNDER_A_MINUTE = "under a minute";
const READY = "ready";
const moveBehindPace = (move: number): string => `move ${move} · behind pace`;
const goneFor = (moves: number, mmSs: string): string => `${moves} of 10 · gone for ${mmSs}`;
const OFFLINE_RECONNECTING = "offline · reconnecting";
// The phone's scoreboard rows: the short forms (spec 068 FR-009)
const movesOf = (moves: number): string => `${moves} of 10`;
const compactMove = (move: number): string => `move ${move}`;
const goneForShort = (mmSs: string): string => `gone for ${mmSs}`;
const steppedOut = (moves: number): string => `${moves} of 10 · stepped out`;
const STEPPED_OUT = "stepped out";
const BEHIND_PACE = "behind pace";
const OFFLINE = "offline";
// The live row's second line (spec 068 FR-028–FR-031, FR-038)
const moveNoWord = (move: number): string => `move ${move} · no word`;
const moveOpens = (move: number): string => `move ${move} opens`;
const TOTAL_NEVER_BELOW_ZERO = "a total never falls below 0";
const movesLeftShort = (n: number): string => `${n} ${n === 1 ? "move" : "moves"} left`;
const IF_UNPLAYED = "if unplayed";
const NOTHING_TO_LOSE = "nothing to lose";
const frozenWord = (word: string, owner: string): string => `frozen · ${word} · ${owner} · pick another`;
const backAway = (mmSs: string): string => `back · away ${mmSs} · the clock ran on`;
/** The room's polite region (spec 068 FR-033, FR-010): the opponent's move, and the clock marks. */
const oppAnnouncement = (name: string, words: string[], delta: number, moves: number): string =>
  words.length > 0 ? `${name} ${words.join(" · ")} ${signed(delta)} · ${moves} of 10` : `${name} ${NO_WORD} ${points(delta)} · ${moves} of 10`;
const clockMarkLeft = (mmSs: string): string => `${mmSs} left`;
const endEarlyOfferLead = (name: string): string => `${name} is gone · `;
/** A cell's label ends with it when a player's last move swapped it (spec 068 FR-027). */
const lastMoveOf = (name: string): string => `${name}'s last move`;
/** The browser tab during a live match (spec 068 FR-025). */
const tabTitle = (clockMmSs: string, move: number, name: string): string => `${clockMmSs} · move ${move} · ${name}`;
const profileOpensInNewTab = (name: string): string => `${name}, profile opens in a new tab`;

// Notices (live-row styled lines)
const rematchRequest = (name: string): string =>
  `${name} asks for a rematch · accept ▸ · decline`;
const waitingForRematch = (name: string): string => `waiting for ${name}`;
// Accepting a challenge from someone who is now in another match (spec 067 FR-019)
const opponentBusy = (name: string): string => `${name} can't play right now`;

// The slip (spec 048, design system §5.9)
/** Under /en the game plays English (spec 060); Icelandic says `íslensk orð`. */
const TAGLINE = "two players · one field · English words";
const NEW_HERE_HOW_TO_PLAY = "new here · how to play ▸";
const SIGN_IN_TO_SET_THE_FIELD = "sign in to set the field";
const RESIGN_QUESTION = "Resign the match?";
/** Spec 069 US8: with the table's loss stake when the room has it, in ink (a rating change is never `--err`). */
const resignConsequence = (opponentName: string, loss?: number): string =>
  `${opponentName} wins · your rating moves as a loss${loss === undefined ? "" : ` · ${stake(loss)}`}`;
const resignLabel = (move: number, clockMmSs: string): string =>
  `move ${move} of 10 · ${clockMmSs} left`;
const YES_RESIGN = "yes, resign ▸";
const KEEP_PLAYING = "keep playing ▸";
const KEEP_WAITING = "keep waiting ▸";
const isGone = (name: string): string => `${name} is gone`;
const END_THE_MATCH = "end the match ▸";
/** The end-early slip's body (game flow C8): ending early costs the viewer nothing. */
const NORMAL_RULES_DECIDE = "the normal rules decide it";
const endEarlyLabel = (clockMmSs: string): string => `10 of 10 played · ${clockMmSs} on the clock`;
const MATCH_OVER = "match over";
/** `match over · 4:52`. Why it ended is the verdict's detail line, said once. */
const matchOverLabel = (durationMmSs: string): string => `${MATCH_OVER} · ${durationMmSs}`;
const winsHeadline = (winnerName: string): string => `${winnerName} wins`;
const DRAW = "draw";
const REVIEW_FIELD = "review the match ▸";
const RESULT = "result ▸";
const HOW_TO_PLAY = "how to play ▸";
const ACCEPT = "accept ▸";
const DECLINE = "decline";

// Verdict
/** A total as drawn: a negative one (from before the §5.6 floor, 2026-09-22) takes a real minus sign. */
const points = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : `${n}`);
/** `134–88`; with a negative total `−4 to −12`, since a dash between minus signs cannot be read. */
const scoreSpan = (a: number, b: number): string => (a < 0 || b < 0 ? `${points(a)} to ${points(b)}` : `${a}–${b}`);
const verdictLine = (winnerName: string, a: number, b: number): string => `${winnerName} wins ${scoreSpan(a, b)}`;
const drawLine = (a: number, b: number): string => `draw ${scoreSpan(a, b)}`;
/** A forced end states what ended it, because `by 0 points` beside a rating change is a lie. */
const forcedDetail = (loserName: string, reason: "forfeit" | "disconnect"): string =>
  reason === "forfeit" ? `${loserName} resigned` : `${loserName} left`;
/** Who was short of ten at 0:00 (rules §2a): their unplayed moves were penalised (§5.6). */
const incompleteDetail = (name: string, moves: number): string => `${name} played ${moves} of 10`;
const NEITHER_FINISHED = "neither finished";
const marginDetail = (margin: number): string => `by ${margin} points`;
/** The ledger's spine (2026-09-21): header, total row and the miss cells. */
const SPINE_HEADER = "move";
const TOTAL_LABEL = "total";
const NOT_PLAYED = "not played";
/** Spec 071: the detail line's clauses, joined with ` · ` (a phone shows the first two). */
const wordsDetail = (a: number, b: number): string => `${a} words to ${b}`;
const territoryDetail = (a: number, b: number): string => `territory ${a}–${b}`;
const ENDED_EARLY = "ended early";
const wasGone = (name: string): string => `${name} was gone`;
const bestWordLine = (word: string, points: number): string => `your best word · ${word} ${points}`;

// Foot actions
const REMATCH = "rematch ▸";
const NEW_OPPONENT = "new opponent ▸";
const LOBBY = "lobby";
const CHALLENGE = "challenge ▸";
const HERE_NOW = "here now";
const YOUR_LAST_MATCHES = "your last matches";
const EMPTY_LOBBY_HINT = "No runs yet. Start one from the lobby.";
/** The phone ledger's live row opens the rest of the ledger (design system §4). */
const HISTORY = "history ▸";
/** A match id that resolves to nothing: the room says so, no page of its own. */
const NO_SUCH_MATCH = "that match does not exist";

// Spec 060: strings that used to be written inline in components
// The ⋯ menu
const MENU = "menu";
const soundToggle = (on: boolean): string => `sound · ${on ? "on" : "off"}`;
const MENU_HOW_TO_PLAY = "how to play";
const MENU_RESIGN = "resign";
const MENU_LEAVE = "leave";
const MENU_PROFILE = "profile";
const SIGN_OUT = "sign out";
// Ledger and bars
const LEDGER = "ledger";
const clockAria = (label: string, time: string): string => `${label}, ${time} left`;
const territoryAria = (you: number, opp: number): string => `territory ${you}–${opp}`;
const CHALLENGES_YOU = "challenges you";
const IN_A_MATCH = "in a match";
const territoryLine = (you: number, free: number, opp: number): string => `${you} · ${free} free · ${opp}`;
const rematchDeclined = (name: string): string => `${name} declined`;
const REMATCH_EXPIRED = "rematch request expired";
const REALTIME_LOST = "realtime lost · polling";
const UNRATED = "unrated";
const YOUR_MOVES = "your moves";
const OPPONENT_MOVES = "opponent's moves";
const SEARCHING = "searching";
const movesLeft = (left: number, limit: number): string => `${left} of ${limit} moves left`;
const CLOSE = "close";
const THE_FIELD = "the field";
/** A cell for AT: `row 8, column F, T, value 2, free` (design system §9). */
const cellLabel = (c: { row: number; column: string; letter: string; value: number; state: string; ownerName?: string }): string =>
  `row ${c.row}, column ${c.column}, ${c.letter}, value ${c.value}, ${c.state === "frozen" && c.ownerName ? `frozen by ${c.ownerName}` : c.state}`;
const THE_OPPONENT = "the opponent";
// Profile
const PROFILE = "profile";
const playingSince = (month: string): string => `playing since ${month}`;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** Written out rather than left to `Intl`, whose month names differ between the server and some browsers. */
const monthYear = (monthIndex: number, year: number): string => `${MONTHS[monthIndex]} ${year}`;
const matchesPlayed = (n: number): string => `${n} matches`;
const ratingPeak = (peak: number, weekDelta: string): string => `rating · peak ${peak} · ${weekDelta} this week`;
const RECORD = "record";
const WON = "won";
const LOST = "lost";
const DRAWN = "drawn";
const WIN_RATE = "win rate";
const BEST_WORDS = "best words";
const RECENT_MATCHES = "recent matches";
const versus = (name: string): string => `vs ${name}`;
const matchResult = (result: "win" | "loss" | "draw"): string => result;
const BACK_LOBBY = "◂ lobby";
const CHANGE_NAME = "change name";
const NO_RATED_MATCHES = "no rated matches in the last 30 days";
const ratingChartAria = (min: number, max: number): string => `rating over the last 30 days, ${min} to ${max}`;
const profileUnavailable = (reason: string | null): string =>
  `profile unavailable · ${(reason ?? "try again in a moment").toLowerCase()}`;
const noSuchPlayer = (handle: string): string => `No such player · @${handle} has not played a round here yet`;
// Messages the server sends back, by code (research R4)
// The table (spec 069, game flow C1–C3, B7)
/** `+8`, `0`, `−8`: a rating change at stake, in ink (never `--err`). */
const stake = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const table = {
  label: (mmSs: string): string => `opponent found · ${mmSs}`,
  CONTEXT: "opponent found",
  facts: (words: string, moves: number, clockMmSs: string): string => `${words} · ${moves} moves each · one ${clockMmSs} clock`,
  stakes: (win: number, draw: number, loss: number): string => `win ${stake(win)} · draw ${stake(draw)} · loss ${stake(loss)}`,
  ON_THE_WAY: "on the way",
  READY: "ready",
  NOT_READY: "not ready",
  OPPONENT: "opponent",
  seatYou: (name: string): string => `${name} · you`,
  READY_ACTION: "ready ▸",
  YOU_ARE_SEATED: "you are seated",
  LEAVE: "leave",
  STARTS_WHEN_SEATED: "starts when both sit",
  PICK_WHEN_CLOCK_STARTS: "pick when the clock starts",
  VOID_LABEL: "no match",
  NOT_STARTED: "not started",
  YOU_LEFT: "You left the table",
  voidOppNotSeated: (name: string): string => `${name} did not sit down`,
  voidOppLeft: (name: string): string => `${name} left the table`,
  VOID_YOU_NOT_SEATED: "You did not sit down in time",
  NOTHING_RATED: "nothing was rated",
  BACK_IN_QUEUE: "you are back in the queue",
  DID_NOT_SIT_DOWN: "did not sit down",
  LEFT: "left",
  CHALLENGE_AGAIN: "challenge again ▸",
  MISSED_NOTICE: "you did not sit down · your search stopped",
  SEARCH_PAUSED: "search paused",
  RESUME: "resume ▸",
  stillSearching: (mmSs: string): string => `Still searching? · ${mmSs}`,
  KEEP_SEARCHING: "keep searching ▸",
  SEARCH_STOPPED: "search stopped",
  FIND_AGAIN: "find again ▸",
  findAgainIn: (mmSs: string): string => `find again in ${mmSs}`,
  titleTable: (name: string): string => `${name} · opponent found`,
  titleStarting: (n: number, name: string): string => `${n} · ${name}`,
  titleSearching: (mmSs: string): string => `searching ${mmSs}`,
};
/** Spec 071 (D2): the rematch negotiation's lines, on the slip or as the ledger's first line. */
/** Spec 071 (FR-018): the rematch series, on the scoreboard's clock row. */
const seriesLine = (ordinal: number, leader: string | null, hi: number, lo: number): string =>
  leader ? `match ${ordinal} · ${leader} ${hi}–${lo}` : `match ${ordinal} · ${hi}–${lo}`;
/** Spec 071 (D3, F7): review, one step at a time. */
const review = {
  step: (n: number, total: number): string => `step ${n} of ${total}`,
  caption: (mmSs: string): string => `review · ${mmSs}`,
  clockAt: (n: number): string => `the clock at step ${n}`,
  CLOCK_THEN: "the clock then",
  atStep: (moves: number, limit: number, n: number): string => `${moves} of ${limit} at step ${n}`,
  movesOf: (moves: number, limit: number): string => `${moves} of ${limit}`,
  move: (n: number, name: string): string => `move ${n} · ${name}`,
  NO_WORD: "no word",
  REFUSED: "refused",
  refusedWhy: (reason: "frozen" | "moved"): string => `refused · ${reason}`,
  TIME: "time",
  ENDED_EARLY: "ended early",
  notPlayed: (points: string): string => `${points} not played`,
  froze: (n: number): string => `froze ${n}`,
  leads: (name: string, hi: number, lo: number): string => `${name} leads ${hi}–${lo}`,
  level: (a: number, b: number): string => `level ${a}–${b}`,
  valueText: (n: number, total: number, who: string, what: string): string => `step ${n} of ${total}, ${who}, ${what}`,
  plus: (n: number): string => `plus ${n}`,
  minus: (n: number): string => `minus ${n}`,
  cellName: (move: number, name: string): string => `move ${move}, ${name}`,
  NOT_YET_REACHED: "not yet reached",
  SCRUBBER: "review step",
  /** Spec 071 (FR-042): a reader's line, above a match they did not play. */
  overLine: (a: string, b: string): string => `this match is over · ${a} – ${b}`,
  FIRST: "first",
  BACK: "back",
  PLAY: "play ▸",
  PAUSE: "pause",
  NEXT: "next",
  LAST: "last",
};
const rematch = {
  sent: (mmSs: string): string => `rematch sent · ${mmSs}`,
  asks: (name: string, mmSs: string): string => `${name} asks for a rematch · ${mmSs}`,
  accepted: (name: string): string => `${name} accepted`,
  declined: (name: string): string => `${name} declined`,
  NO_ANSWER: "no answer",
  withdrew: (name: string): string => `${name} withdrew`,
  startedAnother: (name: string): string => `${name} started another match`,
  hasLeft: (name: string): string => `${name} has left`,
  CANCEL: "cancel ▸",
  title: (name: string, wordmark: string): string => `(1) ${name} asks for a rematch · ${wordmark}`,
};
const errors = {
  rate_limited: "too many tries · wait a minute",
  invalid_name: "3 to 24 letters, digits, - or _",
  name_taken: "that name is taken · pick another",
  sign_out_in_match: "finish your match first",
  login_failed: "could not sign in · try again",
  signed_out: "sign in first",
  queue_failed: "could not start a search · try again",
  invite_failed: "challenge failed",
  rematch_failed: "unable to request a rematch",
  accept_failed: "unable to accept",
  resign_failed: "could not resign · try again",
  move_ended: "the match has ended",
  move_not_started: "the match has not started yet",
  move_deadline: "the clock has run out",
  move_cap: "you have made all your moves",
  move_in_flight: "your previous move is still being scored",
  move_failed: "swap rejected",
  not_started: "the match has not started",
  table_late: "too late to sit down",
  table_cooldown: "you left two tables · wait a few minutes",
  unknown: "something went wrong · try again",
} as const satisfies Record<string, string>;
// Rules page
const RULES_TITLE = "how to play";
const rulesMetaTitle = (wordmark: string): string => `how to play · ${wordmark}`;
const RULES_DESCRIPTION = "Two players, one field, ten moves each. How a match is played and scored.";
const BACK_TO_LOBBY = "back to the lobby ▸";
const scoringRows = (lengthBonus: number, missPenalty: string): Array<{ rule: string; value: string }> => [
  { rule: "letter values", value: "the numerals on the letters, added up" },
  { rule: "length bonus", value: `(letters − 2) × ${lengthBonus}` },
  { rule: "a letter the opponent froze", value: "counts for length, not for points" },
  { rule: "the same word somewhere new", value: "scores again" },
  { rule: "a move with no word", value: `${missPenalty}, never below 0` },
];
// Metadata and the language link
const SITE_DESCRIPTION =
  "A two-player word duel. Swap two letters; words of three or more score and freeze in your ink.";
const LANGUAGE_LINK = "íslenska ▸";
/** The phone foot says which words the match plays (spec 068, artboard PhoneMatch). */
const LANGUAGE_WORDS = "english words";

export const copyEn = {
  WORDMARK,
  QUEUE_CONTEXT,
  MATCH_CLOCK,
  lastSeconds,
  TIME_SPENT,
  lobbyContext,
  finalContext,
  NO_OPPONENT,
  NO_OPPONENT_SUBLINE,
  FIND_OPPONENT,
  PLAY,
  CANCEL,
  FINDING_OPPONENT,
  searchingSubline,
  startsIn,
  YOUR_NAME_PLACEHOLDER,
  NO_ACCOUNT_NEEDED,
  THIS_BROWSER_KEEPS_YOUR_NAME,
  WELCOME_BACK,
  ENTER_LOBBY,
  notYou,
  returningLine,
  YOU,
  OPPONENT,
  RATING_PENDING,
  reconnecting,
  ratingSubline,
  picking,
  SCORING,
  TAP_SECOND_LETTER,
  PICK_A_LETTER,
  NO_WORD,
  HOVER_ROW_HINT,
  frozenNotice,
  frozenJustNow,
  movedJustNow,
  pickClearedMoved,
  settingField,
  moveYourMove,
  moveScoring,
  moveScored,
  scoredDelta,
  DONE_PLAYED,
  doneFact,
  TIME_SCORING,
  moveOfSuffix,
  moveScoringSuffix,
  DONE_SUFFIX,
  oppProgress,
  SCOREBOARD,
  paceLabel,
  clockOfLength,
  UNDER_A_MINUTE,
  READY,
  moveBehindPace,
  goneFor,
  OFFLINE_RECONNECTING,
  profileOpensInNewTab,
  movesOf,
  compactMove,
  goneForShort,
  steppedOut,
  STEPPED_OUT,
  BEHIND_PACE,
  OFFLINE,
  moveNoWord,
  moveOpens,
  TOTAL_NEVER_BELOW_ZERO,
  movesLeftShort,
  IF_UNPLAYED,
  NOTHING_TO_LOSE,
  frozenWord,
  backAway,
  endEarlyOfferLead,
  oppAnnouncement,
  clockMarkLeft,
  lastMoveOf,
  tabTitle,
  rematchRequest,
  waitingForRematch,
  opponentBusy,
  TAGLINE,
  NEW_HERE_HOW_TO_PLAY,
  SIGN_IN_TO_SET_THE_FIELD,
  RESIGN_QUESTION,
  resignConsequence,
  resignLabel,
  YES_RESIGN,
  KEEP_PLAYING,
  KEEP_WAITING,
  isGone,
  END_THE_MATCH,
  NORMAL_RULES_DECIDE,
  endEarlyLabel,
  MATCH_OVER,
  matchOverLabel,
  winsHeadline,
  DRAW,
  REVIEW_FIELD,
  RESULT,
  HOW_TO_PLAY,
  ACCEPT,
  DECLINE,
  points,
  verdictLine,
  drawLine,
  forcedDetail,
  incompleteDetail,
  NEITHER_FINISHED,
  marginDetail,
  SPINE_HEADER,
  TOTAL_LABEL,
  NOT_PLAYED,
  wordsDetail,
  territoryDetail,
  ENDED_EARLY,
  wasGone,
  bestWordLine,
  REMATCH,
  NEW_OPPONENT,
  LOBBY,
  CHALLENGE,
  HERE_NOW,
  YOUR_LAST_MATCHES,
  EMPTY_LOBBY_HINT,
  HISTORY,
  NO_SUCH_MATCH,
  MENU,
  soundToggle,
  MENU_HOW_TO_PLAY,
  MENU_RESIGN,
  MENU_LEAVE,
  MENU_PROFILE,
  SIGN_OUT,
  LEDGER,
  clockAria,
  territoryAria,
  CHALLENGES_YOU,
  IN_A_MATCH,
  territoryLine,
  rematchDeclined,
  REMATCH_EXPIRED,
  REALTIME_LOST,
  UNRATED,
  YOUR_MOVES,
  OPPONENT_MOVES,
  SEARCHING,
  movesLeft,
  CLOSE,
  THE_FIELD,
  cellLabel,
  THE_OPPONENT,
  PROFILE,
  playingSince,
  monthYear,
  matchesPlayed,
  ratingPeak,
  RECORD,
  WON,
  LOST,
  DRAWN,
  WIN_RATE,
  BEST_WORDS,
  RECENT_MATCHES,
  versus,
  matchResult,
  BACK_LOBBY,
  CHANGE_NAME,
  NO_RATED_MATCHES,
  ratingChartAria,
  profileUnavailable,
  noSuchPlayer,
  table,
  rematch,
  review,
  seriesLine,
  pages,
  errors,
  RULES_TITLE,
  rulesMetaTitle,
  RULES_DESCRIPTION,
  BACK_TO_LOBBY,
  scoringRows,
  SITE_DESCRIPTION,
  LANGUAGE_LINK,
  LANGUAGE_WORDS,
};
