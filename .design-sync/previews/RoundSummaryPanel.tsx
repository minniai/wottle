import { RoundSummaryPanel } from "wottle";

const YOU = "player-a";
const OPPONENT = "player-b";

const coords = (pairs: Array<[number, number]>) => pairs.map(([x, y]) => ({ x, y }));

const summary = {
  matchId: "match-demo-1",
  roundNumber: 4,
  words: [
    {
      playerId: YOU,
      word: "BORÐA",
      length: 5,
      lettersPoints: 12,
      bonusPoints: 15,
      totalPoints: 27,
      coordinates: coords([
        [2, 3],
        [3, 3],
        [4, 3],
        [5, 3],
        [6, 3],
      ]),
    },
    {
      playerId: YOU,
      word: "SKÁL",
      length: 4,
      lettersPoints: 9,
      bonusPoints: 10,
      totalPoints: 19,
      coordinates: coords([
        [7, 1],
        [7, 2],
        [7, 3],
        [7, 4],
      ]),
    },
    {
      playerId: OPPONENT,
      word: "VINUR",
      length: 5,
      lettersPoints: 11,
      bonusPoints: 15,
      totalPoints: 26,
      coordinates: coords([
        [1, 6],
        [2, 6],
        [3, 6],
        [4, 6],
        [5, 6],
      ]),
    },
  ],
  deltas: { playerA: 46, playerB: 26 },
  totals: { playerA: 132, playerB: 118 },
  highlights: [],
  resolvedAt: "2026-08-24T12:00:00.000Z",
  moves: [],
};

const quietSummary = {
  ...summary,
  roundNumber: 5,
  words: [],
  deltas: { playerA: 0, playerB: 0 },
};

export function RoundRecap() {
  return (
    <RoundSummaryPanel
      summary={summary}
      currentPlayerId={YOU}
      playerAId={YOU}
      autoDismissMs={0}
    />
  );
}

export function NoWordsFound() {
  return (
    <RoundSummaryPanel
      summary={quietSummary}
      currentPlayerId={YOU}
      playerAId={YOU}
      autoDismissMs={0}
    />
  );
}
