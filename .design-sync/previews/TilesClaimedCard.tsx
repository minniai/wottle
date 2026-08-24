import { TilesClaimedCard } from "wottle";

const tiles = (aCount: number, bCount: number) => {
  const map: Record<string, { owner: string }> = {};
  for (let i = 0; i < aCount; i += 1) {
    map[`${i % 10},${Math.floor(i / 10)}`] = { owner: "player_a" };
  }
  for (let i = 0; i < bCount; i += 1) {
    map[`${i % 10},${9 - Math.floor(i / 10)}`] = { owner: "player_b" };
  }
  return map;
};

export function EarlyGame() {
  return (
    <div style={{ maxWidth: 320 }}>
      <TilesClaimedCard frozenTiles={tiles(4, 3)} currentPlayerSlot="player_a" />
    </div>
  );
}

export function CloseMidGame() {
  return (
    <div style={{ maxWidth: 320 }}>
      <TilesClaimedCard frozenTiles={tiles(18, 15)} currentPlayerSlot="player_a" />
    </div>
  );
}

export function OpponentLeading() {
  return (
    <div style={{ maxWidth: 320 }}>
      <TilesClaimedCard frozenTiles={tiles(31, 12)} currentPlayerSlot="player_b" />
    </div>
  );
}
