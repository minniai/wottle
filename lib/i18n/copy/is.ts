import { LOCALES } from "@/lib/i18n/locales";
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

/** `+8`, `0`, `−8`: a rating change at stake, in ink (never `--err`). */
const stakeIs = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

export const copyIs = {
  /** The game's name, from the locale registry (spec 068: one source, capitalised). */
  WORDMARK: LOCALES.is.wordmark,

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
  THIS_BROWSER_KEEPS_YOUR_NAME: "þessi vafri geymir nafnið þitt",
  WELCOME_BACK: "gaman að sjá þig aftur",
  ENTER_LOBBY: "inn í lobbíið ▸",
  notYou: (name: string): string => `ekki ${name}? · annað nafn`,
  returningLine: (rating: number | null): string => (rating === null ? "íslenska" : `${rating} · íslenska`),
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
  // Line 2 fits one line at 1440 (spec 068 FR-032); the name stays in the nominative.
  frozenJustNow: (name: string): string => `${name} frysti stafinn · veldu annan`,
  movedJustNow: (name: string): string => `${name} færði stafinn · veldu annan`,
  pickClearedMoved: (name: string): string => `val fellt niður · ${name} færði stafinn`,
  settingField: (landed: number): string => `raðar á borðið · ${landed} af 100 stöfum`,

  moveYourMove: (move: number): string => `leikur ${move} · þú átt leik`,
  moveScoring: (move: number): string => `leikur ${move} · reiknast`,
  moveScored: (move: number): string => `leikur ${move} reiknaður`,
  scoredDelta: (delta: number, next: number): string =>
    `þú ${signed(delta)} · leikur ${next} opnast`,
  DONE_PLAYED: "10 af 10 leiknir",
  // Game flow C4 (spec 068): no name after `eftir` (the name-safe rule, §8 item 13).
  doneFact: (opponentName: string, opponentMoves: number, clockMmSs: string): string =>
    `${opponentName} · ${opponentMoves} af 10 · ${clockMmSs} eftir`,
  TIME_SCORING: "tíminn úti · reiknast",
  moveOfSuffix: (move: number): string => `leikur ${move} af 10`,
  moveScoringSuffix: (move: number): string => `leikur ${move} af 10 · reiknast`,
  DONE_SUFFIX: "10 af 10 · búið",
  SCOREBOARD: "stigatafla",
  paceLabel: (seconds: number): string => (seconds < 1 ? "<1 sek á leik" : `≈${seconds} sek á leik`),
  clockOfLength: (elapsedMmSs: string, lengthMmSs: string): string => `${elapsedMmSs} af ${lengthMmSs}`,
  UNDER_A_MINUTE: "innan við mínúta",
  READY: "við borðið",
  moveBehindPace: (move: number): string => `leikur ${move} · á eftir áætlun`,
  goneFor: (moves: number, mmSs: string): string => `${moves} af 10 · án tengingar í ${mmSs}`,
  OFFLINE_RECONNECTING: "án tengingar · tengist aftur",
  profileOpensInNewTab: (name: string): string => `${name}, prófíll opnast í nýjum flipa`,
  movesOf: (moves: number): string => `${moves} af 10`,
  compactMove: (move: number): string => `leikur ${move}`,
  goneForShort: (mmSs: string): string => `án tengingar í ${mmSs}`,
  BEHIND_PACE: "á eftir áætlun",
  OFFLINE: "án tengingar",
  moveNoWord: (move: number): string => `leikur ${move} · ekkert orð`,
  moveOpens: (move: number): string => `leikur ${move} opnast`,
  TOTAL_NEVER_BELOW_ZERO: "samtala fer aldrei undir 0",
  movesLeftShort: (n: number): string => `${n} ${n === 1 ? "leikur" : "leikir"} eftir`,
  IF_UNPLAYED: "ef óleiknir",
  NOTHING_TO_LOSE: "engu að tapa",
  frozenWord: (word: string, owner: string): string => `frosinn · ${word} · ${owner} · veldu annan`,
  backAway: (mmSs: string): string => `tenging komin · ${mmSs} án tengingar`,
  // The name stays in the nominative (game flow §8 item 13).
  oppAnnouncement: (name: string, words: string[], delta: number, moves: number): string =>
    words.length > 0 ? `${name} ${words.join(" · ")} ${signed(delta)} · ${moves} af 10` : `${name} ekkert orð ${points(delta)} · ${moves} af 10`,
  clockMarkLeft: (mmSs: string): string => `${mmSs} eftir`,
  // Without the name: `<nafn> · án tengingar · ljúka viðureigninni ▸` does not fit one line (spec 068 FR-032),
  // and there is only one opponent to mean.
  endEarlyOfferLead: (): string => "án tengingar · ",
  // The name stays in the nominative (game flow §8 item 13): never `leikur Kára`.
  lastMoveOf: (name: string): string => `síðasti leikur · ${name}`,
  tabTitle: (clockMmSs: string, move: number, name: string): string => `${clockMmSs} · leikur ${move} · ${name}`,
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
  opponentBusy: (name: string): string => `${name} getur ekki spilað núna`,

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
  END_THE_MATCH: "ljúka viðureigninni ▸",
  NORMAL_RULES_DECIDE: "venjulegar reglur ráða úrslitum",
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
  // The table (spec 069, game flow C1–C3, B7)
  table: {
    label: (mmSs: string): string => `mótspilari fundinn · ${mmSs}`,
    CONTEXT: "mótspilari fundinn",
    facts: (words: string, moves: number, clockMmSs: string): string => `${words} · ${moves} leikir hvor · ein ${clockMmSs} klukka`, // native-read
    stakes: (win: number, draw: number, loss: number): string => `sigur ${stakeIs(win)} · jafntefli ${stakeIs(draw)} · tap ${stakeIs(loss)}`,
    ON_THE_WAY: "á leiðinni",
    READY: "við borðið",
    NOT_READY: "á leiðinni",
    OPPONENT: "mótspilari",
    seatYou: (name: string): string => `${name} · þú`,
    READY_ACTION: "ég er til ▸",
    YOU_ARE_SEATED: "þú ert við borðið",
    LEAVE: "fara",
    STARTS_WHEN_SEATED: "fer af stað þegar báðir sitja",
    PICK_WHEN_CLOCK_STARTS: "veldu þegar klukkan fer af stað", // native-read
    VOID_LABEL: "engin viðureign",
    voidOppNotSeated: (name: string): string => `${name} settist ekki`,
    voidOppLeft: (name: string): string => `${name} fór frá borðinu`,
    VOID_YOU_NOT_SEATED: "Þú settist ekki í tæka tíð",
    NOTHING_RATED: "hefur ekki áhrif á Elo stig",
    BACK_IN_QUEUE: "þú ert aftur í leitinni", // native-read
    DID_NOT_SIT_DOWN: "settist ekki",
    LEFT: "fór",
    CHALLENGE_AGAIN: "skora aftur á ▸", // native-read
    MISSED_NOTICE: "þú settist ekki · leitin stöðvaðist",
    SEARCH_PAUSED: "leit í bið",
    RESUME: "halda áfram ▸",
    stillSearching: (mmSs: string): string => `Leitar enn? · ${mmSs}`,
    KEEP_SEARCHING: "halda áfram að leita ▸",
    SEARCH_STOPPED: "leit stöðvuð",
    FIND_AGAIN: "leita aftur ▸",
    findAgainIn: (mmSs: string): string => `leita aftur eftir ${mmSs}`,
    titleTable: (name: string): string => `${name} · mótspilari fundinn`,
    titleStarting: (n: number, name: string): string => `${n} · ${name}`,
    titleSearching: (mmSs: string): string => `leitar ${mmSs}`,
  },

  errors: {
    rate_limited: "of margar tilraunir · bíddu í mínútu",
    invalid_name: "3 til 24 stafir, tölur, - eða _",
    name_taken: "þetta nafn er frátekið · veldu annað",
    sign_out_in_match: "kláraðu viðureignina fyrst",
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
    not_started: "viðureignin er ekki hafin",
    table_late: "of seint að setjast",
    table_cooldown: "þú fórst frá tveimur borðum · bíddu í nokkrar mínútur", // native-read
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
  LANGUAGE_WORDS: "íslensk orð",
} satisfies Copy;
