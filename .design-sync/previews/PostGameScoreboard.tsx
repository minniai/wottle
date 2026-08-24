import { PostGameScoreboard } from "wottle";

const birnaWins = [
  {
    id: "player-birna",
    displayName: "Birna",
    slot: "player_a",
    score: 168,
    wordsCount: 12,
    frozenTileCount: 41,
    bestWord: "SKÁLDSKAPUR",
    ratingDelta: 14,
    isCurrentPlayer: true,
    isWinner: true,
  },
  {
    id: "player-kari",
    displayName: "Kári",
    slot: "player_b",
    score: 145,
    wordsCount: 10,
    frozenTileCount: 34,
    bestWord: "VINUR",
    ratingDelta: -14,
    isCurrentPlayer: false,
    isWinner: false,
  },
];

const kariWins = [
  {
    id: "player-elin",
    displayName: "Elín",
    slot: "player_a",
    score: 121,
    wordsCount: 8,
    frozenTileCount: 26,
    bestWord: null,
    ratingDelta: undefined,
    isCurrentPlayer: true,
    isWinner: false,
  },
  {
    id: "player-kari",
    displayName: "Kári",
    slot: "player_b",
    score: 139,
    wordsCount: 11,
    frozenTileCount: 37,
    bestWord: "BORÐA",
    ratingDelta: 11,
    isCurrentPlayer: false,
    isWinner: true,
  },
];

export function WinnerFirst() {
  return (
    <div style={{ maxWidth: 640 }}>
      <PostGameScoreboard entries={birnaWins} />
    </div>
  );
}

export function OpponentWinsRatingPending() {
  return (
    <div style={{ maxWidth: 640 }}>
      <PostGameScoreboard entries={kariWins} />
    </div>
  );
}
