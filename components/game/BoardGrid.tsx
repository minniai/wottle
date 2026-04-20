"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
} from "@/lib/constants/playerColors";
import { usePinchZoom } from "@/components/game/usePinchZoom";
import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";

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
  /** Duration to show scored tile highlights in ms. Default 800. */
  highlightDurationMs?: number;
  /** CSS animation-delay in ms applied to each scored tile. Use to sequence after swap flash. Default 0. */
  highlightDelayMs?: number;
  /** Per-tile highlight color map for player-attributed glow. Keys are "x,y" strings, values are CSS color strings. */
  highlightPlayerColors?: Record<string, string>;
  /** When true, scored tile highlights persist until highlightPlayerColors is externally cleared (no auto-clear timer). */
  persistentHighlight?: boolean;
  /** When true, board ignores all tile clicks (move lock after swap submission). */
  disabled?: boolean;
  /** When true, shows the "Move submitted — waiting for opponent" overlay. Separate from disabled so
   *  read-only boards (e.g. final summary) don't show the in-game lock banner. */
  showLockBanner?: boolean;
  /** Coordinates of the two tiles involved in the locked swap — rendered with orange highlight. */
  lockedTiles?: [Coordinate, Coordinate] | null;
  /** Coordinates of opponent's swapped tiles during reveal phase — rendered with orange fade animation. */
  opponentRevealTiles?: [Coordinate, Coordinate] | null;
  onSwapComplete?: (details: { move: MoveRequest; result: MoveResult }) => void;
  onSwapError?: (details: {
    move: MoveRequest;
    message: string;
    grid: BoardGridType;
  }) => void;
  /** Called on every tile selection click (for audio feedback). */
  onTileSelect?: () => void;
  /** Called when a swap is accepted by the server (for audio feedback). */
  onValidSwap?: () => void;
  /** Called when a swap is rejected or a frozen tile is clicked (for audio feedback). */
  onInvalidMove?: () => void;
  /** Fired whenever the currently-selected first tile changes (null when deselected). */
  onSelectionChange?: (selection: Coordinate | null) => void;
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
  highlightDurationMs = 800,
  highlightDelayMs = 0,
  highlightPlayerColors = {},
  persistentHighlight = false,
  disabled = false,
  showLockBanner = false,
  lockedTiles = null,
  opponentRevealTiles = null,
  onSwapComplete,
  onSwapError,
  onTileSelect,
  onValidSwap,
  onInvalidMove,
  onSelectionChange,
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
      highlightDelayMs={highlightDelayMs}
      highlightPlayerColors={highlightPlayerColors}
      persistentHighlight={persistentHighlight}
      disabled={disabled}
      showLockBanner={showLockBanner}
      lockedTiles={lockedTiles}
      opponentRevealTiles={opponentRevealTiles}
      onSwapComplete={onSwapComplete}
      onSwapError={onSwapError}
      onTileSelect={onTileSelect}
      onValidSwap={onValidSwap}
      onInvalidMove={onInvalidMove}
      onSelectionChange={onSelectionChange}
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
  highlightDurationMs = 800,
  highlightDelayMs = 0,
  highlightPlayerColors = {},
  persistentHighlight = false,
  disabled = false,
  showLockBanner = false,
  lockedTiles = null,
  opponentRevealTiles = null,
  onSwapComplete,
  onSwapError,
  onTileSelect,
  onValidSwap,
  onInvalidMove,
  onSelectionChange,
}: BoardGridProps & { grid: BoardGridType }) {
  const [currentGrid, setCurrentGrid] = useState<BoardGridType>(grid);
  const [selected, setSelected] = useState<SelectedTile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    onSelectionChange?.(selected);
  }, [selected, onSelectionChange]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swappingTiles, setSwappingTiles] = useState<[SelectedTile, SelectedTile] | null>(null);
  const [activeHighlights, setActiveHighlights] = useState<Coordinate[][]>([]);
  const [invalidTiles, setInvalidTiles] = useState<[Coordinate, Coordinate] | null>(null);
  const invalidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { scale: boardScale, handleTouchStart, handleTouchMove, handleTouchEnd } = usePinchZoom(0.5, 1.5);
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
    // Skip sync while board is move-locked — the optimistic swap in
    // currentGrid must persist.  The Realtime broadcast during "collecting"
    // carries board_snapshot_before (the pre-swap board) which would revert
    // the visual swap.  When disabled flips back to false (round advances)
    // the latest grid prop is applied.
    if (!disabled) {
      setCurrentGrid(grid);
    }
  }, [grid, disabled]);

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
    if (persistentHighlight) return;
    const t = setTimeout(() => {
      setActiveHighlights([]);
      highlightsKeyRef.current = "";
    }, highlightDurationMs);
    return () => clearTimeout(t);
  }, [scoredTileHighlights, highlightDurationMs, persistentHighlight]);

  const rowCount = currentGrid.length;
  const colCount = currentGrid[0]?.length ?? 0;

  const containerClass = useMemo(
    () => {
      let cls = className ? `${BASE_CLASS} ${className}` : BASE_CLASS;
      if (disabled) cls += " board-grid--locked";
      return cls;
    },
    [className, disabled]
  );

  const handleSwap = useCallback(
    async (from: SelectedTile, to: SelectedTile) => {
      setIsSubmitting(true);
      const moveRequest: MoveRequest = { from, to };

      try {
        const result = await submitSwapRequest(matchId, moveRequest);

        if (result.grid) {
          setCurrentGrid(result.grid);
        }

        if (result.status === "accepted") {
          onValidSwap?.();
        } else {
          onInvalidMove?.();
        }
        onSwapComplete?.({ move: moveRequest, result });
      } catch (error) {
        // Reverse the optimistic swap on error
        setCurrentGrid((prev) => {
          const reverted = prev.map((row) => [...row]) as BoardGridType;
          const temp = reverted[from.y][from.x];
          reverted[from.y][from.x] = reverted[to.y][to.x];
          reverted[to.y][to.x] = temp;
          return reverted;
        });

        // Flash shake animation on the rejected tile pair.
        // Cancel any prior shake window so rapid re-rejections restart cleanly (FR-012).
        if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current);
        setInvalidTiles([from, to]);
        invalidTimerRef.current = setTimeout(() => {
          setInvalidTiles(null);
          invalidTimerRef.current = null;
        }, 400);

        const message =
          error instanceof Error
            ? error.message
            : "Network error while submitting swap. Please try again.";

        const normalizedMessage =
          /network/i.test(message) || /failed to fetch/i.test(message)
            ? "Network error while submitting swap. Please try again."
            : message;

        onInvalidMove?.();
        onSwapError?.({
          move: moveRequest,
          message: normalizedMessage,
          grid: currentGrid,
        });
      } finally {
        setSwappingTiles(null);
        setIsSubmitting(false);
      }
    },
    [currentGrid, matchId, onSwapComplete, onSwapError, onValidSwap, onInvalidMove]
  );

  // FLIP animation state: stored position deltas from before the grid swap
  const flipRef = useRef<{
    from: SelectedTile;
    to: SelectedTile;
    dx: number;
    dy: number;
  } | null>(null);

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

      // FIRST: measure positions before the swap
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      const dx = toRect.left - fromRect.left;
      const dy = toRect.top - fromRect.top;

      // Store FLIP data for useLayoutEffect
      flipRef.current = { from, to, dx, dy };

      // LAST: swap grid data immediately (optimistic local update)
      setCurrentGrid((prev) => {
        const next = prev.map((row) => [...row]) as BoardGridType;
        const temp = next[from.y][from.x];
        next[from.y][from.x] = next[to.y][to.x];
        next[to.y][to.x] = temp;
        return next;
      });
      setIsAnimating(true);
    },
    [handleSwap],
  );

  // FLIP: INVERT + PLAY phases run after React commits the swapped grid
  useLayoutEffect(() => {
    const flip = flipRef.current;
    if (!flip) return;
    flipRef.current = null;

    const { from, to, dx, dy } = flip;
    // After grid swap, the tile that WAS at `from` is now at `to` and vice versa
    const fromKey = `${from.x},${from.y}`;
    const toKey = `${to.x},${to.y}`;
    const elAtFrom = tileRefs.current.get(fromKey);
    const elAtTo = tileRefs.current.get(toKey);

    if (!elAtFrom || !elAtTo) {
      setIsAnimating(false);
      void handleSwap(from, to);
      return;
    }

    // INVERT: apply inverse transforms so tiles visually appear at
    // their OLD positions (before the swap)
    elAtFrom.style.transition = "none";
    elAtTo.style.transition = "none";
    // elAtFrom now holds the letter that came FROM `to` — move it back
    elAtFrom.style.transform = `translate(${dx}px, ${dy}px)`;
    // elAtTo now holds the letter that came FROM `from` — move it back
    elAtTo.style.transform = `translate(${-dx}px, ${-dy}px)`;
    elAtFrom.classList.add("board-grid__cell--animating");
    elAtTo.classList.add("board-grid__cell--animating");

    // Force reflow so the browser registers the inverted position
    void elAtFrom.offsetHeight;

    // PLAY: remove transforms with transition enabled → CSS animates
    // tiles from inverted (old) position to natural (new) position
    elAtFrom.style.transition = "";
    elAtTo.style.transition = "";
    elAtFrom.style.transform = "";
    elAtTo.style.transform = "";

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      elAtFrom.removeEventListener("transitionend", onEnd);
      elAtFrom.classList.remove("board-grid__cell--animating");
      elAtTo.classList.remove("board-grid__cell--animating");
      // swappingTiles deliberately NOT cleared here — cleared in handleSwap's
      // finally block so tiles stay orange (--selected) during the server roundtrip.
      setIsAnimating(false);
      void handleSwap(from, to);
    };

    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === "transform") cleanup();
    };
    elAtFrom.addEventListener("transitionend", onEnd);
    // Fallback if transitionend doesn't fire (reduced motion, dx=0)
    setTimeout(cleanup, 300);
  }, [currentGrid, handleSwap]);

  const handleTileClick = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (isSubmitting || isAnimating || disabled) {
        return;
      }

      const coordinate = { x: colIndex, y: rowIndex } as SelectedTile;

      if (!selected) {
        onTileSelect?.();
        setSelected(coordinate);
        return;
      }

      // If clicking the same tile, deselect
      if (selected.x === coordinate.x && selected.y === coordinate.y) {
        setSelected(null);
        return;
      }

      // Explicit local check for frozen tiles (US1).
      // If either tile is frozen, reject instantly without hitting the server
      // or triggering an optimistic swap.
      const fromKey = `${selected.x},${selected.y}`;
      const toKey = `${coordinate.x},${coordinate.y}`;
      if (frozenTiles[fromKey] || frozenTiles[toKey]) {
        if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current);
        setInvalidTiles([selected, coordinate]);
        invalidTimerRef.current = setTimeout(() => {
          setInvalidTiles(null);
          invalidTimerRef.current = null;
        }, 400);
        onInvalidMove?.();
        setSelected(null);
        return;
      }

      setSwappingTiles([selected, coordinate]);
      setSelected(null);
      animateSwap(selected, coordinate);
    },
    [animateSwap, isSubmitting, isAnimating, disabled, selected, frozenTiles, onTileSelect, onInvalidMove]
  );

  // Deselect on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selected) {
        setSelected(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selected]);

  // Deselect on right-click anywhere
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (selected) {
        e.preventDefault();
        setSelected(null);
      }
    },
    [selected]
  );

  const boardSize = useMemo(
    () => Math.max(colCount, rowCount, 1),
    [colCount, rowCount]
  );

  return (
    <div
      className="board-grid__wrapper"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={handleContextMenu}
      style={{ "--board-scale": boardScale } as React.CSSProperties}
    >
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
            position: "relative",
          } as CSSProperties
        }
        data-submitting={isSubmitting ? "true" : undefined}
        data-animating={isAnimating ? "true" : undefined}
      >
        {showLockBanner && (
          <div
            className="board-grid__lock-banner"
            aria-live="polite"
            data-testid="move-lock-banner"
          >
            Move submitted — waiting for opponent
          </div>
        )}
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
              // In persistent mode, any tile with an explicit color is highlighted directly.
              // In normal mode, highlight is driven by the timed activeHighlights array.
              const isScoredHighlight = persistentHighlight
                ? !!highlightPlayerColors[tileKey]
                : activeHighlights.length > 0 && isTileInHighlights(colIndex, rowIndex, activeHighlights);
              const isSwapping =
                swappingTiles !== null &&
                ((swappingTiles[0].x === colIndex && swappingTiles[0].y === rowIndex) ||
                  (swappingTiles[1].x === colIndex && swappingTiles[1].y === rowIndex));
              const isLocked =
                lockedTiles !== null &&
                ((lockedTiles[0].x === colIndex && lockedTiles[0].y === rowIndex) ||
                  (lockedTiles[1].x === colIndex && lockedTiles[1].y === rowIndex));
              const isOpponentReveal =
                opponentRevealTiles !== null &&
                ((opponentRevealTiles[0].x === colIndex && opponentRevealTiles[0].y === rowIndex) ||
                  (opponentRevealTiles[1].x === colIndex && opponentRevealTiles[1].y === rowIndex));
              const isInvalid =
                invalidTiles !== null &&
                ((invalidTiles[0].x === colIndex && invalidTiles[0].y === rowIndex) ||
                  (invalidTiles[1].x === colIndex && invalidTiles[1].y === rowIndex));

              const frozenStyle: CSSProperties | undefined = isTileFrozen
                ? { backgroundColor: FROZEN_COLORS[frozenOwner ?? "player_a"] }
                : undefined;

              const highlightColor = isScoredHighlight
                ? highlightPlayerColors[tileKey]
                : undefined;
              const needsDelay = isScoredHighlight && highlightDelayMs > 0;
              const tileStyle: CSSProperties | undefined =
                frozenStyle || highlightColor || needsDelay
                  ? ({
                      ...frozenStyle,
                      ...(highlightColor && { "--highlight-color": highlightColor }),
                      ...(needsDelay && { animationDelay: `${highlightDelayMs}ms` }),
                    } as CSSProperties)
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
                  className={`board-grid__cell${isSelected || isSwapping ? " board-grid__cell--selected" : ""}${isLocked ? " board-grid__cell--locked" : ""}${isOpponentReveal ? " board-grid__cell--opponent-reveal" : ""}${isTileFrozen ? " board-grid__cell--frozen" : ""}${isScoredHighlight ? ` board-grid__cell--scored${persistentHighlight ? " board-grid__cell--scored-static" : ""}` : ""}${isInvalid ? " board-grid__cell--invalid" : ""}`}
                  data-testid="board-tile"
                  data-tile-index={rowIndex * 10 + colIndex}
                  data-col={colIndex}
                  data-row={rowIndex}
                  data-selected={isSelected ? "true" : undefined}
                  data-frozen={isTileFrozen ? frozenOwner : undefined}
                  data-frozen-owner={isTileFrozen ? frozenOwner : undefined}
                  disabled={isSubmitting}
                  onClick={() => handleTileClick(rowIndex, colIndex)}
                  style={tileStyle}
                >
                  <span className="board-grid__tile" aria-hidden="true">
                    {letter}
                  </span>
                  <span className="board-grid__tile-score" aria-hidden="true">
                    {LETTER_SCORING_VALUES_IS[letter.toUpperCase() as keyof typeof LETTER_SCORING_VALUES_IS] ?? 1}
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
