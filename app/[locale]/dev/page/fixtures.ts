import type { LobbyViewer } from "@/components/page/lobby/YourBlock";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { Band, LobbyRow, Overview } from "@/lib/types/standing";

/**
 * Page fixtures (spec 070 T017, R17): every state of the door and the lobby,
 * from static facts, with no database, no session and no second player. The
 * page twin of `/dev/room`. Each phase names the artboard it reproduces; an
 * `is-` phase renders at the unprefixed (Icelandic) path.
 */
export const PAGE_PHASES = ["door", "is-door", "door-returning", "lobby", "is-lobby", "lobby-new", "lobby-empty", "composer", "is-composer"] as const;

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
