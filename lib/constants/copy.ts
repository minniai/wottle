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
export const roundContext = (round: number): string => `ranked · round ${round} of 10`;
export const lobbyContext = (hereCount: number): string => `lobby · ${hereCount} here`;
export const finalContext = (durationMmSs: string): string =>
  `final · 10 rounds · ${durationMmSs}`;

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
export const HERE_NOW = "here now · challenge for a ranked match";
export const YOUR_LAST_MATCHES = "your last matches";
export const EMPTY_LOBBY_HINT = "No runs yet. Start one from the lobby.";
