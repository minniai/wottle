"use server";

import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { getServiceRoleClient } from "@/lib/supabase/server";
import { getBoardGridSchema, type BoardGrid } from "@/lib/types/board";
import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";
import { PRIMARY_BOARD_ID } from "@/scripts/supabase/constants";

type BoardRow = {
  id: string;
  board_id: string;
  grid: unknown;
  updated_at: string | null;
};

type BoardQueryResult = {
  data: BoardRow | null;
  error: { message: string } | null;
};

export interface GetBoardResult {
  boardId: string;
  grid: BoardGrid;
  updatedAt: string | null;
}

export async function getBoard(): Promise<GetBoardResult> {
  noStore();

  const supabase = getServiceRoleClient();
  const { data, error } = (await supabase
    .from("boards")
    .select("id, board_id, grid, updated_at")
    .eq("board_id", PRIMARY_BOARD_ID)
    .maybeSingle()) as BoardQueryResult;

  if (error) {
    throw new Error(`Failed to load board from Supabase: ${error.message}`);
  }

  if (!data) {
    throw new Error("Could not find board in Supabase");
  }

  if (data.board_id !== PRIMARY_BOARD_ID) {
    throw new Error("Unexpected board identifier returned from Supabase");
  }

  let grid: BoardGrid;
  try {
    grid = getBoardGridSchema(DEFAULT_GAME_CONFIG).parse(data.grid);
  } catch (parseError) {
    throw new Error("Invalid board grid received from Supabase", {
      cause: parseError,
    });
  }

  return {
    boardId: data.id,
    grid,
    updatedAt: data.updated_at,
  };
}


