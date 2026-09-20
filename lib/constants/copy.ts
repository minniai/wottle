/**
 * Fixed UI strings for the Field & Ledger room (design system §8).
 *
 * Rules: sentence case for sentences, mono labels are uppercased by CSS (not
 * here), the wordmark is always lowercase, no exclamation marks, numerals carry
 * their unit or context. The clock budget is 5:00 (spec 044, decision Q1).
 */

export const WORDMARK = "wottle";

// Ledger context captions
export const QUEUE_CONTEXT = "ranked · 10 rounds · 5:00 clocks";
/** A directory challenge does not move ratings, and says so (spec 045 decision 1). */
export const rankLabel = (rated: boolean): string => (rated ? "ranked" : "unranked");
export const roundContext = (round: number, rated = true): string =>
  `${rankLabel(rated)} · round ${round} of 10`;
export const lobbyContext = (hereCount: number): string => `lobby · ${hereCount} here`;
/**
 * `final` is the phase word here, as `lobby` is in lobbyContext — the review's
 * §3 lists this string as already matching the design, so it stays. An unranked
 * match says so; a ranked one needs no label, since its rating lines say it.
 */
export const finalContext = (durationMmSs: string, rated = true): string =>
  rated ? `final · 10 rounds · ${durationMmSs}` : `final · unranked · 10 rounds · ${durationMmSs}`;

// Player bar — empty / searching seats
export const NO_OPPONENT = "No opponent yet";
export const NO_OPPONENT_SUBLINE = "ranked · about 0:10 to find one";
export const PLAY_RANKED = "play ranked ▸";
export const PLAY = "play ▸";
export const CANCEL = "cancel ▸";
export const FINDING_OPPONENT = "Finding an opponent";
export const searchingSubline = (elapsedMmSs: string): string =>
  `ranked · ${elapsedMmSs} · ${CANCEL}`;
export const roundOneIn = (seconds: number): string => `round 1 in ${seconds}`;
export const YOUR_NAME_PLACEHOLDER = "your name";
export const NO_ACCOUNT_NEEDED = "no account needed";
export const YOU = "you";
export const OPPONENT = "opponent";
export const RATING_PENDING = "rating pending";
/** An unranked match never writes a rating, so its bars say so once, not "pending" forever. */
export const NO_RATING = "unranked · no rating change";
export const reconnecting = (remainingMmSs: string): string =>
  `reconnecting · ${remainingMmSs} left`;
export const ratingSubline = (before: number, after: number, delta: number, wins: boolean) =>
  `${before} → ${after} · ${delta >= 0 ? "+" : "−"}${Math.abs(delta)}${wins ? " · wins" : ""}`;

// Live row states and hints
export const picking = (letter: string, value: number): string =>
  `picking · ${letter} (${value})`;
export const PLAYED = "played ●";
export const TAP_SECOND_LETTER = "tap a second letter";
export const TAP_AGAIN_TO_PLAY = "tap again to play";
export const ESC_CANCELS = "esc cancels";
/** Spec 047 amendment P1: the live row's two lines — a state, then an instruction. */
export const PICK_A_LETTER = "pick a letter";
export const PREVIEWING = "previewing";
export const NO_WORD = "no word";
export const RESOLVING = "resolving";
export const PREVIEW_INSTRUCTION = `${TAP_AGAIN_TO_PLAY} · ${ESC_CANCELS}`;
/** `24 · hestur` or `0 · no word` — the priced preview on the live row's first line. */
export const previewLine = (total: number, words: string[]): string =>
  `${total} · ${words.length > 0 ? words.join(" · ") : NO_WORD}`;
export const HOVER_ROW_HINT = "hover a row to see its words";
export const frozenNotice = (ownerName: string, round: number): string =>
  `frozen · ${ownerName} R${round} · pick another`;
export const PICK_CLEARED_OPPONENT = "pick cleared · the opponent pinned that letter";
export const settingField = (landed: number): string =>
  `setting the field · ${landed} of 100 letters`;
export const FIRST_MATCH_RULES =
  "Swap two letters. Words of three or more score and freeze in your ink. Ten rounds; your clock holds five minutes for all of them.";

// Notices (live-row styled lines)
export const rematchRequest = (name: string): string =>
  `${name} asks for a rematch · accept ▸ · decline`;
export const RESIGN_CONFIRM = "resign the match? · yes, resign ▸ · no";
export const waitingForRematch = (name: string): string => `waiting for ${name}`;
export const claimWinLine = (name: string): string => `${name} is gone · claim the win ▸`;
export const challengeNotice = (name: string): string =>
  `${name} challenges you · accept ▸ · decline`;

// The slip (spec 048, design system §5.9)
export const TAGLINE = "two players · one field · Icelandic words";
export const NEW_HERE_HOW_TO_PLAY = "new here · how to play ▸";
export const SIGN_IN_TO_SET_THE_FIELD = "sign in to set the field";
export const RESIGN_QUESTION = "Resign the match?";
export const resignConsequence = (opponentName: string): string =>
  `${opponentName} wins · your rating moves as a loss`;
export const resignLabel = (round: number, clockMmSs: string): string =>
  `round ${round} of 10 · ${clockMmSs} on your clock`;
export const YES_RESIGN = "yes, resign ▸";
export const KEEP_PLAYING = "keep playing ▸";
export const KEEP_WAITING = "keep waiting ▸";
export const isGone = (name: string): string => `${name} is gone`;
export const RECONNECT_SPENT = "0:00 left to reconnect";
export const CLAIM_THE_WIN = "claim the win ▸";
export const MATCH_OVER = "match over";
export const matchOverReason = (reason: "rounds" | "resigned" | "timeout" | "abandoned", opponentName: string): string =>
  reason === "resigned" ? " · resigned" : reason === "timeout" ? " · out of time" : reason === "abandoned" ? ` · ${opponentName} left` : "";
export const matchOverLabel = (rounds: number, durationMmSs: string, reasonSuffix = ""): string =>
  `${MATCH_OVER} · ${rounds} rounds · ${durationMmSs}${reasonSuffix}`;
export const winsHeadline = (winnerName: string): string => `${winnerName} wins`;
export const DRAW = "draw";
export const REVIEW_FIELD = "review the field ▸";
export const RESULT = "result ▸";
export const HOW_TO_PLAY = "how to play ▸";
export const ACCEPT = "accept ▸";
export const DECLINE = "decline";

// Verdict
export const verdictLine = (winnerName: string, a: number, b: number): string =>
  `${winnerName} wins ${a}–${b}`;
export const drawLine = (a: number, b: number): string => `draw ${a}–${b}`;
export const verdictDetail = (margin: number, wordsA: number, wordsB: number, terrA: number, terrB: number) =>
  `by ${margin} points · ${wordsA} words to ${wordsB} · territory ${terrA}–${terrB}`;

// Foot actions
export const RULES = "? rules";
export const REMATCH = "rematch ▸";
export const NEW_OPPONENT = "new opponent ▸";
export const LOBBY = "lobby";
export const CHALLENGE = "challenge ▸";
export const HERE_NOW = "here now · challenge for an unranked match";
export const YOUR_LAST_MATCHES = "your last matches";
export const EMPTY_LOBBY_HINT = "No runs yet. Start one from the lobby.";
/** The phone ledger's live row opens the rest of the ledger (design system §4). */
export const HISTORY = "history ▸";
/** A match id that resolves to nothing: the room says so, no page of its own. */
export const NO_SUCH_MATCH = "that match does not exist";
