"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type {
  BoardGrid as BoardGridType,
  Coordinate,
  MoveRequest,
  MoveResult,
} from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";
import {
  PLAYER_A_OVERLAY,
  PLAYER_B_OVERLAY,
  BOTH_GRADIENT,
} from "@/lib/constants/playerColors";

interface BoardGridProps {
  grid?: BoardGridType;
  matchId: string;
  className?: string;
  /** Frozen tile map for visual overlays. Keys are "x,y" strings. */
  frozenTiles?: FrozenTileMap;
  /** Current player's slot for determining own vs opponent frozen tiles. */
  playerSlot?: "player_a" | "player_b";
  /** Tile coordinates of scored words for highlight animation (FR-020). Shown for highlightDurationMs. */
  scoredTileHighlights?: Coordinate[][];
  /** Duration to show scored tile highlights in ms. Default 3000. */
  highlightDurationMs?: number;
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
    const body = (await response.json()) as { error?: string; status?: string };
    throw new Error(body.error ?? "Swap was rejected");
  }

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  throw new Error(
    payload.error ?? "Failed to process swap request. Please try again."
  );
}

/** Stable empty array for default prop to avoid useEffect re-run loops. */
const EMPTY_HIGHLIGHTS: Coordinate[][] = [];

/** Centralized frozen tile overlay colors from playerColors.ts */
const FROZEN_COLORS = {
  player_a: PLAYER_A_OVERLAY,
  player_b: PLAYER_B_OVERLAY,
  both: BOTH_GRADIENT,
};

function isTileInHighlights(
  colIndex: number,
  rowIndex: number,
  highlights: Coordinate[][],
): boolean {
  for (const wordCoords of highlights) {
    for (const c of wordCoords) {
      if (c.x === colIndex && c.y === rowIndex) return true;
    }
  }
  return false;
}

function BoardGridSkeleton({ className }: { className?: string }) {
  return (
    <div className="board-grid__wrapper">
      <div
        data-testid="board-grid-skeleton"
        aria-hidden="true"
        className={className ? `${BASE_CLASS} ${className}` : BASE_CLASS}
        style={{ "--board-size": 10 } as CSSProperties}
      >
        {Array.from({ length: 100 }, (_, i) => (
          <div
            key={i}
            className="board-grid__cell animate-pulse"
            style={{ cursor: "default", opacity: 0.4 }}
          />
        ))}
      </div>
    </div>
  );
}

export function BoardGrid({
  grid,
  matchId,
  className,
  frozenTiles = {},
  playerSlot,
  scoredTileHighlights = EMPTY_HIGHLIGHTS,
  highlightDurationMs = 3000,
  onSwapComplete,
  onSwapError,
}: BoardGridProps) {
  if (!grid || grid.length === 0) {
    return <BoardGridSkeleton className={className} />;
  }

  return (
    <BoardGridActive
      grid={grid}
      matchId={matchId}
      className={className}
      frozenTiles={frozenTiles}
      playerSlot={playerSlot}
      scoredTileHighlights={scoredTileHighlights}
      highlightDurationMs={highlightDurationMs}
      onSwapComplete={onSwapComplete}
      onSwapError={onSwapError}
    />
  );
}

function BoardGridActive({
  grid,
  matchId,
  className,
  frozenTiles = {},
  playerSlot,
  scoredTileHighlights = EMPTY_HIGHLIGHTS,
  highlightDurationMs = 3000,
  onSwapComplete,
  onSwapError,
}: BoardGridProps & { grid: BoardGridType }) {
  const [currentGrid, setCurrentGrid] = useState<BoardGridType>(grid);
  const [selected, setSelected] = useState<SelectedTile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeHighlights, setActiveHighlights] = useState<Coordinate[][]>([]);
  const highlightsKeyRef = useRef<string>("");
  const tileRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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

  useEffect(() => {
    if (!scoredTileHighlights?.length) {
      setActiveHighlights([]);
      return;
    }
    const key = scoredTileHighlights
      .map((h) => h.map((c) => `${c.x},${c.y}`).join("|"))
      .join(";");
    if (highlightsKeyRef.current === key) return;
    highlightsKeyRef.current = key;
    setActiveHighlights(scoredTileHighlights);
    const t = setTimeout(() => {
      setActiveHighlights([]);
      highlightsKeyRef.current = "";
    }, highlightDurationMs);
    return () => clearTimeout(t);
  }, [scoredTileHighlights, highlightDurationMs]);

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

  const animateSwap = useCallback(
    (from: SelectedTile, to: SelectedTile) => {
      const fromKey = `${from.x},${from.y}`;
      const toKey = `${to.x},${to.y}`;
      const fromEl = tileRefs.current.get(fromKey);
      const toEl = tileRefs.current.get(toKey);

      if (!fromEl || !toEl) {
        void handleSwap(from, to);
        return;
      }

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      const dx = toRect.left - fromRect.left;
      const dy = toRect.top - fromRect.top;

      setIsAnimating(true);

      fromEl.classList.add("board-grid__cell--animating");
      toEl.classList.add("board-grid__cell--animating");
      fromEl.style.transform = `translate(${dx}px, ${dy}px)`;
      toEl.style.transform = `translate(${-dx}px, ${-dy}px)`;

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;

        fromEl.style.transform = "";
        toEl.style.transform = "";
        fromEl.classList.remove("board-grid__cell--animating");
        toEl.classList.remove("board-grid__cell--animating");

        setIsAnimating(false);
        void handleSwap(from, to);
      };

      fromEl.addEventListener("transitionend", cleanup, { once: true });
      // Fallback if transitionend doesn't fire (e.g., reduced motion, dx=0)
      setTimeout(cleanup, 300);
    },
    [handleSwap],
  );

  const handleTileClick = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (isSubmitting || isAnimating) {
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
      animateSwap(selected, coordinate);
    },
    [animateSwap, isSubmitting, isAnimating, selected]
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
        data-animating={isAnimating ? "true" : undefined}
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
              const isScoredHighlight = activeHighlights.length > 0 && isTileInHighlights(colIndex, rowIndex, activeHighlights);

              const frozenStyle: CSSProperties | undefined = isTileFrozen
                ? frozenOwner === "both"
                  ? { background: FROZEN_COLORS.both }
                  : { backgroundColor: FROZEN_COLORS[frozenOwner ?? "player_a"] }
                : undefined;

              return (
                <button
                  key={`cell-${rowIndex}-${colIndex}`}
                  ref={(el) => {
                    const refKey = `${colIndex},${rowIndex}`;
                    if (el) {
                      tileRefs.current.set(refKey, el);
                    } else {
                      tileRefs.current.delete(refKey);
                    }
                  }}
                  type="button"
                  role="gridcell"
                  aria-colindex={colIndex + 1}
                  aria-selected={isSelected}
                  aria-disabled={isTileFrozen || undefined}
                  className={`board-grid__cell${isSelected ? " board-grid__cell--selected" : ""}${isTileFrozen ? " board-grid__cell--frozen" : ""}${isScoredHighlight ? " board-grid__cell--scored" : ""}`}
                  data-testid="board-tile"
                  data-tile-index={rowIndex * 10 + colIndex}
                  data-col={colIndex}
                  data-row={rowIndex}
                  data-selected={isSelected ? "true" : undefined}
                  data-frozen={isTileFrozen ? frozenOwner : undefined}
                  data-frozen-owner={isTileFrozen ? frozenOwner : undefined}
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
