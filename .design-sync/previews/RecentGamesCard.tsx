import { RecentGamesCard } from "wottle";

const HOUR = 60 * 60 * 1000;
const ago = (hours: number) =>
  new Date(Date.now() - hours * HOUR).toISOString();

const games = [
  {
    matchId: "match-001",
    result: "win",
    opponentId: "player-kari",
    opponentUsername: "kari_ordasmidur",
    opponentDisplayName: "Kári",
    yourScore: 148,
    opponentScore: 121,
    wordsFound: 9,
    completedAt: ago(3),
  },
  {
    matchId: "match-002",
    result: "loss",
    opponentId: "player-thordis",
    opponentUsername: "thordis",
    opponentDisplayName: "Þórdís",
    yourScore: 96,
    opponentScore: 133,
    wordsFound: 6,
    completedAt: ago(26),
  },
  {
    matchId: "match-003",
    result: "draw",
    opponentId: "player-birna",
    opponentUsername: "birna",
    opponentDisplayName: "Birna",
    yourScore: 110,
    opponentScore: 110,
    wordsFound: 7,
    completedAt: ago(50),
  },
  {
    matchId: "match-004",
    result: "win",
    opponentId: "player-elin",
    opponentUsername: "elin",
    opponentDisplayName: "Elín",
    yourScore: 162,
    opponentScore: 87,
    wordsFound: 11,
    completedAt: ago(24 * 4),
  },
];

export function RecentResults() {
  return (
    <div style={{ maxWidth: 420 }}>
      <RecentGamesCard games={games} />
    </div>
  );
}

export function EmptyWeek() {
  return (
    <div style={{ maxWidth: 420 }}>
      <RecentGamesCard games={[]} />
    </div>
  );
}
