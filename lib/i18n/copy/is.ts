import { plural } from "@/lib/i18n/plural";
import type { Copy } from "@/lib/i18n/copy/types";

/**
 * Icelandic strings for the room: Orðusta (design system §8; spec 060). Same keys
 * as `en.ts`; each function owns its own word order and number agreement.
 *
 * Words used throughout: a *leikur* is one move, a *viðureign* is the match, the
 * *borð* is the field, *Elo* is the rating and *stig* are points. A player's name
 * never takes a gendered adjective, because the room does not know the gender.
 */

const CANCEL = "hætta við ▸";
const MATCH_OVER = "viðureign lokið";

const signed = (n: number): string => `${n < 0 ? "−" : "+"}${Math.abs(n)}`;
const points = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : `${n}`);
const scoreSpan = (a: number, b: number): string =>
  a < 0 || b < 0 ? `${points(a)} gegn ${points(b)}` : `${a}–${b}`;
/** `með 1 stigi`, `með 46 stigum`. */
const CELL_STATES: Record<string, string> = {
  free: "laus",
  picked: "valinn",
  pinned: "festur",
  frozen: "frosinn",
  scored: "skorar",
};

const MONTHS = [
  "janúar",
  "febrúar",
  "mars",
  "apríl",
  "maí",
  "júní",
  "júlí",
  "ágúst",
  "september",
  "október",
  "nóvember",
  "desember",
];

const byPoints = (n: number): string =>
  `með ${n} ${plural("is", n, { one: "stigi", other: "stigum" })}`;

export const copyIs = {
  WORDMARK: "orðusta",

  QUEUE_CONTEXT: "10 leikir á 5 mínútum",
  MATCH_CLOCK: "leikklukka",
  lastSeconds: (seconds: number): string => `síðustu ${seconds} sek`,
  TIME_SPENT: "tími",
  lobbyContext: (hereCount: number): string => `lobbí · ${hereCount} hér`,
  finalContext: (durationMmSs: string): string => `lok · ${durationMmSs}`,

  NO_OPPONENT: "Enginn mótspilari enn",
  NO_OPPONENT_SUBLINE: "um 10 sekúndur að finna einn",
  FIND_OPPONENT: "finna mótspilara ▸",
  PLAY: "spila ▸",
  CANCEL,
  FINDING_OPPONENT: "Leita að mótspilara",
  searchingSubline: (elapsedMmSs: string): string =>
    `leitar · ${elapsedMmSs} · ${CANCEL}`,
  startsIn: (seconds: number): string => `hefst eftir ${seconds}`,
  YOUR_NAME_PLACEHOLDER: "nafn",
  NO_ACCOUNT_NEEDED: "skráning óþörf",
  YOU: "þú",
  OPPONENT: "mótspilari",
  RATING_PENDING: "reikna Elo stig",
  reconnecting: (remainingMmSs: string): string =>
    `tengist aftur · ${remainingMmSs} eftir`,
  ratingSubline: (before: number, after: number, delta: number, wins: boolean) =>
    `${before} → ${after} · ${delta >= 0 ? "+" : "−"}${Math.abs(delta)}${wins ? " · vinnur" : ""}`,

  picking: (letter: string, value: number): string => `velur · ${letter} (${value})`,
  SCORING: "stigareikningur",
  TAP_SECOND_LETTER: "veldu annan staf",
  PICK_A_LETTER: "veldu staf",
  NO_WORD: "ekkert orð",
  HOVER_ROW_HINT: "færðu bendilinn yfir línu til að sjá orðin",
  frozenNotice: (ownerName: string, move: number): string =>
    `frosinn · ${ownerName} L${move} · veldu annan`,
  frozenJustNow: (name: string): string =>
    `frosinn · ${name} var að frysta hann · veldu annan`,
  movedJustNow: (name: string): string =>
    `færður · ${name} var að færa hann · veldu annan`,
  pickClearedMoved: (name: string): string => `val fellt niður · ${name} færði stafinn`,
  settingField: (landed: number): string => `raðar á borðið · ${landed} af 100 stöfum`,

  moveYourMove: (move: number): string => `leikur ${move} · þú átt leik`,
  moveScoring: (move: number): string => `leikur ${move} · reiknast`,
  moveScored: (move: number): string => `leikur ${move} reiknaður`,
  scoredDelta: (delta: number, next: number): string =>
    `þú ${signed(delta)} · leikur ${next} opnast`,
  DONE_PLAYED: "10 af 10 leiknir",
  doneFact: (opponentName: string, opponentMoves: number, clockMmSs: string): string =>
    `bíður eftir ${opponentName} · ${opponentMoves} af 10 · ${clockMmSs} eftir`,
  TIME_SCORING: "tíminn úti · reiknast",
  moveOfSuffix: (move: number): string => `leikur ${move} af 10`,
  moveScoringSuffix: (move: number): string => `leikur ${move} af 10 · reiknast`,
  DONE_SUFFIX: "10 af 10 · búið",
  oppProgress: (moves: number, state: "playing" | "scoring"): string =>
    `${moves} af 10 · ${state === "playing" ? "að leika" : "reiknast"}`,

  rematchRequest: (name: string): string =>
    `${name} vill aðra viðureign · samþykkja ▸ · hafna`,
  waitingForRematch: (name: string): string => `bíður eftir ${name}`,
  challengeNotice: (name: string): string => `${name} skorar á þig · þiggja ▸ · hafna`,
  challengeSent: (name: string): string => `áskorun send · bíður eftir ${name}`,
  challengeDeclined: (name: string): string => `${name} hafnaði áskoruninni`,
  challengeUnanswered: (name: string): string => `${name} svaraði ekki`,
  challengeTaken: (name: string): string => `${name} þáði aðra áskorun`,

  TAGLINE: "tveir leikmenn · eitt borð · íslensk orð",
  NEW_HERE_HOW_TO_PLAY: "nýr hér · leiðbeiningar ▸",
  SIGN_IN_TO_SET_THE_FIELD: "skráðu þig inn til að raða á borðið",
  RESIGN_QUESTION: "Gefast upp?",
  resignConsequence: (opponentName: string): string =>
    `${opponentName} vinnur · Elo-stigin þín reiknast sem tap`,
  resignLabel: (move: number, clockMmSs: string): string =>
    `leikur ${move} af 10 · ${clockMmSs} eftir`,
  YES_RESIGN: "já, gefast upp ▸",
  KEEP_PLAYING: "halda áfram ▸",
  KEEP_WAITING: "bíða áfram ▸",
  isGone: (name: string): string => `${name} er ekki lengur hér`,
  isGoneFact: (name: string, moves: number): string =>
    `${name} ${moves} af 10 · 0:00 eftir til að tengjast aftur`,
  END_THE_MATCH: "ljúka viðureigninni ▸",
  endEarlyLabel: (clockMmSs: string): string =>
    `10 af 10 leiknir · ${clockMmSs} á klukkunni`,
  MATCH_OVER,
  matchOverLabel: (durationMmSs: string): string => `${MATCH_OVER} · ${durationMmSs}`,
  winsHeadline: (winnerName: string): string => `${winnerName} vann`,
  DRAW: "jafntefli",
  REVIEW_FIELD: "skoða borðið ▸",
  RESULT: "úrslit ▸",
  HOW_TO_PLAY: "leiðbeiningar ▸",
  ACCEPT: "samþykkja ▸",
  DECLINE: "hafna",

  points,
  verdictLine: (winnerName: string, a: number, b: number): string =>
    `${winnerName} vann ${scoreSpan(a, b)}`,
  drawLine: (a: number, b: number): string => `jafntefli ${scoreSpan(a, b)}`,
  forcedDetail: (loserName: string, reason: "forfeit" | "disconnect"): string =>
    reason === "forfeit" ? `${loserName} gafst upp` : `${loserName} fór`,
  incompleteDetail: (name: string, moves: number): string => `${name} lék ${moves} af 10`,
  NEITHER_FINISHED: "hvorugur kláraði",
  marginDetail: (margin: number): string => byPoints(margin),
  SPINE_HEADER: "leikur",
  TOTAL_LABEL: "samtals",
  NOT_PLAYED: "ekki leikinn",
  verdictDetail: (
    margin: number,
    wordsA: number,
    wordsB: number,
    terrA: number,
    terrB: number,
  ) => `${byPoints(margin)} · ${wordsA} orð gegn ${wordsB} · svæði ${terrA}–${terrB}`,

  REMATCH: "annan leik? ▸",
  NEW_OPPONENT: "nýr mótspilari ▸",
  LOBBY: "lobbí",
  CHALLENGE: "skora á ▸",
  HERE_NOW: "hér núna",
  YOUR_LAST_MATCHES: "síðustu viðureignir þínar",
  EMPTY_LOBBY_HINT: "Engar viðureignir enn. Byrjaðu eina úr biðsalnum.",
  HISTORY: "saga ▸",
  NO_SUCH_MATCH: "sú viðureign er ekki til",

  MENU: "valmynd",
  soundToggle: (on: boolean): string => `hljóð · ${on ? "á" : "af"}`,
  MENU_HOW_TO_PLAY: "leiðbeiningar",
  MENU_RESIGN: "gefast upp",
  MENU_LEAVE: "fara",
  MENU_PROFILE: "prófíll",
  SIGN_OUT: "skrá út",
  LEDGER: "leikskrá",
  clockAria: (label: string, time: string): string => `${label}, ${time} eftir`,
  territoryAria: (you: number, opp: number): string => `svæði ${you}–${opp}`,
  CHALLENGES_YOU: "skorar á þig",
  IN_A_MATCH: "í viðureign",
  territoryLine: (you: number, free: number, opp: number): string =>
    `${you} · ${free} lausir · ${opp}`,
  rematchDeclined: (name: string): string => `${name} afþakkaði`,
  REMATCH_EXPIRED: "beiðni um aðra viðureign rann út",
  REALTIME_LOST: "rauntenging rofin · spyr reglulega",
  RECONNECTING: "tengist aftur",
  UNRATED: "ekkert Elo",
  YOUR_MOVES: "leikirnir þínir",
  OPPONENT_MOVES: "leikir andstæðings",
  SEARCHING: "leitar",
  movesLeft: (left: number, limit: number): string => `${left} af ${limit} leikjum eftir`,
  CLOSE: "loka",
  THE_FIELD: "borðið",
  cellLabel: (c: {
    row: number;
    column: string;
    letter: string;
    value: number;
    state: string;
    ownerName?: string;
  }): string =>
    `röð ${c.row}, dálkur ${c.column}, ${c.letter}, gildi ${c.value}, ${c.state === "frozen" && c.ownerName ? `${c.ownerName} frysti` : (CELL_STATES[c.state] ?? c.state)}`,
  THE_OPPONENT: "mótspilarinn",

  PROFILE: "prófíll",
  playingSince: (month: string): string => `spilar síðan ${month}`,
  monthYear: (monthIndex: number, year: number): string =>
    `${MONTHS[monthIndex]} ${year}`,
  matchesPlayed: (n: number): string =>
    `${n} ${plural("is", n, { one: "viðureign", other: "viðureignir" })}`,
  ratingPeak: (peak: number, weekDelta: string): string =>
    `Elo · hæst ${peak} · ${weekDelta} í vikunni`,
  RECORD: "ferill",
  WON: "sigrar",
  LOST: "töp",
  DRAWN: "jafntefli",
  WIN_RATE: "sigurhlutfall",
  BEST_WORDS: "bestu orðin",
  RECENT_MATCHES: "nýlegar viðureignir",
  versus: (name: string): string => `gegn ${name}`,
  matchResult: (result: "win" | "loss" | "draw"): string =>
    result === "win" ? "sigur" : result === "loss" ? "tap" : "jafnt",
  BACK_LOBBY: "◂ lobbí",
  CHANGE_NAME: "breyta nafni",
  NO_RATED_MATCHES: "engar viðureignir síðustu 30 daga",
  ratingChartAria: (min: number, max: number): string =>
    `Elo síðustu 30 daga, ${min} til ${max}`,
  profileUnavailable: (reason: string | null): string =>
    reason
      ? "prófíll ekki tiltækur · reyndu aftur eftir smástund"
      : "prófíll ekki tiltækur",
  noSuchPlayer: (handle: string): string =>
    `Enginn slíkur leikmaður · @${handle} hefur ekki spilað hér`,
  errors: {
    rate_limited: "of margar tilraunir · bíddu í mínútu",
    invalid_name: "3 til 24 stafir, tölur, - eða _",
    login_failed: "innskráning tókst ekki · reyndu aftur",
    signed_out: "skráðu þig fyrst inn",
    queue_failed: "leit hófst ekki · reyndu aftur",
    invite_failed: "áskorun tókst ekki",
    rematch_failed: "ekki tókst að biðja um aðra viðureign",
    accept_failed: "ekki tókst að samþykkja",
    resign_failed: "ekki tókst að gefast upp · reyndu aftur",
    move_ended: "viðureigninni er lokið",
    move_not_started: "viðureignin er ekki hafin",
    move_deadline: "klukkan er runnin út",
    move_cap: "þú hefur leikið öllum leikjunum",
    move_in_flight: "verið er að reikna fyrri leikinn",
    move_failed: "skiptum hafnað",
    unknown: "eitthvað fór úrskeiðis · reyndu aftur",
  },

  RULES_TITLE: "leiðbeiningar",
  rulesMetaTitle: (wordmark: string): string => `leiðbeiningar · ${wordmark}`,
  RULES_DESCRIPTION:
    "Tveir leikmenn, eitt borð, tíu leikir hvor. Svona er Orðusta spiluð og talin.",
  BACK_TO_LOBBY: "fara í lobbíið ▸",
  scoringRows: (
    lengthBonus: number,
    missPenalty: string,
  ): Array<{ rule: string; value: string }> => [
    { rule: "gildi stafa", value: "tölurnar á stöfunum, lagðar saman" },
    { rule: "lengdarbónus", value: `(stafir − 2) × ${lengthBonus}` },
    { rule: "stafur sem mótspilarinn frysti", value: "telur til lengdar, ekki stiga" },
    { rule: "sama orð á nýjum stað", value: "gefur stig aftur" },
    { rule: "leikur án orðs", value: `${missPenalty}, þó aldrei undir 0` },
  ],
  SITE_DESCRIPTION:
    "Orðaeinvígi fyrir tvo. Skiptu á tveimur stöfum; orð með þremur stöfum eða fleiri gefa stig og frjósa í þínum lit.",
  LANGUAGE_LINK: "english ▸",
} satisfies Copy;
