import type { Coordinate } from "@/lib/types/board";
import type {
  FrozenTileMap,
  FrozenTileOwner,
  ScoredAxis,
  WordScoreBreakdown,
} from "@/lib/types/match";
import { BOARD_TILE_COUNT } from "@/lib/constants/board";

/** Minimum number of unfrozen tiles that must remain on the board. */
const MIN_UNFROZEN_TILES = 24;

/** Maximum number of tiles that can be frozen. */
const MAX_FROZEN_TILES = BOARD_TILE_COUNT - MIN_UNFROZEN_TILES;

/** Result of a freeze operation. */
export interface FreezeResult {
  updatedFrozenTiles: FrozenTileMap;
  newlyFrozen: Coordinate[];
  wasPartialFreeze: boolean;
  unfrozenRemaining: number;
}

/**
 * Build a coordinate key for frozen tile map lookups.
 * Format: "x,y"
 */
export function toFrozenKey(coordinate: Coordinate): string {
  return `${coordinate.x},${coordinate.y}`;
}

/**
 * Check if a coordinate is frozen (any owner).
 */
export function isFrozen(
  frozenTiles: FrozenTileMap,
  coordinate: Coordinate,
): boolean {
  return toFrozenKey(coordinate) in frozenTiles;
}

/**
 * Check if a coordinate is frozen by the opponent of the given player slot.
 * Returns false for tiles owned by the player themselves.
 */
export function isFrozenByOpponent(
  frozenTiles: FrozenTileMap,
  coordinate: Coordinate,
  playerSlot: "player_a" | "player_b",
): boolean {
  const key = toFrozenKey(coordinate);
  const tile = frozenTiles[key];
  if (!tile) {
    return false;
  }
  const opponentSlot =
    playerSlot === "player_a" ? "player_b" : "player_a";
  return tile.owner === opponentSlot;
}

/**
 * Determine the ownership for a tile being frozen.
 */
function resolveOwnership(
  existingOwner: FrozenTileOwner | undefined,
  newPlayerSlot: "player_a" | "player_b",
): FrozenTileOwner {
  if (!existingOwner) {
    return newPlayerSlot;
  }
  // First-owner-wins: existing owner keeps ownership (FR-008, FR-009)
  return existingOwner;
}

/**
 * Map a player ID to a player slot.
 */
function toPlayerSlot(
  playerId: string,
  playerAId: string,
): "player_a" | "player_b" {
  return playerId === playerAId ? "player_a" : "player_b";
}

/**
 * Infer the axis of a word from its tile coordinates.
 * Same y → horizontal, same x → vertical.
 */
function inferAxis(tiles: Coordinate[]): ScoredAxis {
  if (tiles.length < 2) return "horizontal";
  return tiles[0].y === tiles[1].y ? "horizontal" : "vertical";
}

/**
 * Merge a new axis into an existing axes array, avoiding duplicates.
 */
function mergeAxes(
  existing: ScoredAxis[] | undefined,
  axis: ScoredAxis,
): ScoredAxis[] {
  if (!existing) return [axis];
  if (existing.includes(axis)) return existing;
  return [...existing, axis];
}

/**
 * Sort coordinates in reading order (row first, then column).
 */
function sortReadingOrder(coords: Coordinate[]): Coordinate[] {
  return [...coords].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
}

/**
 * Freeze tiles from scored words, respecting the 24-unfrozen minimum.
 *
 * - Collects all tile coordinates from scored words
 * - Deduplicates and sorts in reading order (row first, then column)
 * - Enforces MAX_FROZEN_TILES (76) limit by truncating in reading order
 * - First-owner-wins: existing frozen tiles keep their owner
 */
export function freezeTiles(params: {
  scoredWords: WordScoreBreakdown[];
  existingFrozenTiles: FrozenTileMap;
  playerAId: string;
  playerBId: string;
  boardSize?: number;
}): FreezeResult {
  const {
    scoredWords,
    existingFrozenTiles,
    playerAId,
  } = params;

  const updatedFrozenTiles: FrozenTileMap = { ...existingFrozenTiles };
  const currentFrozenCount = Object.keys(existingFrozenTiles).length;
  const freezeCapacity = MAX_FROZEN_TILES - currentFrozenCount;

  // Build axis map: for each tile coordinate, which axes it was scored on
  const axisMap = new Map<string, ScoredAxis[]>();
  for (const word of scoredWords) {
    const axis = inferAxis(word.tiles);
    for (const tile of word.tiles) {
      const key = toFrozenKey(tile);
      axisMap.set(key, mergeAxes(axisMap.get(key), axis));
    }
  }

  // Collect all tiles from scored words with their owner
  const candidateTiles: Array<{
    coord: Coordinate;
    playerSlot: "player_a" | "player_b";
  }> = [];

  for (const word of scoredWords) {
    const slot = toPlayerSlot(word.playerId, playerAId);
    for (const tile of word.tiles) {
      candidateTiles.push({ coord: tile, playerSlot: slot });
    }
  }

  // Deduplicate by coordinate, collecting all claiming players
  const tileClaimants = new Map<
    string,
    { coord: Coordinate; slots: Set<"player_a" | "player_b"> }
  >();

  for (const { coord, playerSlot } of candidateTiles) {
    const key = toFrozenKey(coord);
    const existing = tileClaimants.get(key);
    if (existing) {
      existing.slots.add(playerSlot);
    } else {
      tileClaimants.set(key, {
        coord,
        slots: new Set([playerSlot]),
      });
    }
  }

  // Filter out tiles that are already frozen (they just get ownership upgrades)
  const newTileEntries: Array<{
    key: string;
    coord: Coordinate;
    slots: Set<"player_a" | "player_b">;
  }> = [];

  const upgradeEntries: Array<{
    key: string;
    slots: Set<"player_a" | "player_b">;
  }> = [];

  for (const [key, entry] of tileClaimants) {
    if (key in existingFrozenTiles) {
      upgradeEntries.push({ key, slots: entry.slots });
    } else {
      newTileEntries.push({ key, coord: entry.coord, slots: entry.slots });
    }
  }

  // Apply ownership upgrades to already-frozen tiles (no capacity cost)
  for (const { key, slots } of upgradeEntries) {
    const existing = updatedFrozenTiles[key];
    let currentAxes = existing?.scoredAxes;
    const newAxes = axisMap.get(key);
    if (newAxes) {
      for (const axis of newAxes) {
        currentAxes = mergeAxes(currentAxes, axis);
      }
    }
    for (const slot of slots) {
      updatedFrozenTiles[key] = {
        owner: resolveOwnership(
          updatedFrozenTiles[key]?.owner,
          slot,
        ),
        scoredAxes: currentAxes,
      };
    }
  }

  // Sort new tiles in reading order for deterministic partial freeze
  const sortedNew = newTileEntries.sort((a, b) => {
    if (a.coord.y !== b.coord.y) return a.coord.y - b.coord.y;
    return a.coord.x - b.coord.x;
  });

  // Apply new tiles up to freeze capacity
  const tilesToFreeze = sortedNew.slice(0, Math.max(0, freezeCapacity));
  const wasPartialFreeze = sortedNew.length > freezeCapacity;
  const newlyFrozen: Coordinate[] = [];

  for (const { key, coord, slots } of tilesToFreeze) {
    // First-owner-wins: take the first claiming slot
    const owner: FrozenTileOwner = [...slots][0];
    updatedFrozenTiles[key] = {
      owner,
      scoredAxes: axisMap.get(key),
    };
    newlyFrozen.push(coord);
  }

  const totalFrozen = Object.keys(updatedFrozenTiles).length;
  const unfrozenRemaining = BOARD_TILE_COUNT - totalFrozen;

  return {
    updatedFrozenTiles,
    newlyFrozen,
    wasPartialFreeze,
    unfrozenRemaining,
  };
}
