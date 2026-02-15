"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import type {
  BoardGrid as BoardGridType,
  MoveRequest,
  MoveResult,
} from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";

interface BoardGridProps {
  grid: BoardGridType;
  matchId: string;
  className?: string;
  /** Frozen tile map for visual overlays. Keys are "x,y" strings. */
  frozenTiles?: FrozenTileMap;
  /** Current player's slot for determining own vs opponent frozen tiles. */
  playerSlot?: "player_a" | "player_b";
  onSwapComplete?: (details: { move: MoveRequest; result: MoveResult }) => void;
  onSwapError?: (details: {
    move: MoveRequest;
    message: string;
    grid: BoardGridType;
  }) => void;
}

type SelectedTile = {
  x: number;
  y: number;
};

const BASE_CLASS = "board-grid";

async function submitSwapRequest(matchId: string, move: MoveRequest): Promise<MoveResult> {
  const response = await fetch(`/api/match/${matchId}/move`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fromX: move.from.x,
      fromY: move.from.y,
      toX: move.to.x,
      toY: move.to.y,
    }),
  });

  if (response.status === 200) {
    return (await response.json()) as MoveResult;
  }

  if (response.status === 400) {
    return (await response.json()) as MoveResult;
  }

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  throw new Error(
    payload.error ?? "Failed to process swap request. Please try again."
  );
}

/** Player color constants for frozen tile overlays. */
const FROZEN_COLORS = {
  player_a: "rgba(59, 130, 246, 0.4)", // blue at 40% opacity
  player_b: "rgba(239, 68, 68, 0.4)",  // red at 40% opacity
  both: "linear-gradient(135deg, rgba(59, 130, 246, 0.4) 50%, rgba(239, 68, 68, 0.4) 50%)",
};

export function BoardGrid({
  grid,
  matchId,
  className,
  frozenTiles = {},
  playerSlot,
  onSwapComplete,
  onSwapError,
}: BoardGridProps) {
  const [currentGrid, setCurrentGrid] = useState<BoardGridType>(grid);
  const [selected, setSelected] = useState<SelectedTile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (
      typeof performance !== "undefined" &&
      typeof performance.mark === "function"
    ) {
      performance.mark("board-grid:hydrated");
    }
  }, [grid]);

  useEffect(() => {
    setCurrentGrid(grid);
  }, [grid]);

  const rowCount = currentGrid.length;
  const colCount = currentGrid[0]?.length ?? 0;

  const containerClass = useMemo(
    () => (className ? `${BASE_CLASS} ${className}` : BASE_CLASS),
    [className]
  );

  const handleSwap = useCallback(
    async (from: SelectedTile, to: SelectedTile) => {
      setIsSubmitting(true);
      const previousGrid = currentGrid.map((row) => [...row]) as BoardGridType;
      const moveRequest: MoveRequest = {
        from,
        to,
      };

      try {
        const result = await submitSwapRequest(matchId, moveRequest);

        // Optimistic update or wait for server?
        // For now, we rely on the result or parent update.
        // If result has grid, use it.
        if (result.grid) {
          setCurrentGrid(result.grid);
        }

        onSwapComplete?.({ move: moveRequest, result });
      } catch (error) {
        setCurrentGrid(previousGrid);
        const message =
          error instanceof Error
            ? error.message
            : "Network error while submitting swap. Please try again.";

        const normalizedMessage =
          /network/i.test(message) || /failed to fetch/i.test(message)
            ? "Network error while submitting swap. Please try again."
            : message;

        onSwapError?.({
          move: moveRequest,
          message: normalizedMessage,
          grid: previousGrid,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentGrid, matchId, onSwapComplete, onSwapError]
  );

  const handleTileClick = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (isSubmitting) {
        return;
      }

      const coordinate = { x: colIndex, y: rowIndex } as SelectedTile;

      if (!selected) {
        setSelected(coordinate);
        return;
      }

      // If clicking the same tile, deselect
      if (selected.x === coordinate.x && selected.y === coordinate.y) {
        setSelected(null);
        return;
      }

      setSelected(null);
      void handleSwap(selected, coordinate);
    },
    [handleSwap, isSubmitting, selected]
  );

  const boardSize = useMemo(
    () => Math.max(colCount, rowCount, 1),
    [colCount, rowCount]
  );

  return (
    <div className="board-grid__wrapper">
      <div
        data-testid="board-grid"
        role="grid"
        aria-label="Board grid"
        aria-rowcount={rowCount}
        aria-colcount={colCount}
        aria-busy={isSubmitting}
        className={containerClass}
        style={
          {
            "--board-size": boardSize,
          } as CSSProperties
        }
        data-submitting={isSubmitting ? "true" : undefined}
      >
        {currentGrid.map((row, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            role="row"
            aria-rowindex={rowIndex + 1}
            className="board-grid__row"
            data-row={rowIndex}
          >
            {row.map((letter, colIndex) => {
              const isSelected =
                selected?.x === colIndex && selected?.y === rowIndex;

              const tileKey = `${colIndex},${rowIndex}`;
              const frozenEntry = frozenTiles[tileKey];
              const isTileFrozen = !!frozenEntry;
              const frozenOwner = frozenEntry?.owner;

              const frozenStyle: CSSProperties | undefined = isTileFrozen
                ? frozenOwner === "both"
                  ? { background: FROZEN_COLORS.both }
                  : { backgroundColor: FROZEN_COLORS[frozenOwner ?? "player_a"] }
                : undefined;

              return (
                <button
                  key={`cell-${rowIndex}-${colIndex}`}
                  type="button"
                  role="gridcell"
                  aria-colindex={colIndex + 1}
                  aria-selected={isSelected}
                  aria-disabled={isTileFrozen || undefined}
                  className={`board-grid__cell${isSelected ? " board-grid__cell--selected" : ""}${isTileFrozen ? " board-grid__cell--frozen" : ""}`}
                  data-testid="board-tile"
                  data-tile-index={rowIndex * 10 + colIndex}
                  data-col={colIndex}
                  data-row={rowIndex}
                  data-selected={isSelected ? "true" : undefined}
                  data-frozen={isTileFrozen ? frozenOwner : undefined}
                  disabled={isSubmitting}
                  onClick={() => handleTileClick(rowIndex, colIndex)}
                  style={frozenStyle}
                >
                  <span className="board-grid__tile" aria-hidden="true">
                    {letter}
                  </span>
                  <span className="sr-only">
                    Row {rowIndex + 1}, column {colIndex + 1}, letter {letter}
                    {isTileFrozen ? `, frozen by ${frozenOwner}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {/* Temporary submit button for testing flow if needed, but grid click handles it */}
      <button data-testid="submit-move-button" className="sr-only">Submit</button>
    </div>
  );
}
