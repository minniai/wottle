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
} from "../../lib/types/board";

interface BoardGridProps {
  grid: BoardGridType;
  className?: string;
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

async function submitSwapRequest(move: MoveRequest): Promise<MoveResult> {
  const response = await fetch("/api/swap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(move),
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

export function BoardGrid({
  grid,
  className,
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
        const result = await submitSwapRequest(moveRequest);

        setCurrentGrid(result.grid);
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
    [currentGrid, onSwapComplete, onSwapError]
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

              return (
                <button
                  key={`cell-${rowIndex}-${colIndex}`}
                  type="button"
                  role="gridcell"
                  aria-colindex={colIndex + 1}
                  aria-selected={isSelected}
                  className={`board-grid__cell${
                    isSelected ? " board-grid__cell--selected" : ""
                  }`}
                  data-testid="board-tile"
                  data-col={colIndex}
                  data-row={rowIndex}
                  data-selected={isSelected ? "true" : undefined}
                  disabled={isSubmitting}
                  onClick={() => handleTileClick(rowIndex, colIndex)}
                >
                  <span className="board-grid__tile" aria-hidden="true">
                    {letter}
                  </span>
                  <span className="sr-only">
                    Row {rowIndex + 1}, column {colIndex + 1}, letter {letter}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
