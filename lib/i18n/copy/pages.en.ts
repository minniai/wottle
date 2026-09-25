/**
 * English strings for the pages (spec 070): the door, the lobby, the line slot,
 * the challenge composer and its outcomes, and the leave slip. Spread into
 * `copyEn` as `pages`; `pages.is.ts` holds the Icelandic. Mono labels are
 * uppercased by CSS, not here.
 */

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const s = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const numberWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

export const pagesEn = {
  // Frame (game flow §5.0)
  switchTo: (count: number | null): string => (count ? `íslenska · ${count} hér ▸` : "íslenska ▸"),
  LANGUAGE_SELF: "english",
  preferOther: "Viltu frekar íslensku? · íslenska ▸",
  folio: (wordmark: string, place: string | null): string => (place ? `${wordmark} · ${place}` : wordmark),
  PLACE_LOBBY: "lobby",
  PLACE_PROFILE: "profile",
  PLACE_RULES: "rules",
  slotPlace: (languageName: string, here: number | null, playing: number | null): string =>
    here === null ? `lobby · ${languageName}` : `lobby · ${languageName} · ${here} here · ${playing ?? 0} playing`,
  terms: (moves: number, clockMmSs: string): string => `every match rated · ${moves} moves each · one ${clockMmSs} clock`,
  LANGUAGE_NAME_IS: "icelandic",
  LANGUAGE_NAME_EN: "english",
  MAIN: "content",

  // Door (A1, F1)
  doorCount: (here: number, matches: number): string => `${here} here now · ${s(matches, "match on", "matches on")}`,
  doorCountPhone: (here: number): string => `${here} here now`,
  KICKER: "word + battle · a word duel for two",
  headline: (moves: number): [string, string] => ["Two players, one field,", `${numberWord(moves)} moves each.`],
  headlinePhone: (moves: number): [string, string, string] => ["Two players,", "one field,", `${numberWord(moves)} moves each.`],
  lede: (minutes: number): string =>
    `Swap two letters to make words. Every word you score freezes in your colour. Most points in ${numberWord(minutes)} minutes wins.`,
  NAME_LABEL: "your name",
  hereNow: (n: number): string => `here now · ${n}`,
  hereNowRated: (n: number, languageName: string): string => `here now · ${n} · rating · ${languageName}`,
  more: (n: number): string => `+ ${n} more`,
  ENTER_TO_CHALLENGE: "enter the lobby to challenge someone",
  NO_ONE_YET: "No one here yet.",
  HOW_IT_PLAYS: "how it plays",
  STEPS: ["Swap two letters.", "Three letters or more, in a line.", "Scored letters freeze in your colour."],
  doorTitle: (wordmark: string): string => `${wordmark} · a word duel for two`,
  LOCKUP_LABEL: "Wottle, Orðusta in Icelandic",

  // Presence (§7.1)
  HERE: "here",
  SEARCHING: "searching",
  inMatch: (moves: number, limit: number): string => `in a match · ${moves} of ${limit}`,
  AWAY: "away",
  STEPPED_OUT: "stepped out",

  // Lobby (B1, F2)
  blockSub: (rating: number, languageName: string, matches: number, record: string): string =>
    `${rating} · rating · ${languageName} · ${s(matches, "match", "matches")} · ${record}`,
  blockSubLines: (rating: number, languageName: string, matches: number, record: string): [string, string] =>
    [`${rating} · rating · ${languageName}`, `${s(matches, "match", "matches")} · ${record}`],
  blockSubNew: (rating: number, languageName: string): string => `${rating} · rating · ${languageName} · no matches yet`,
  searchingNow: (n: number): string => (n === 0 ? "nobody searching now" : `${n} searching now`),
  LAST_TEN: "last ten",
  FORM_LETTERS: { W: "W", L: "L", D: "D" },
  formAria: (won: number, lost: number, drawn: number): string =>
    `last ten: ${won} won, ${lost} lost${drawn ? `, ${drawn} drawn` : ""}`,
  hereNowCaption: (here: number, playing: number): string => `here now · ${here} · ${playing} playing`,
  COL_RATING: "rating",
  COL_RECORD: "your record",
  COL_STATUS: "status",
  rowAction: (name: string): string => `${name} · challenge`,
  moreRows: (n: number): string => `+ ${n} more ▸`,
  NO_ONE_ELSE: "No one else is here.",
  PAIRED_ON_ARRIVAL: "you will be paired as soon as someone arrives",
  TELL_ME: "tell me when someone is here ▸",
  WE_WILL_TELL: "we will tell you · cancel",
  arrived: (name: string): string => `${name} is here`,
  LAST_MATCH: "last match",
  winsLine: (name: string, a: number, b: number): string => `${name} wins ${a}–${b}`,
  drawLine: (a: number, b: number): string => `draw ${a}–${b}`,
  lastMatchDetail: (opponent: string, duration: string, when: string): string => `${opponent} · ${duration} · ${when}`,
  TODAY: "today",
  YESTERDAY: "yesterday",
  REVIEW: "review ▸",
  REVIEW_LAST: "review your last match",
  bandMapAria: (you: string, a: number, opp: string, b: number, when: string): string => `${you} ${a}, ${opp} ${b}, ${when}`,
  RESULT_WORDS: { win: "win", loss: "loss", draw: "draw" },
  FIRST_MATCH: "Your first match will show here.",
  FINISH_FIRST: "finish your match first",
  WITHDRAWS_YOUR_CHALLENGE: "withdraws your challenge",
  SOUND_AFTER_CLICK: "sound starts after your first click",
  notificationsToggle: (on: boolean): string => `notifications · ${on ? "on" : "off"}`,
  SIGN_OUT_CANCELS_SEARCH: "signing out cancels your search",
  SIGN_OUT_WITHDRAWS: "signing out withdraws your challenge",
  lobbyTitle: (wordmark: string): string => `lobby · ${wordmark}`,

  // Line slot (B3–B8)
  CHALLENGES_REGION: "challenges",
  callLine1: (name: string): string => `${name} challenges you`,
  callLine2: (rating: string, record: string | null, leftMmSs: string): string =>
    `${rating}${record ? ` · your record ${record}` : ""} · ${leftMmSs} to answer`,
  callLine2Phone: (rating: string, record: string | null, leftMmSs: string): string =>
    `${rating}${record ? ` · ${record}` : ""} · ${leftMmSs} to answer`,
  ACCEPTING_CANCELS_SEARCH: "accepting cancels your search",
  skipToCall: (name: string): string => `answer the challenge from ${name}`,
  callAnnounce: (name: string, seconds: number): string => `${name} challenges you, ${seconds} seconds to answer`,
  sentLine1: (name: string, leftMmSs: string): string => `Challenge sent · ${name} · ${leftMmSs}`,
  sentLine2: (words: string, moves: number, win: number, loss: number): string =>
    `${words} · ${moves} moves each · win ${signed(win)} · loss ${signed(loss)}`,
  sentPhone: (name: string, leftMmSs: string): string => `${name} · ${leftMmSs}`,
  SENT_PHONE_LINE2: "challenge sent · keep this screen open",
  WITHDRAW: "withdraw ▸",
  OUTCOMES: {
    accepted: "accepted",
    declined: "declined",
    no_answer: "no answer",
    started_another: "started another match",
    left: "left the lobby",
    withdrawn: "withdrawn",
  },
  outcomeAnnounce: (name: string, outcome: string): string => `${name} · ${outcome}`,
  searchLine1: (elapsedMmSs: string): string => `Searching for an opponent · ${elapsedMmSs}`,
  searchLine2: (n: number, words: string): string => `${n} searching now · ${words}`,
  SEARCH_ALONE: "no one else is searching · challenge someone below",
  searchPhone: (elapsedMmSs: string): string => `searching · ${elapsedMmSs}`,
  KEEP_SCREEN_OPEN: "keep this screen open",
  matchLine1: (name: string): string => `Your match · ${name}`,
  matchLine2: (move: number, limit: number, leftMmSs: string): string => `move ${move} of ${limit} · ${leftMmSs} left`,
  TABLE_LINE2: "opponent found",
  BACK_TO_MATCH: "back to the match ▸",
  overLine1: (verdict: string): string => `Your match is over · ${verdict}`,
  overPhoneLine2: (score: string): string => `${score} · your match is over`,
  switchLine1: (languageName: string): string => `you are in the ${languageName} lobby`,
  SWITCH_CONSEQUENCE: {
    search: "switching cancels your search",
    outgoing: "switching withdraws your challenge",
    incoming: "switching answers your challenges",
    link: "switching cancels your link",
  },
  SWITCH: "switch ▸",
  LOBBY_NAME_IS: "Icelandic",
  LOBBY_NAME_EN: "English",
  titleCall: (count: number, name: string): string => `(${count}) ${name} challenges you`,
  titleSent: (leftMmSs: string): string => `challenge sent · ${leftMmSs}`,
  titleRunning: (leftMmSs: string): string => `your match · ${leftMmSs}`,
  cantPlay: (name: string): string => `${name} can't play right now`,
  senderLeft: (name: string): string => `${name} has left · challenge withdrawn`,

  // Composer (B2, F6)
  composerTerms: (win: number, draw: number, loss: number, words: string, moves: number, clockMmSs: string): string =>
    `every match rated · win ${signed(win)} · draw ${signed(draw)} · loss ${signed(loss)} · ${words} · ${moves} moves each · one ${clockMmSs} clock`,
  composerTermsPhone: (win: number, draw: number, loss: number, words: string, moves: number): [string, string] => [
    `every match rated · ${words} · ${moves} moves each`,
    `win ${signed(win)} · draw ${signed(draw)} · loss ${signed(loss)}`,
  ],
  SEND: "send challenge ▸",
  NOT_NOW: "not now",
  SENDING_CANCELS_SEARCH: "sending cancels your search",
  SENDING_WITHDRAWS_OTHER: "sending withdraws your other challenge",
  rowSent: (leftMmSs: string): string => `sent · ${leftMmSs}`,
  againIn: (mmSs: string): string => `again in ${mmSs}`,
  SEND_ERRORS: {
    in_match: "that player is in a match",
    gone: "that player has left",
    rate_limited: "too many challenges · wait a minute",
    failed: "challenge not sent · try again",
  },

  // Profiles (spec 072: E1, E2, F9)
  profileRatingLine: (languageName: string, peak: number, week: string | null): string =>
    `rating · ${languageName} · peak ${peak}${week ? ` · ${week} this week` : ""}`,

  CHART_START: "30 days ago",
  CHART_END: "today",
  chartEmpty: (rating: number): string => `${rating} · no matches in the last 30 days`,
  OTHER_LANGUAGE_EMPTY: { is: "no Icelandic matches yet", en: "no English matches yet" },
  YOUR_MATCHES: "your matches",
  PRESENCE: { here: "here now", away: "away", not_here: "not here" },
  presenceInMatch: (moves: number, limit: number): string => `in a match · ${moves} of ${limit}`,
  presenceOtherLobby: (languageName: string): string => `in the ${languageName} lobby`,
  wordStripAria: (word: string, points: number): string => `${word}, ${points}`,
  profileTitle: (name: string, wordmark: string): string => `${name} · ${wordmark}`,

  NO_SUCH_PLAYER: "No player by that name.",
  CLOSE_TAB: "close this tab ▸",
  COPY_LINK: "copy link ▸",
  LINK_COPIED_SHORT: "link copied",
  CHALLENGE_PRIMARY: "challenge ▸",
  profileStakes: (words: string, win: number, draw: number, loss: number): string => `${words} · win ${signed(win)} · draw ${signed(draw)} · loss ${signed(loss)}`,

  // Invite links (spec 072: B9, T6, T64)
  INVITE_A_FRIEND: "invite a friend ▸",
  linkWorksFor: (minutes: number): string => `a link that works for ${minutes} minutes`,
  linkCopied: (leftMmSs: string): string => `Link copied · valid ${leftMmSs}`,
  linkOut: (leftMmSs: string): string => `Link out · valid ${leftMmSs}`,
  linkReady: (leftMmSs: string): string => `Link ready · valid ${leftMmSs}`,
  COPY_AGAIN: "copy again ▸",
  NEW_LINK: "new link ▸",
  CANCEL_LINK: "cancel link ▸",
  COPY: "copy ▸",
  LINK_OUTCOMES: { cancelled: "link cancelled", expired: "link expired" },
  OWN_LINK: "this is your link",
  ownLinkLine2: (leftMmSs: string): string => `valid ${leftMmSs}`,
  linkCallLine1: (name: string): string => `${name} invites you by link`,
  linkCallLine2: (rating: string, words: string, leftMmSs: string): string => `${rating} · ${words} · link valid ${leftMmSs}`,
  linkCallAnnounce: (name: string): string => `${name} invites you by link`,
  SENDING_CANCELS_LINK: "sending cancels your link",
  FINDING_CANCELS_LINK: "finding cancels your link",
  titleLink: (leftMmSs: string): string => `link out · ${leftMmSs}`,
  LINK_EXPIRED_NOTE: "this link has expired",
  inviteLine2: (rating: string, words: string, leftMmSs: string): string => `${rating} · ${words} · link valid ${leftMmSs}`,
  ENTER_LOBBY_INSTEAD: "enter the lobby instead",
  acceptSignsYouIn: (name: string): string => `Accepting signs you in with this name and seats you at ${name}'s table.`,
  acceptSeatsYou: (name: string): string => `Accepting seats you at ${name}'s table.`,
  inviteTitle: (name: string, wordmark: string): string => `${name} challenges you · ${wordmark}`,
  LINK_BUSY: "you are in a match",
  LINK_ERRORS: {
    busy_sender: "finish your match first",
    rate_limited: "too many challenges · wait a minute",
    failed: "no link made · try again",
  },

  // Leave slip (C7, F8)
  leaveLabel: (move: number, limit: number, leftMmSs: string): string => `move ${move} of ${limit} · ${leftMmSs} left`,
  LEAVE_HEADLINE: "Leave the match?",
  LEAVE_BODY: ["the clock keeps running · you can come back", "each unplayed move costs up to 5 at 0:00"],
  STAY: "stay ▸",
  GO_TO_LOBBY: "go to the lobby",
};
