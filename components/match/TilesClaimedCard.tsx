import type { FrozenTileMap, FrozenTileOwner } from "@/lib/types/match";

interface TilesClaimedCardProps {
  frozenTiles: FrozenTileMap;
  currentPlayerSlot: FrozenTileOwner;
  boardSize?: number;
}

function countByOwner(tiles: FrozenTileMap): Record<FrozenTileOwner, number> {
  let a = 0;
  let b = 0;
  for (const key in tiles) {
    if (tiles[key].owner === "player_a") a += 1;
    else b += 1;
  }
  return { player_a: a, player_b: b };
}

export function TilesClaimedCard({
  frozenTiles,
  currentPlayerSlot,
  boardSize = 100,
}: TilesClaimedCardProps) {
  const counts = countByOwner(frozenTiles);
  const youCount = counts[currentPlayerSlot];
  const oppSlot: FrozenTileOwner =
    currentPlayerSlot === "player_a" ? "player_b" : "player_a";
  const oppCount = counts[oppSlot];
  const remaining = Math.max(0, boardSize - youCount - oppCount);

  const youClass =
    currentPlayerSlot === "player_a" ? "bg-p1" : "bg-p2";
  const oppClass = currentPlayerSlot === "player_a" ? "bg-p2" : "bg-p1";

  return (
    <div
      data-testid="tiles-claimed-card"
      className="rounded-xl border border-hair bg-paper p-4 shadow-wottle-sm"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        Tiles claimed
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div data-testid="tiles-claimed-you">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            You
          </div>
          <div
            className={`font-display text-[32px] italic leading-none ${
              currentPlayerSlot === "player_a" ? "text-p1-deep" : "text-p2-deep"
            }`}
          >
            {youCount}
          </div>
        </div>
        <div data-testid="tiles-claimed-opponent">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            Opponent
          </div>
          <div
            className={`font-display text-[32px] italic leading-none ${
              oppSlot === "player_a" ? "text-p1-deep" : "text-p2-deep"
            }`}
          >
            {oppCount}
          </div>
        </div>
      </div>
      <div
        data-testid="tiles-claimed-bar"
        className="mt-3 flex h-1.5 gap-1 overflow-hidden rounded"
      >
        <div
          data-testid="tiles-claimed-segment"
          data-count={youCount}
          className={youClass}
          style={{ flex: youCount }}
        />
        <div
          data-testid="tiles-claimed-segment"
          data-count={oppCount}
          className={oppClass}
          style={{ flex: oppCount }}
        />
        <div
          data-testid="tiles-claimed-segment"
          data-count={remaining}
          className="bg-paper-3"
          style={{ flex: remaining }}
        />
      </div>
    </div>
  );
}
