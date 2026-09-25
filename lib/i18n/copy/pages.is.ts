import { plural } from "@/lib/i18n/plural";

import type { pagesEn } from "./pages.en";

/**
 * Icelandic strings for the pages (spec 070). Same keys as `pages.en.ts`. The
 * name-safe rule (game flow §8 item 13): a name appears only in the nominative
 * and never after eftir, gegn, til, frá, á, við or handa, and no gendered word
 * describes a player. Strings the source marks (?) carry `// native-read`.
 */

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

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
  WELCOME: "Velkomin í Orðustu.",
  TAGLINE: "Orðaeinvígi fyrir tvo.",
  NAME_LABEL: "veldu notendanafn",
  NAME_CHARS: "ekkert bil eða tákn · bara stafir, tölur, - og _", // native-read
  NAME_LONG: "mest 24 stafir",
  NAME_SHORT: "minnst 3 stafir",
  ENTERING: "opna lobbíið",
  hereNow: (n: number): string => `hér núna · ${n}`,
  hereNowRated: (n: number, languageName: string): string => `hér núna · ${n} · elo · ${languageName}`,
  more: (n: number): string => `+ ${n} fleiri`,
  ENTER_TO_CHALLENGE: "finna mótspilara í lobbíinu ▸", // native-read
  NO_ONE_YET: "Enginn hér enn.",
  HOW_IT_PLAYS: "leiðbeiningar",
  STEPS: ["Skiptu á tveimur stöfum.", "Þrír stafir eða fleiri í beinni línu.", "Stafir í orði frjósa í þínum lit."],
  doorTitle: (wordmark: string): string => `${wordmark} · orðaeinvígi fyrir tvo`,

  HERE: "hér",
  SEARCHING: "leitar",
  inMatch: (moves: number, limit: number): string => `í viðureign · ${moves} af ${limit}`,
  AWAY: "fjarverandi",
  STEPPED_OUT: "brá sér frá",

  blockSub: (rating: number, languageName: string, matches: number, record: string): string =>
    `${rating} · elo · ${languageName} · ${count(matches, "viðureign", "viðureignir")} · ${record}`,
  blockSubLines: (rating: number, languageName: string, matches: number, record: string): [string, string] =>
    [`${rating} · elo · ${languageName}`, `${count(matches, "viðureign", "viðureignir")} · ${record}`],
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
  callLine2: (rating: string, record: string | null, leftMmSs: string): string =>
    `${rating}${record ? ` · þinn ferill ${record}` : ""} · ${leftMmSs} til að svara`,
  callLine2Phone: (rating: string, record: string | null, leftMmSs: string): string =>
    `${rating}${record ? ` · ${record}` : ""} · ${leftMmSs} til að svara`,
  ACCEPTING_CANCELS_SEARCH: "leitin hættir ef þú samþykkir", // native-read
  skipToCall: (name: string): string => `svara áskoruninni · ${name}`,
  callAnnounce: (name: string, seconds: number): string => `${name} skorar á þig, ${seconds} sekúndur til að svara`,
  sentLine1: (name: string, leftMmSs: string): string => `Áskorun send · ${name} · ${leftMmSs}`,
  sentLine2: (words: string, moves: number, win: number, loss: number): string =>
    `${words} · ${moves} leikir hvor · sigur ${signed(win)} · tap ${signed(loss)}`,
  sentPhone: (name: string, leftMmSs: string): string => `${name} · ${leftMmSs}`,
  SENT_PHONE_LINE2: "áskorun send · haltu skjánum opnum",
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
  overPhoneLine2: (score: string): string => `${score} · viðureigninni er lokið`,
  switchLine1: (languageName: string): string => `þú ert í ${languageName} lobbíinu`, // native-read
  SWITCH_CONSEQUENCE: {
    search: "leitin hættir ef þú skiptir", // native-read
    outgoing: "áskorunin þín fellur niður", // native-read
    incoming: "áskorunum til þín er svarað", // native-read
    link: "tengillinn þinn fellur úr gildi", // native-read
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
    gone: "sá leikmaður er ekki lengur hér", // native-read (no gendered participle, §8 item 13)
    rate_limited: "of margar áskoranir · bíddu í mínútu",
    failed: "áskorun fór ekki · reyndu aftur", // native-read
  },

  // Profiles (spec 072: E1, E2, F9)
  profileRatingLine: (languageName: string, peak: number, week: string | null): string =>
    `elo · ${languageName} · hæst ${peak}${week ? ` · ${week} í vikunni` : ""}`,

  CHART_START: "fyrir 30 dögum",
  CHART_END: "í dag",
  chartEmpty: (rating: number): string => `${rating} · engar viðureignir síðustu 30 daga`,
  OTHER_LANGUAGE_EMPTY: { is: "engar viðureignir á íslensku enn", en: "engar viðureignir á ensku enn" },
  YOUR_MATCHES: "þínar viðureignir",
  PRESENCE: { here: "hér núna", away: "fjarverandi", not_here: "ekki hér" }, // native-read (fjarverandi)
  presenceInMatch: (moves: number, limit: number): string => `í viðureign · ${moves} af ${limit}`,
  presenceOtherLobby: (languageName: string): string => `í ${languageName === "enska" ? "enska" : "íslenska"} lobbíinu`, // native-read
  wordStripAria: (word: string, points: number): string => `${word}, ${points}`,
  profileTitle: (name: string, wordmark: string): string => `${name} · ${wordmark}`,

  NO_SUCH_PLAYER: "Enginn leikmaður með þetta nafn.",
  CLOSE_TAB: "loka flipanum ▸",
  COPY_LINK: "afrita tengil ▸",
  LINK_COPIED_SHORT: "tengill afritaður",
  CHALLENGE_PRIMARY: "skora á ▸",
  profileStakes: (words: string, win: number, draw: number, loss: number): string => `${words} · sigur ${signed(win)} · jafntefli ${signed(draw)} · tap ${signed(loss)}`,

  // Invite links (spec 072: B9, T6, T64)
  INVITE_A_FRIEND: "bjóða vini ▸",
  linkWorksFor: (minutes: number): string => `tengill sem gildir í ${minutes} mínútur`,
  linkCopied: (leftMmSs: string): string => `Tengill afritaður · gildir í ${leftMmSs}`,
  linkOut: (leftMmSs: string): string => `Tengill úti · gildir í ${leftMmSs}`, // native-read
  linkReady: (leftMmSs: string): string => `Tengill tilbúinn · gildir í ${leftMmSs}`, // native-read
  COPY_AGAIN: "afrita aftur ▸",
  NEW_LINK: "nýr tengill ▸", // native-read
  CANCEL_LINK: "ógilda tengil ▸", // native-read
  COPY: "afrita ▸",
  LINK_OUTCOMES: { cancelled: "tengill ógiltur", expired: "tengillinn rann út" }, // native-read
  OWN_LINK: "þetta er tengillinn þinn",
  ownLinkLine2: (leftMmSs: string): string => `gildir í ${leftMmSs}`,
  linkCallLine1: (name: string): string => `${name} býður þér með tengli`, // native-read
  linkCallLine2: (rating: string, words: string, leftMmSs: string): string => `${rating} · ${words} · tengill gildir í ${leftMmSs}`,
  linkCallAnnounce: (name: string): string => `${name} býður þér með tengli`, // native-read
  SENDING_CANCELS_LINK: "tengillinn þinn fellur úr gildi", // native-read
  FINDING_CANCELS_LINK: "tengillinn þinn fellur úr gildi", // native-read
  titleLink: (leftMmSs: string): string => `tengill úti · ${leftMmSs}`, // native-read
  LINK_EXPIRED_NOTE: "þessi tengill er útrunninn",
  inviteLine2: (rating: string, words: string, leftMmSs: string): string => `${rating} · ${words} · tengill gildir í ${leftMmSs}`,
  ENTER_LOBBY_INSTEAD: "bara inn í lobbíið", // native-read
  acceptSignsYouIn: (name: string): string => `Ef þú samþykkir skráirðu þig inn með þessu nafni og sest við borðið · ${name}`, // native-read (name-safe)
  acceptSeatsYou: (name: string): string => `Ef þú samþykkir sestu við borðið · ${name}`, // native-read (name-safe)
  inviteTitle: (name: string, wordmark: string): string => `${name} skorar á þig · ${wordmark}`,
  LINK_BUSY: "þú ert í viðureign",
  LINK_ERRORS: {
    busy_sender: "ljúktu fyrst viðureigninni",
    rate_limited: "of margar áskoranir · bíddu í mínútu",
    failed: "enginn tengill búinn til · reyndu aftur", // native-read
  },

  leaveLabel: (move: number, limit: number, leftMmSs: string): string => `leikur ${move} af ${limit} · ${leftMmSs} eftir`,
  LEAVE_HEADLINE: "Fara úr viðureigninni?",
  LEAVE_BODY: ["klukkan gengur áfram · þú getur komið aftur", "hver óleikinn leikur kostar allt að 5 við 0:00"], // native-read
  STAY: "vera áfram ▸",
  GO_TO_LOBBY: "fara í lobbíið",
};
