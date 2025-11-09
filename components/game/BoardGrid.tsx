"use client";

import { useEffect } from "react";

import type { BoardGrid as BoardGridType } from "../../lib/types/board";

interface BoardGridProps {
  grid: BoardGridType;
  className?: string;
}

const BASE_CLASS = "board-grid";

export function BoardGrid({ grid, className }: BoardGridProps) {
  useEffect(() => {
    if (typeof performance !== "undefined" && typeof performance.mark === "function") {
      performance.mark("board-grid:hydrated");
    }
  }, [grid]);

  const rowCount = grid.length;
  const colCount = grid[0]?.length ?? 0;

  const containerClass = className ? `${BASE_CLASS} ${className}` : BASE_CLASS;

  return (
    <div
      data-testid="board-grid"
      role="grid"
      aria-label="Board grid"
      aria-rowcount={rowCount}
      aria-colcount={colCount}
      className={containerClass}
    >
      {grid.map((row, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          role="row"
          aria-rowindex={rowIndex + 1}
          className="board-grid__row"
          data-row={rowIndex}
        >
          {row.map((letter, colIndex) => (
            <div
              key={`cell-${rowIndex}-${colIndex}`}
              role="gridcell"
              aria-colindex={colIndex + 1}
              className="board-grid__cell"
              data-testid="board-tile"
              data-col={colIndex}
            >
              <span className="board-grid__tile" aria-hidden="true">
                {letter}
              </span>
              <span className="sr-only">
                Row {rowIndex + 1}, column {colIndex + 1}, letter {letter}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}


