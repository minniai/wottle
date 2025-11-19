"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  BoardGrid as BoardGridType,
  MoveRequest,
  MoveResult,
} from "../../lib/types/board";
import { BoardGrid } from "./BoardGrid";
import {
  MoveFeedback,
  type MoveFeedbackDetails,
} from "./MoveFeedback";
import { BOARD_SIZE } from "../../lib/constants/board";

interface BoardExperienceProps {
  initialGrid: BoardGridType;
  matchId: string;
}

type SwapCompletePayload = {
  move: MoveRequest;
  result: MoveResult;
};

type SwapErrorPayload = {
  move: MoveRequest;
  message: string;
  grid: BoardGridType;
};

function createFeedbackId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(BOARD_SIZE)
    .slice(2)}`;
}

function formatCoordinate({ x, y }: { x: number; y: number }): string {
  return `row ${y + 1}, column ${x + 1}`;
}

export function BoardExperience({ initialGrid, matchId }: BoardExperienceProps) {
  const [grid, setGrid] = useState<BoardGridType>(initialGrid);
  const [feedback, setFeedback] = useState<MoveFeedbackDetails | null>(null);

  useEffect(() => {
    setGrid(initialGrid);
  }, [initialGrid]);

  const dismissFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const handleSwapComplete = useCallback(
    ({ move, result }: SwapCompletePayload) => {
      setGrid(result.grid);

      if (result.status === "accepted") {
        setFeedback({
          id: createFeedbackId("success"),
          variant: "success",
          message: `Move accepted. Swapped ${formatCoordinate(move.from)} with ${formatCoordinate(move.to)}.`,
        });
        return;
      }

      const errorMessage = result.error ?? "Invalid swap request.";

      setFeedback({
        id: createFeedbackId("error"),
        variant: "error",
        title: "Invalid swap",
        message: errorMessage,
      });
    },
    []
  );

  const handleSwapError = useCallback(
    ({ grid: previousGrid, message }: SwapErrorPayload) => {
      setGrid(previousGrid);
      setFeedback({
        id: createFeedbackId("error"),
        variant: "error",
        message,
      });
    },
    []
  );

  return (
    <div className="space-y-4">
      <BoardGrid
        grid={grid}
        matchId={matchId}
        onSwapComplete={handleSwapComplete}
        onSwapError={handleSwapError}
      />
      <MoveFeedback feedback={feedback} onDismiss={dismissFeedback} />
    </div>
  );
}
