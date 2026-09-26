import type { LobbyViewer } from "@/components/page/lobby/YourBlock";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { HeldOutcome } from "@/lib/pages/heldOutcome";
import type { SlotState } from "@/lib/pages/standingSlot";
import type { LinkView } from "@/lib/types/link";
import type { ProfileView } from "@/lib/types/profile";
import type { Band, FormResult, LobbyRow, Overview, StandingFacts } from "@/lib/types/standing";

/**
 * Page fixtures (spec 070 T017, R17): every state of the door and the lobby,
 * from static facts, with no database, no session and no second player. The
 * page twin of `/dev/room`. Each phase names the artboard it reproduces; an
 * `is-` phase renders at the unprefixed (Icelandic) path.
 */
export const PAGE_PHASES = [
  "door",
  "is-door",
  "door-returning",
  "lobby",
  "is-lobby",
  "lobby-new",
  "lobby-empty",
  "composer",
  "is-composer",
  // The line slot's states (US3–US5, US7): a challenge sent, a call, your match, a search, a switch.
  "challenge-sent",
  "is-challenge-in",
  "match-running",
  "match-over-away",
  "searching",
  "switch-confirm",
  // Spec 072 US1: invite a friend ▸ and the link in the slot.
  "lobby-link-out",
  "is-lobby-link-out",
  "lobby-link-refused",
  // Spec 072 US2: the invite door (DoorInvite).
  "invite-door",
  "is-invite-door",
  "invite-door-expired",
  "invite-door-returning",
  // Spec 072 US3: a link opened while signed in, and the sender's own.
  "lobby-link-call",
  "is-lobby-link-call",
  "lobby-own-link",
  // Spec 072 US5: your profile (ProfileOwn), a new player's, and with a call up.
  "profile-own",
  "is-profile-own",
  "profile-own-new",
  "profile-own-call",
  // Spec 072 US6, US7: another player's profile (ProfilePublic, EN-L).
  "profile-public",
  "is-profile-public",
  "profile-public-sent",
  "profile-public-in-match",
  "profile-public-away",
  "profile-public-signed-out",
] as const;

export type PagePhase = (typeof PAGE_PHASES)[number];

export function isPagePhase(value: string | undefined): value is PagePhase {
  return (PAGE_PHASES as readonly string[]).includes(value ?? "");
}

/** Game flow §5.0 EN-L: the English lobby, four here at the door (DoorEn). */
export const DOOR_EN: Overview = {
  counts: { here: 4, searching: 1, playersInMatch: 2, matchesOn: 2, other: { language: "is", here: 12 } },
  here: [
    { displayName: "Embla", rating: 1342, state: "here" },
    { displayName: "Kári", rating: 1265, state: "here" },
    { displayName: "Sóley", rating: 1418, state: "here" },
    { displayName: "Ragnar", rating: 1196, state: "searching" },
  ],
  more: 0,
};

/** Game flow §5.0 IS-T1: the Icelandic lobby, four here at the door (DoorIs). */
export const DOOR_IS: Overview = {
  counts: { here: 4, searching: 1, playersInMatch: 2, matchesOn: 2, other: { language: "en", here: 7 } },
  here: [
    { displayName: "Embla", rating: 1242, state: "here" },
    { displayName: "Kári", rating: 1179, state: "here" },
    { displayName: "Sóley", rating: 1318, state: "here" },
    { displayName: "Ragnar", rating: 1096, state: "searching" },
  ],
  more: 0,
};

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const lobbyRow = (n: number, displayName: string, rating: number, state: LobbyRow["state"], record: [number, number] | null): LobbyRow => ({
  playerId: id(n),
  displayName,
  handle: displayName.toLowerCase(),
  rating,
  state,
  movesPlayed: state === "in_match" ? 6 : null,
  record: record ? { wins: record[0], losses: record[1], draws: 0 } : null,
});
const DAY_MS = 86_400_000;
const yesterday = () => new Date(Date.now() - DAY_MS).toISOString();

/** The last match drawn as bands: Birna's words across, Kári's down (§5.0 IS-M, EN-M, shortened). */
const BANDS: Band[] = [
  { tiles: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }], seat: "you" },
  { tiles: [{ x: 6, y: 0 }, { x: 6, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 3 }], seat: "opp" },
  { tiles: [{ x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }], seat: "you" },
  { tiles: [{ x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }], seat: "you" },
  { tiles: [{ x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 }], seat: "opp" },
  { tiles: [{ x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }], seat: "opp" },
  { tiles: [{ x: 9, y: 7 }, { x: 9, y: 8 }, { x: 9, y: 9 }], seat: "you" },
];

export interface LobbyFixture {
  viewer: LobbyViewer;
  rows: LobbyRow[];
  overview: Overview;
  recent: RecentGameRow[];
}

const recent = (n: number, opponent: string, you: number, them: number): RecentGameRow => ({
  matchId: id(100 + n),
  result: you > them ? "win" : you < them ? "loss" : "draw",
  opponentId: id(200 + n),
  opponentUsername: opponent.toLowerCase(),
  opponentDisplayName: opponent,
  yourScore: you,
  opponentScore: them,
  wordsFound: 9,
  completedAt: yesterday(),
});

/** §5.0 IS-T1: the Icelandic lobby the next day (artboard Lobby). */
export function lobbyIs(): LobbyFixture {
  return {
    viewer: { displayName: "Birna", handle: "birna", rating: 1212, gamesPlayed: 35, wins: 20, losses: 15, draws: 0 },
    rows: [
      lobbyRow(1, "Embla", 1242, "here", [1, 0]),
      lobbyRow(2, "Kári", 1179, "here", [3, 1]),
      lobbyRow(3, "Hekla", 1150, "here", null),
      lobbyRow(4, "Sóley", 1318, "here", [0, 2]),
      lobbyRow(5, "Ragnar", 1096, "searching", [1, 0]),
      lobbyRow(6, "Jónas", 1163, "in_match", [1, 1]),
    ],
    overview: {
      counts: { here: 5, searching: 2, playersInMatch: 1, matchesOn: 1, other: { language: "en", here: 7 } },
      lastMatch: { matchId: id(101), opponent: "Kári", you: 134, them: 88, durationMs: 292_000, completedAt: yesterday(), youWon: true, bands: BANDS },
      form: ["W", "W", "L", "W", "L", "W", "W", "L", "W", "W"],
    },
    recent: [recent(1, "Kári", 134, 88), recent(2, "Embla", 184, 150), recent(3, "Jónas", 132, 171), recent(4, "Kári", 166, 159)],
  };
}

/** §5.0 EN-L: the English lobby (artboards LobbyComposer, LobbySent, LobbySearching). */
export function lobbyEn(): LobbyFixture {
  return {
    viewer: { displayName: "Birna", handle: "birna", rating: 1310, gamesPlayed: 22, wins: 13, losses: 9, draws: 0 },
    rows: [
      lobbyRow(1, "Embla", 1342, "here", [1, 0]),
      lobbyRow(2, "Kári", 1265, "here", [2, 1]),
      lobbyRow(3, "Hekla", 1250, "here", null),
      lobbyRow(4, "Sóley", 1418, "here", [0, 2]),
      lobbyRow(5, "Ragnar", 1196, "searching", [1, 0]),
      lobbyRow(6, "Jónas", 1263, "in_match", [1, 1]),
    ],
    overview: {
      counts: { here: 5, searching: 2, playersInMatch: 1, matchesOn: 1, other: { language: "is", here: 12 } },
      lastMatch: { matchId: id(101), opponent: "Kári", you: 128, them: 117, durationMs: 298_000, completedAt: yesterday(), youWon: true, bands: BANDS },
      form: ["W", "L", "W", "W", "L", "W", "L", "W", "W", "L"],
    },
    recent: [recent(1, "Kári", 128, 117), recent(2, "Embla", 150, 171), recent(3, "Hekla", 139, 120), recent(4, "Sóley", 118, 133)],
  };
}

/** A player with no matches yet (B1 new player). */
export function lobbyNew(): LobbyFixture {
  const base = lobbyEn();
  return { ...base, viewer: { ...base.viewer, rating: 1200, gamesPlayed: 0, wins: 0, losses: 0 }, overview: { ...base.overview, lastMatch: null, form: [] }, recent: [] };
}

/** Nobody else here (artboard LobbyEmpty). */
export function lobbyEmpty(): LobbyFixture {
  const base = lobbyEn();
  return { ...base, rows: [], overview: { ...base.overview, counts: { ...base.overview.counts, here: 0, searching: 0, playersInMatch: 0 } } };
}

/**
 * The viewer's standing for a slot phase: the slot's state, the facts the rows
 * read, and a held outcome. Times are fixed relative to `now`, so nothing ticks.
 */
export interface StandingFixture {
  now: number;
  slot: SlotState;
  facts: StandingFacts;
  held: HeldOutcome | null;
  /** Spec 072: the link text this browser kept, and a refused clipboard. */
  linkText?: { linkId: string; url: string } | null;
  clipboardRefused?: boolean;
}

function facts(language: "is" | "en", extra: Partial<StandingFacts> = {}): StandingFacts {
  return {
    now: new Date(FIXED_NOW).toISOString(),
    topic: "player:fixture",
    lobbyLanguage: language,
    incoming: [],
    outgoing: null,
    cooldowns: [],
    search: null,
    tableCooldownUntil: null,
    match: null,
    switchPending: null,
    notice: null,
    counts: { here: 5, searching: 2, playing: 1, otherHere: language === "is" ? 7 : 12 },
    viewer: { rating: language === "is" ? 1212 : 1310, gamesPlayed: language === "is" ? 35 : 22 },
    ...extra,
  };
}

/** A fixed instant: fixtures never depend on the clock. */
export const FIXED_NOW = Date.parse("2026-09-24T12:00:00.000Z");
const at = (ms: number) => new Date(FIXED_NOW + ms).toISOString();

/** LobbySent (EN-L): Kári challenged at 0:52 left; Hekla declined and cools down, 0:41. */
export function outgoingChallenge(): StandingFixture {
  const rows = lobbyEn().rows;
  const kari = rows[1];
  const hekla = rows[2];
  const outgoing = { inviteId: id(900), to: kari, status: "pending" as const, createdAt: at(-8_000), expiresAt: at(52_000), respondedAt: null, matchId: null };
  return {
    now: FIXED_NOW,
    slot: { kind: "sent", outgoing, held: null },
    facts: facts("en", { outgoing, cooldowns: [{ playerId: hekla.playerId, until: at(41_000) }] }),
    held: { inviteId: id(901), playerId: hekla.playerId, name: hekla.displayName, outcome: "declined" },
  };
}

/** LobbyIncoming (IS-T1): Kári challenges you, 0:47 to answer. */
export function challengeIn(): StandingFixture {
  const kari = lobbyIs().rows[1];
  const call = { inviteId: id(902), from: kari, expiresAt: at(47_000) };
  return { now: FIXED_NOW, slot: { kind: "call", call, more: 0, searching: false }, facts: facts("is", { incoming: [call] }), held: null };
}

/** B8: your match with Kári runs while you are in the lobby (EN-L). */
export function matchRunning(): StandingFixture {
  const match = { kind: "running" as const, matchId: id(903), opponent: "Kári", movesPlayed: 3, moveLimit: 10, deadlineAt: at(192_000) };
  return { now: FIXED_NOW, slot: { kind: "match", match }, facts: facts("en", { match }), held: null };
}

/** The match ended while you were away: its result waits in the slot (EN-L). */
export function matchOverAway(): StandingFixture {
  const match = { kind: "over" as const, matchId: id(903), opponent: "Kári", winner: "you" as const, winnerName: "Birna", you: 128, them: 117, endedReason: "moves_complete" };
  return { now: FIXED_NOW, slot: { kind: "match", match }, facts: facts("en", { match }), held: null };
}

/** LobbySearching (EN-L): searching 0:07, two others searching. */
export function searching(): StandingFixture {
  return {
    now: FIXED_NOW,
    slot: { kind: "search", search: { kind: "searching", elapsedSeconds: 7 } },
    facts: facts("en", { search: { queuedAt: at(-7_000), paused: false } }),
    held: null,
  };
}

/** US7.4: the English lobby opened with a search out in the Icelandic one. */
export function switchConfirm(): StandingFixture {
  const switchPending = { to: "en" as const, from: "is" as const, pending: ["search" as const] };
  return { now: FIXED_NOW, slot: { kind: "switch", pending: switchPending }, facts: facts("is", { switchPending }), held: null };
}

/** B9 (spec 072): a link copied 2s ago, 9:58 left; `refused`: the clipboard said no. */
export function linkOut(language: "is" | "en", refused = false): StandingFixture {
  const link = { id: id(910), status: "pending" as const, expiresAt: at(598_000), respondedAt: null };
  const url = `https://wottle.app${language === "en" ? "/en" : ""}/c/Xq7Vt2pLm9KcR4sWn8BjYd3HfA6gZe1uQo5iNw0bTyE`;
  return {
    now: FIXED_NOW,
    slot: { kind: "link", link, held: null, own: null },
    facts: facts(language, { link }),
    held: null,
    linkText: { linkId: link.id, url },
    clipboardRefused: refused,
  };
}

/** DoorInvite (spec 072 A2): Kári's link, 9:12 left (EN-L; IS-T1 for the Icelandic door). */
export const INVITE_TOKEN = "Xq7Vt2pLm9KcR4sWn8BjYd3HfA6gZe1uQo5iNw0bTyE";
export function inviteView(language: "is" | "en", valid = true): LinkView {
  return {
    valid,
    senderId: id(920),
    senderName: "Kári",
    senderHandle: "kári",
    senderRating: language === "en" ? 1265 : 1187,
    language,
    expiresAt: at(552_000),
  };
}

/** T6: Hekla's link opened by a signed-in Birna (EN-L; IS-T1 names Kári). */
export function linkCallIn(language: "is" | "en"): StandingFixture {
  const call = { token: INVITE_TOKEN, view: { ...inviteView(language), senderName: language === "en" ? "Hekla" : "Kári", senderRating: language === "en" ? 1250 : 1179 } };
  return { now: FIXED_NOW, slot: { kind: "linkCall", call, more: 0 }, facts: facts(language), held: null };
}

/** T64: Birna opens her own link, 9:12 left; it is her pending link. */
export function ownLinkOpened(): StandingFixture {
  const own = { token: INVITE_TOKEN, view: { ...inviteView("en"), senderName: "Birna", senderHandle: "birna" } };
  const link = { id: id(910), status: "pending" as const, expiresAt: at(552_000), respondedAt: null };
  return { now: FIXED_NOW, slot: { kind: "link", link, held: null, own }, facts: facts("en", { link }), held: null };
}

const DAY = 86_400_000;
const ratingWalk = [1196, 1188, 1203, 1209, 1200, 1214, 1216, 1205, 1196, 1204, 1208, 1212];

/** ProfileOwn (IS-T1): Birna 1212, 35 matches since March, 20–15–0, the last ten, three best words. */
export function profileView(language: "is" | "en"): ProfileView {
  const is = language === "is";
  const lastTen: FormResult[] = ["W", "W", "L", "W", "L", "W", "W", "L", "W", "W"];
  const opponents = ["Kári", "Embla", "Jónas", "Kári", "Sóley", "Hekla", "Ragnar", "Katla"];
  const scores: Array<[number, number, "win" | "loss" | "draw"]> = [[134, 88, "win"], [184, 150, "win"], [132, 171, "loss"], [166, 159, "win"], [120, 120, "draw"], [158, 141, "win"], [149, 162, "loss"], [171, 133, "win"]];
  return {
    playerId: id(930),
    handle: "birna",
    displayName: "Birna",
    language,
    rating: is ? 1212 : 1310,
    peak: is ? 1216 : 1318,
    weekChange: is ? 16 : -4,
    matches: is ? 35 : 22,
    firstPlayedAt: "2026-03-04T10:00:00.000Z",
    record: is ? { won: 20, lost: 15, drawn: 0, winRate: 20 / 35 } : { won: 13, lost: 9, drawn: 0, winRate: 13 / 22 },
    lastTen,
    chart: ratingWalk.map((rating, i) => ({ at: new Date(FIXED_NOW - (30 - (i * 30) / 11) * DAY).toISOString(), rating: is ? rating : rating + 98 })),
    chartEmpty: false,
    bestWords: is
      ? [word("HESTAR", 32, [4, 3, 1, 2, 1, 1]), word("BORÐA", 29, [5, 5, 1, 2, 1]), word("SKÍRN", 24, [1, 2, 4, 1, 1])]
      : [word("FJORD", 31, [4, 8, 1, 1, 2]), word("QUILT", 29, [10, 1, 1, 1, 1]), word("BRISK", 26, [3, 1, 1, 1, 5])],
    otherLanguage: is ? { language: "en", rating: 1310, matches: 22 } : { language: "is", rating: 1212, matches: 35 },
    matchesList: opponents.map((name, i) => ({
      matchId: id(940 + i), result: scores[i][2], opponentId: id(950 + i), opponentUsername: name.toLowerCase(), opponentDisplayName: name,
      yourScore: scores[i][0], opponentScore: scores[i][1], wordsFound: 0, completedAt: new Date(FIXED_NOW - (i + 1) * DAY).toISOString(),
    })),
    presence: null,
  };
}

function word(text: string, points: number, values: number[]): ProfileView["bestWords"][number] {
  return { word: text, points, tiles: Array.from(text, (letter, i) => ({ letter, value: values[i] ?? 1 })) };
}

/** A player with no match in this language: 1200, a flat chart, ten empty cells. */
export function profileViewNew(): ProfileView {
  const base = profileView("en");
  return {
    ...base, rating: 1200, peak: 1200, weekChange: 0, matches: 0, firstPlayedAt: null, record: { won: 0, lost: 0, drawn: 0, winRate: null }, lastTen: [],
    chart: [{ at: new Date(FIXED_NOW - 30 * DAY).toISOString(), rating: 1200 }, { at: new Date(FIXED_NOW).toISOString(), rating: 1200 }], chartEmpty: true,
    bestWords: [], matchesList: [], otherLanguage: { language: "is", rating: 1200, matches: 0 },
  };
}

/** ProfilePublic (EN-L): Kári 1265, 41 matches since April, peak 1281, −4 this week; Birna's matches against him. */
export function publicProfileView(language: "is" | "en" = "en"): ProfileView {
  const base = profileView(language);
  return {
    ...base,
    playerId: id(960),
    handle: "kári",
    displayName: "Kári",
    rating: language === "en" ? 1265 : 1179,
    peak: language === "en" ? 1281 : 1204,
    weekChange: -4,
    matches: 41,
    firstPlayedAt: "2026-04-11T10:00:00.000Z",
    record: { won: 21, lost: 19, drawn: 1, winRate: 21 / 41 },
    lastTen: ["L", "W", "L", "W", "L", "W", "L", "W", "W", "L"],
    chart: base.chart.map((p, i) => ({ ...p, rating: p.rating - 45 + (i % 3) * 6 })),
    bestWords: language === "en"
      ? [word("FJORD", 31, [4, 8, 1, 1, 2]), word("QUILT", 29, [10, 1, 1, 1, 1]), word("BRISK", 26, [3, 1, 1, 1, 5])]
      : [word("HESTAR", 32, [4, 3, 1, 2, 1, 1]), word("SKÓR", 22, [1, 2, 3, 1]), word("TAK", 10, [2, 1, 2])],
    matchesList: [
      { matchId: id(970), result: "win", opponentId: id(960), opponentUsername: "kári", opponentDisplayName: "Kári", yourScore: 128, opponentScore: 117, wordsFound: 0, completedAt: new Date(FIXED_NOW - DAY).toISOString() },
      { matchId: id(971), result: "loss", opponentId: id(960), opponentUsername: "kári", opponentDisplayName: "Kári", yourScore: 140, opponentScore: 152, wordsFound: 0, completedAt: "2026-09-14T18:00:00.000Z" },
      { matchId: id(972), result: "win", opponentId: id(960), opponentUsername: "kári", opponentDisplayName: "Kári", yourScore: 171, opponentScore: 118, wordsFound: 0, completedAt: "2026-09-09T18:00:00.000Z" },
    ],
    presence: { state: "here", movesPlayed: null },
  };
}

/** Birna's challenge to Kári is out: the slot carries withdraw ▸, the profile's primary slot the countdown. */
export function sentToKari(): StandingFixture {
  const kari = { playerId: id(960), displayName: "Kári", handle: "kári", rating: 1265, state: "here" as const, movesPlayed: null, record: null };
  const outgoing = { inviteId: id(961), to: kari, status: "pending" as const, createdAt: new Date(FIXED_NOW - 19_000).toISOString(), expiresAt: new Date(FIXED_NOW + 41_000).toISOString(), respondedAt: null, matchId: null };
  return { ...outgoingChallenge(), slot: { kind: "sent", outgoing, held: null } };
}

/** The longest names a player may take (24 characters, wide letters), for the overflow test (SC-007). */
const LONG_VIEWER = "Aðalsteinn-Guðmundsson_1";
const LONG_OTHERS = ["Kári", "Hekla", "Embla", "Sóley", "Ragnar", "Jónas"];

/** Every name in a fixture replaced by a 24-character one; the viewer's is distinct from the rest. */
export function withLongNames<T>(fixture: T): T {
  let json = JSON.stringify(fixture).replaceAll('"Birna"', `"${LONG_VIEWER}"`);
  LONG_OTHERS.forEach((name, i) => {
    json = json.replaceAll(`"${name}"`, `"Þórhildur-Sigurðardótti${i}"`);
  });
  return JSON.parse(json) as T;
}
