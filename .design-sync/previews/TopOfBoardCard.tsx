import { TopOfBoardCard } from "wottle";

const players = [
  {
    id: "player-kari",
    username: "kari_ordasmidur",
    displayName: "Kári",
    eloRating: 1391,
    avatarUrl: null,
    wins: 18,
    losses: 6,
  },
  {
    id: "player-birna",
    username: "birna",
    displayName: "Birna",
    eloRating: 1284,
    avatarUrl: null,
    wins: 14,
    losses: 8,
  },
  {
    id: "player-elin",
    username: "elin",
    displayName: "Elín",
    eloRating: 1212,
    avatarUrl: null,
    wins: 11,
    losses: 9,
  },
  {
    id: "player-thordis",
    username: "thordis",
    displayName: "Þórdís",
    eloRating: 1147,
    avatarUrl: null,
    wins: 9,
    losses: 12,
  },
  {
    id: "player-gudmundur",
    username: "gudmundur",
    displayName: "Guðmundur",
    eloRating: 1102,
    avatarUrl: null,
    wins: 7,
    losses: 13,
  },
];

export function Leaderboard() {
  return (
    <div style={{ maxWidth: 360 }}>
      <TopOfBoardCard players={players} seasonLabel="Season 1" />
    </div>
  );
}

export function EmptyBoard() {
  return (
    <div style={{ maxWidth: 360 }}>
      <TopOfBoardCard players={[]} seasonLabel="Season 1" />
    </div>
  );
}
