import { PostGameVerdict } from "wottle";

export function Victory() {
  return (
    <PostGameVerdict
      outcome="win"
      totalRounds={10}
      durationMs={487000}
      pointMargin={23}
      opponentName="Kári"
      reasonLabel="All 10 rounds played to completion."
    />
  );
}

export function Defeat() {
  return (
    <PostGameVerdict
      outcome="loss"
      totalRounds={10}
      durationMs={512000}
      pointMargin={14}
      opponentName="Birna"
      reasonLabel="All 10 rounds played to completion."
    />
  );
}

export function DrawSpectator() {
  return (
    <PostGameVerdict
      outcome="draw"
      totalRounds={10}
      durationMs={601000}
      pointMargin={0}
      opponentName="Elín"
      subjectName="Birna"
      reasonLabel="Frozen-tile tiebreaker also level."
    />
  );
}
