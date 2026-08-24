import { BoardGrid } from "wottle";

const row = (letters: string) => letters.split("");

/** 10x10 Icelandic board with embedded words: ÚLFUR, BORÐA, SKÁLD, VINUR, ÞOKA, TAFL, GRÖF. */
const BOARD = [
  row("TAKRÓSEMIN"),
  row("ÚLFUREKATS"),
  row("NBORÐAGILT"),
  row("GÝMÆTÖNFÁR"),
  row("ASKÁLDISTÓ"),
  row("HREVINUROF"),
  row("ÞOKANDEMUR"),
  row("EIKURTAFLI"),
  row("LÁNSEMDÓTA"),
  row("GRÖFINKÝRN"),
];

/** Frozen territory: BORÐA + SKÁLD claimed by player A (ochre), VINUR + ÞOKA by player B (blue). */
const FROZEN_TILES = {
  "1,2": { owner: "player_a", scoredAxes: ["horizontal"] },
  "2,2": { owner: "player_a", scoredAxes: ["horizontal"] },
  "3,2": { owner: "player_a", scoredAxes: ["horizontal"] },
  "4,2": { owner: "player_a", scoredAxes: ["horizontal"] },
  "5,2": { owner: "player_a", scoredAxes: ["horizontal"] },
  "1,4": { owner: "player_a", scoredAxes: ["horizontal"] },
  "2,4": { owner: "player_a", scoredAxes: ["horizontal"] },
  "3,4": { owner: "player_a", scoredAxes: ["horizontal"] },
  "4,4": { owner: "player_a", scoredAxes: ["horizontal"] },
  "5,4": { owner: "player_a", scoredAxes: ["horizontal"] },
  "3,5": { owner: "player_b", scoredAxes: ["horizontal"] },
  "4,5": { owner: "player_b", scoredAxes: ["horizontal"] },
  "5,5": { owner: "player_b", scoredAxes: ["horizontal"] },
  "6,5": { owner: "player_b", scoredAxes: ["horizontal"] },
  "7,5": { owner: "player_b", scoredAxes: ["horizontal"] },
  "0,6": { owner: "player_b", scoredAxes: ["horizontal"] },
  "1,6": { owner: "player_b", scoredAxes: ["horizontal"] },
  "2,6": { owner: "player_b", scoredAxes: ["horizontal"] },
  "3,6": { owner: "player_b", scoredAxes: ["horizontal"] },
};

const OCHRE = "oklch(0.68 0.14 60 / 0.6)";
const BLUE = "oklch(0.56 0.08 220 / 0.6)";

/** Words scored THIS round: TAFL (row 7, you/ochre) and KÝR (row 9, opponent/blue). */
const CURRENT_ROUND_SCORED = {
  "5,7": OCHRE,
  "6,7": OCHRE,
  "7,7": OCHRE,
  "8,7": OCHRE,
  "6,9": BLUE,
  "7,9": BLUE,
  "8,9": BLUE,
};

export function CanonicalBoard() {
  return <BoardGrid grid={BOARD} matchId="preview-match" />;
}

export function FrozenTerritory() {
  return (
    <BoardGrid
      grid={BOARD}
      matchId="preview-match"
      frozenTiles={FROZEN_TILES}
      playerSlot="player_a"
    />
  );
}

export function ScoredThisRound() {
  return (
    <BoardGrid
      grid={BOARD}
      matchId="preview-match"
      frozenTiles={FROZEN_TILES}
      playerSlot="player_a"
      currentRoundScoredTiles={CURRENT_ROUND_SCORED}
    />
  );
}

export function MoveLockedWaiting() {
  return (
    <BoardGrid
      grid={BOARD}
      matchId="preview-match"
      frozenTiles={FROZEN_TILES}
      playerSlot="player_a"
      disabled
      showLockBanner
      lockedTiles={[
        { x: 5, y: 7 },
        { x: 5, y: 8 },
      ]}
    />
  );
}
