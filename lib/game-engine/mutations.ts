import type { SupabaseClient } from "@supabase/supabase-js";

import type { BoardGrid, MoveRequest } from "../types/board";

type AnySupabaseClient = SupabaseClient<any, any, any, any, any>;

export interface PersistSwapBase {
  client: AnySupabaseClient;
  boardRowId: string;
  move: MoveRequest;
}

export interface PersistAcceptedSwapOptions extends PersistSwapBase {
  grid: BoardGrid;
}

export interface PersistRejectedSwapOptions extends PersistSwapBase {
  errorMessage: string;
}

export async function persistAcceptedSwap({
  client,
  boardRowId,
  grid,
  move,
}: PersistAcceptedSwapOptions): Promise<void> {
  const { error: updateError } = await client
    .from("boards")
    .update({ grid })
    .eq("id", boardRowId);

  if (updateError) {
    throw new Error(`Failed to persist swap to Supabase: ${updateError.message}`);
  }

  const { error: auditError } = await client.from("moves").insert({
    board_id: boardRowId,
    from_x: move.from.x,
    from_y: move.from.y,
    to_x: move.to.x,
    to_y: move.to.y,
    result: "accepted",
    error: null,
  });

  if (auditError) {
    throw new Error(`Failed to record swap audit log: ${auditError.message}`);
  }
}

export async function persistRejectedSwap({
  client,
  boardRowId,
  move,
  errorMessage,
}: PersistRejectedSwapOptions): Promise<void> {
  const { error } = await client.from("moves").insert({
    board_id: boardRowId,
    from_x: move.from.x,
    from_y: move.from.y,
    to_x: move.to.x,
    to_y: move.to.y,
    result: "rejected",
    error: errorMessage,
  });

  if (error) {
    throw new Error(`Failed to record rejected swap: ${error.message}`);
  }
}


