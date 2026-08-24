import { RoundByRoundChart } from "wottle";

const row = (
  roundNumber: number,
  playerADelta: number,
  playerBDelta: number,
  playerAScore: number,
  playerBScore: number,
) => ({ roundNumber, playerADelta, playerBDelta, playerAScore, playerBScore });

const tenRounds = [
  row(1, 12, 0, 12, 0),
  row(2, 0, 19, 12, 19),
  row(3, 27, 9, 39, 28),
  row(4, 8, 26, 47, 54),
  row(5, 0, 0, 47, 54),
  row(6, 33, 14, 80, 68),
  row(7, 11, 22, 91, 90),
  row(8, 19, 0, 110, 90),
  row(9, 24, 31, 134, 121),
  row(10, 34, 24, 168, 145),
];

export function FullTenRoundMatch() {
  return (
    <div style={{ maxWidth: 560 }}>
      <RoundByRoundChart rounds={tenRounds} />
    </div>
  );
}

export function PlayerBPerspective() {
  return (
    <div style={{ maxWidth: 560 }}>
      <RoundByRoundChart rounds={tenRounds} currentIsPlayerA={false} />
    </div>
  );
}
