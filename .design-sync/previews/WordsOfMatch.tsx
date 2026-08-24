import { WordsOfMatch } from "wottle";

const BIRNA = "player-birna";
const KARI = "player-kari";

const coords = (pairs: Array<[number, number]>) =>
  pairs.map(([x, y]) => ({ x, y }));

const wordRow = (
  roundNumber: number,
  playerId: string,
  word: string,
  lettersPoints: number,
  bonusPoints: number,
  startX: number,
  startY: number,
) => ({
  roundNumber,
  playerId,
  word,
  lettersPoints,
  bonusPoints,
  totalPoints: lettersPoints + bonusPoints,
  coordinates: coords(
    Array.from({ length: word.length }, (_, i) => [startX + i, startY]),
  ),
});

const history = [
  wordRow(1, BIRNA, "SKÁL", 9, 10, 1, 2),
  wordRow(2, KARI, "VINUR", 11, 15, 3, 5),
  wordRow(3, BIRNA, "BORÐA", 12, 15, 0, 7),
  wordRow(4, KARI, "HESTUR", 13, 20, 2, 1),
  wordRow(6, BIRNA, "SKÁLDSKAPUR", 26, 45, 0, 4),
  wordRow(7, KARI, "LJÓÐ", 12, 10, 5, 8),
  wordRow(9, BIRNA, "VETUR", 10, 15, 4, 0),
  wordRow(10, KARI, "ÞOKA", 11, 10, 6, 6),
];

export function FullMatchWordList() {
  return (
    <div style={{ maxWidth: 400, height: 380 }}>
      <WordsOfMatch wordHistory={history} playerASlotId={BIRNA} />
    </div>
  );
}

export function NoWordsScored() {
  return (
    <div style={{ maxWidth: 400 }}>
      <WordsOfMatch wordHistory={[]} playerASlotId={BIRNA} />
    </div>
  );
}
