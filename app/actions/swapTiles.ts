"use server";

import "server-only";

import { ZodError } from "zod";

import { getServiceRoleClient } from "../../lib/supabase/server";
import {
  boardGridSchema,
  moveRequestSchema,
  type BoardGrid,
  type MoveRequest,
  type MoveResult,
} from "../../lib/types/board";
import { applySwap } from "../../lib/game-engine/board";
import {
  persistAcceptedSwap,
  persistRejectedSwap,
} from "../../lib/game-engine/mutations";
import { PRIMARY_BOARD_ID } from "../../scripts/supabase/constants";
import { createPerfTimer } from "../../lib/observability/perf";
import {
  BOARD_DIMENSIONS_LABEL,
  BOARD_MAX_INDEX,
} from "../../lib/constants/board";

interface BoardRow {
  id: string;
  board_id: string;
  grid: unknown;
}

interface BoardQueryResult {
  data: BoardRow | null;
  error: { message: string } | null;
}

function coordinatesWithinBounds(move: MoveRequest): boolean {
  const values = [move.from.x, move.from.y, move.to.x, move.to.y];
  return values.every(
    (value) =>
      Number.isInteger(value) && value >= 0 && value <= BOARD_MAX_INDEX
  );
}

function toValidationMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return `Invalid swap request. Coordinates must be within the ${BOARD_DIMENSIONS_LABEL} board.`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Invalid swap request.";
}

export async function swapTiles(payload: MoveRequest): Promise<MoveResult> {
  const perf = createPerfTimer("app.actions.swapTiles", {
    moveFrom: payload?.from ?? null,
    moveTo: payload?.to ?? null,
  });
  perf.start();

  const supabase = getServiceRoleClient();

  const { data, error } = (await supabase
    .from("boards")
    .select("id, board_id, grid")
    .eq("board_id", PRIMARY_BOARD_ID)
    .maybeSingle()) as BoardQueryResult;

  if (error) {
    const failure = new Error(`Failed to load board for swap: ${error.message}`);
    perf.failure(failure, { reason: "board-query" });
    throw failure;
  }

  if (!data) {
    const failure = new Error("Could not load board for swap.");
    perf.failure(failure, { reason: "board-missing" });
    throw failure;
  }

  if (data.board_id !== PRIMARY_BOARD_ID) {
    const failure = new Error("Supabase returned an unexpected board identifier.");
    perf.failure(failure, {
      reason: "board-invariant",
      boardId: data.board_id,
    });
    throw failure;
  }

  let currentGrid: BoardGrid;
  try {
    currentGrid = boardGridSchema.parse(data.grid);
  } catch (parseError) {
    const failure = new Error("Stored board grid is invalid.", { cause: parseError });
    perf.failure(failure, { reason: "grid-invalid", boardRowId: data.id });
    throw failure;
  }

  const parsedMove = moveRequestSchema.safeParse(payload);
  if (!parsedMove.success) {
    const errorMessage = toValidationMessage(parsedMove.error);
    perf.success({
      status: "rejected",
      reason: "validation",
      boardRowId: data.id,
    });
    return {
      status: "rejected",
      grid: currentGrid,
      error: errorMessage,
    };
  }

  const move = parsedMove.data;

  try {
    const nextGrid = applySwap(currentGrid, move);

    await persistAcceptedSwap({
      client: supabase,
      boardRowId: data.id,
      grid: nextGrid,
      move,
    });

    perf.success({
      status: "accepted",
      boardRowId: data.id,
    });

    return {
      status: "accepted",
      grid: nextGrid,
    };
  } catch (maybeValidationError) {
    if (
      maybeValidationError instanceof ZodError ||
      (maybeValidationError instanceof Error &&
        /cannot swap/i.test(maybeValidationError.message))
    ) {
      const message = toValidationMessage(maybeValidationError);

      if (coordinatesWithinBounds(move)) {
        await persistRejectedSwap({
          client: supabase,
          boardRowId: data.id,
          move,
          errorMessage: message,
        });
      }

      perf.success({
        status: "rejected",
        reason: "move-invalid",
        boardRowId: data.id,
      });

      return {
        status: "rejected",
        grid: currentGrid,
        error: message,
      };
    }

    if (maybeValidationError instanceof Error) {
      if (/Failed to persist swap to Supabase/i.test(maybeValidationError.message)) {
        perf.failure(maybeValidationError, {
          reason: "update-failed",
          boardRowId: data.id,
        });
        throw maybeValidationError;
      }

      if (/Failed to record swap audit log/i.test(maybeValidationError.message)) {
        perf.failure(maybeValidationError, {
          reason: "audit-failed",
          boardRowId: data.id,
        });
        throw maybeValidationError;
      }

      if (/Failed to record rejected swap/i.test(maybeValidationError.message)) {
        perf.failure(maybeValidationError, {
          reason: "audit-failed",
          boardRowId: data.id,
        });
        throw maybeValidationError;
      }
    }

    const failure =
      maybeValidationError instanceof Error
        ? maybeValidationError
        : new Error("Unexpected swap failure", {
            cause: maybeValidationError,
          });
    perf.failure(failure, { reason: "unexpected", boardRowId: data.id });
    throw failure;
  }
}


