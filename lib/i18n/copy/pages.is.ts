import { plural } from "@/lib/i18n/plural";

import type { pagesEn } from "./pages.en";

/**
 * Icelandic strings for the pages (spec 070). Same keys as `pages.en.ts`. The
 * name-safe rule (game flow §8 item 13): a name appears only in the nominative
 * and never after eftir, gegn, til, frá, á, við or handa, and no gendered word
 * describes a player. Strings the source marks (?) carry `// native-read`.
 */

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

/** Masculine nominative, for `leikir` (moves). */
const MOVE_WORDS = ["núll", "einn", "tveir", "þrír", "fjórir", "fimm", "sex", "sjö", "átta", "níu", "tíu", "ellefu", "tólf"];
/** Feminine dative, for `mínútum`; five and up do not decline. */
const MINUTE_WORDS = ["núll", "einni", "tveimur", "þremur", "fjórum", "fimm", "sex", "sjö", "átta", "níu", "tíu", "ellefu", "tólf"];
const word = (table: string[], n: number): string => table[n] ?? String(n);
const count = (n: number, one: string, other: string): string => `${n} ${plural("is", n, { one, other })}`;

type Widen<T> = T extends string ? string : T extends (...args: never[]) => unknown ? T : T extends object ? { [K in keyof T]: Widen<T[K]> } : T;

export const pagesIs: Widen<typeof pagesEn> = {
  switchTo: (n: number | null): string => (n ? `english · ${n} here ▸` : "english ▸"),
  LANGUAGE_SELF: "íslenska",
  preferOther: "Prefer English? · English ▸",
  folio: (wordmark: string, place: string | null): string => (place ? `${wordmark} · ${place}` : wordmark),
  PLACE_LOBBY: "lobbí",
  PLACE_PROFILE: "prófíll",
  PLACE_RULES: "leiðbeiningar",
  slotPlace: (languageName: string, here: number | null, playing: number | null): string =>
    here === null ? `lobbí · ${languageName}` : `lobbí · ${languageName} · ${here} hér · ${playing ?? 0} að spila`,
  terms: (moves: number, clockMmSs: string): string =>
    `allar viðureignir gilda til elo · ${moves} leikir hvor · ein ${clockMmSs} klukka`, // native-read
  LANGUAGE_NAME_IS: "íslenska",
  LANGUAGE_NAME_EN: "enska",
  MAIN: "efni",

  doorCount: (here: number, matches: number): string =>
    `${here} hér núna · ${count(matches, "viðureign í gangi", "viðureignir í gangi")}`,
  doorCountPhone: (here: number): string => `${here} hér núna`,
  KICKER: "orð + orusta · orðaeinvígi fyrir tvo",
  headline: (moves: number): [string, string] => ["Tveir leikmenn, eitt borð,", `${word(MOVE_WORDS, moves)} leikir hvor.`],
  headlinePhone: (moves: number): [string, string, string] => ["Tveir leikmenn,", "eitt borð,", `${word(MOVE_WORDS, moves)} leikir hvor.`],
  lede: (minutes: number): string =>
    `Skiptu á tveimur stöfum og myndaðu orð. Orð sem gefa stig frjósa í þínum lit. Flest stig á ${word(MINUTE_WORDS, minutes)} mínútum vinnur.`, // native-read
  NAME_LABEL: "nafn",
  hereNow: (n: number): string => `hér núna · ${n}`,
  more: (n: number): string => `+ ${n} fleiri`,
  ENTER_TO_CHALLENGE: "farðu inn í lobbíið til að skora á einhvern", // native-read
  NO_ONE_YET: "Enginn hér enn.",
  HOW_IT_PLAYS: "leiðbeiningar",
  STEPS: ["Skiptu á tveimur stöfum.", "Þrír stafir eða fleiri í beinni línu.", "Stafir í orði frjósa í þínum lit."],
  doorTitle: (wordmark: string): string => `${wordmark} · orðaeinvígi fyrir tvo`,
  LOCKUP_LABEL: "Orðusta, Wottle á ensku",

  HERE: "hér",
  SEARCHING: "leitar",
  inMatch: (moves: number, limit: number): string => `í viðureign · ${moves} af ${limit}`,
  AWAY: "fjarverandi",
  STEPPED_OUT: "brá sér frá",

  blockSub: (rating: number, languageName: string, matches: number, record: string): string =>
    `${rating} · elo · ${languageName} · ${count(matches, "viðureign", "viðureignir")} · ${record}`,
  blockSubNew: (rating: number, languageName: string): string => `${rating} · elo · ${languageName} · engin viðureign enn`,
  searchingNow: (n: number): string => (n === 0 ? "enginn leitar núna" : `${n} ${plural("is", n, { one: "leitar", other: "leita" })} núna`),
  LAST_TEN: "síðustu tíu",
  FORM_LETTERS: { W: "S", L: "T", D: "J" },
  formAria: (won: number, lost: number, drawn: number): string =>
    `síðustu tíu: ${count(won, "sigur", "sigrar")}, ${count(lost, "tap", "töp")}${drawn ? `, ${count(drawn, "jafntefli", "jafntefli")}` : ""}`,
  hereNowCaption: (here: number, playing: number): string => `hér núna · ${here} · ${playing} að spila`,
  COL_RATING: "elo",
  COL_RECORD: "þinn ferill",
  COL_STATUS: "staða",
  rowAction: (name: string): string => `${name} · skora á`,
  moreRows: (n: number): string => `+ ${n} fleiri ▸`,
  NO_ONE_ELSE: "Enginn annar er hér.",
  PAIRED_ON_ARRIVAL: "þú færð mótspilara um leið og einhver kemur", // native-read
  TELL_ME: "láta mig vita þegar einhver kemur ▸",
  WE_WILL_TELL: "við látum þig vita · hætta við",
  arrived: (name: string): string => `${name} er hér`,
  LAST_MATCH: "síðasta viðureign",
  winsLine: (name: string, a: number, b: number): string => `${name} vann ${a}–${b}`,
  drawLine: (a: number, b: number): string => `jafntefli ${a}–${b}`,
  lastMatchDetail: (opponent: string, duration: string, when: string): string => `${opponent} · ${duration} · ${when}`,
  TODAY: "í dag",
  YESTERDAY: "í gær",
  REVIEW: "skoða ▸",
  REVIEW_LAST: "skoða síðustu viðureign",
  bandMapAria: (you: string, a: number, opp: string, b: number, when: string): string => `${you} ${a}, ${opp} ${b}, ${when}`,
  RESULT_WORDS: { win: "sigur", loss: "tap", draw: "jafnt" },
  FIRST_MATCH: "Fyrsta viðureignin þín birtist hér.",
  FINISH_FIRST: "ljúktu fyrst viðureigninni",
  WITHDRAWS_YOUR_CHALLENGE: "áskorunin þín fellur niður", // native-read
  SOUND_AFTER_CLICK: "hljóð byrjar eftir fyrsta smell", // native-read
  notificationsToggle: (on: boolean): string => `tilkynningar · ${on ? "á" : "af"}`,
  SIGN_OUT_CANCELS_SEARCH: "útskráning hættir leitinni",
  SIGN_OUT_WITHDRAWS: "útskráning dregur áskorunina til baka", // native-read
  lobbyTitle: (wordmark: string): string => `lobbí · ${wordmark}`,

  CHALLENGES_REGION: "áskoranir",
  callLine1: (name: string): string => `${name} skorar á þig`,
  callLine2: (rating: number, record: string | null, leftMmSs: string): string =>
    `${rating}${record ? ` · þinn ferill ${record}` : ""} · ${leftMmSs} til að svara`,
  callLine2Phone: (rating: number, record: string | null, leftMmSs: string): string =>
    `${rating}${record ? ` · ${record}` : ""} · ${leftMmSs} til að svara`,
  ACCEPTING_CANCELS_SEARCH: "leitin hættir ef þú samþykkir", // native-read
  skipToCall: (name: string): string => `svara áskoruninni · ${name}`,
  callAnnounce: (name: string, seconds: number): string => `${name} skorar á þig, ${seconds} sekúndur til að svara`,
  sentLine1: (name: string, leftMmSs: string): string => `Áskorun send · ${name} · ${leftMmSs}`,
  sentLine2: (words: string, moves: number, win: number, loss: number): string =>
    `${words} · ${moves} leikir hvor · sigur ${signed(win)} · tap ${signed(loss)}`,
  sentPhone: (name: string, leftMmSs: string): string => `áskorun send · ${name} · ${leftMmSs}`,
  WITHDRAW: "draga til baka ▸",
  OUTCOMES: {
    accepted: "samþykkt",
    declined: "hafnaði",
    no_answer: "svaraði ekki",
    started_another: "hóf aðra viðureign",
    left: "fór úr lobbíinu",
    withdrawn: "dregin til baka",
  },
  outcomeAnnounce: (name: string, outcome: string): string => `${name} · ${outcome}`,
  searchLine1: (elapsedMmSs: string): string => `Leitar að mótspilara · ${elapsedMmSs}`,
  searchLine2: (n: number, words: string): string => `${n} ${plural("is", n, { one: "leitar", other: "leita" })} núna · ${words}`,
  SEARCH_ALONE: "enginn annar leitar · skoraðu á einhvern hér fyrir neðan", // native-read
  searchPhone: (elapsedMmSs: string): string => `leitar · ${elapsedMmSs}`,
  KEEP_SCREEN_OPEN: "haltu skjánum opnum",
  matchLine1: (name: string): string => `Viðureignin þín · ${name}`,
  matchLine2: (move: number, limit: number, leftMmSs: string): string => `leikur ${move} af ${limit} · ${leftMmSs} eftir`,
  TABLE_LINE2: "mótspilari fundinn",
  BACK_TO_MATCH: "aftur í viðureignina ▸",
  overLine1: (verdict: string): string => `Viðureigninni er lokið · ${verdict}`,
  switchLine1: (languageName: string): string => `þú ert í ${languageName} lobbíinu`, // native-read
  SWITCH_CONSEQUENCE: {
    search: "leitin hættir ef þú skiptir", // native-read
    outgoing: "áskorunin þín fellur niður", // native-read
    incoming: "áskorunum til þín er svarað", // native-read
  },
  SWITCH: "skipta ▸",
  LOBBY_NAME_IS: "íslenska",
  LOBBY_NAME_EN: "enska",
  titleCall: (n: number, name: string): string => `(${n}) ${name} skorar á þig`,
  titleSent: (leftMmSs: string): string => `áskorun send · ${leftMmSs}`,
  titleRunning: (leftMmSs: string): string => `viðureignin þín · ${leftMmSs}`,
  cantPlay: (name: string): string => `${name} getur ekki spilað núna`,
  senderLeft: (name: string): string => `${name} hætti · áskorunin fellur niður`, // native-read

  composerTerms: (win: number, draw: number, loss: number, words: string, moves: number, clockMmSs: string): string =>
    `gildir til elo · sigur ${signed(win)} · jafntefli ${signed(draw)} · tap ${signed(loss)} · ${words} · ${moves} leikir hvor · ein ${clockMmSs} klukka`, // native-read
  composerTermsPhone: (win: number, draw: number, loss: number, words: string, moves: number): [string, string] => [
    `gildir til elo · ${words} · ${moves} leikir hvor`,
    `sigur ${signed(win)} · jafntefli ${signed(draw)} · tap ${signed(loss)}`,
  ],
  SEND: "senda áskorun ▸",
  NOT_NOW: "ekki núna",
  SENDING_CANCELS_SEARCH: "leitin hættir ef þú sendir", // native-read
  SENDING_WITHDRAWS_OTHER: "hin áskorunin þín fellur niður", // native-read
  rowSent: (leftMmSs: string): string => `send · ${leftMmSs}`,
  againIn: (mmSs: string): string => `aftur eftir ${mmSs}`,
  SEND_ERRORS: {
    in_match: "sá leikmaður er í viðureign",
    gone: "sá leikmaður er farinn",
    rate_limited: "of margar áskoranir · bíddu í mínútu",
    failed: "áskorun fór ekki · reyndu aftur", // native-read
  },

  leaveLabel: (move: number, limit: number, leftMmSs: string): string => `leikur ${move} af ${limit} · ${leftMmSs} eftir`,
  LEAVE_HEADLINE: "Fara úr viðureigninni?",
  LEAVE_BODY: ["klukkan gengur áfram · þú getur komið aftur", "hver óleikinn leikur kostar allt að 5 við 0:00"], // native-read
  STAY: "vera áfram ▸",
  GO_TO_LOBBY: "fara í lobbíið",
};
