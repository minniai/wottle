import { createClient } from "@supabase/supabase-js";

import { PRIMARY_BOARD_ID } from "./constants";
import { generateBoard } from "./generateBoard";
import { seedBoard } from "./seed";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function resetBoard() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: board, error: fetchError } = await supabase
    .from("boards")
    .select("id")
    .eq("board_id", PRIMARY_BOARD_ID)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (board) {
    const matchId = process.env.BOARD_MATCH_ID ?? `board-${Date.now()}`;
    const grid = generateBoard({ matchId });
    const { error: resetBoardError } = await supabase
      .from("boards")
      .update({ grid })
      .eq("id", board.id);

    if (resetBoardError) {
      throw resetBoardError;
    }

    const { error: deleteMovesError } = await supabase
      .from("moves")
      .delete()
      .eq("board_id", board.id);

    if (deleteMovesError) {
      throw deleteMovesError;
    }
  } else {
    // If the board does not exist yet, fall back to seeding.
    await seedBoard();
  }

  console.log(
    JSON.stringify({
      event: "supabase.reset.success",
      boardId: PRIMARY_BOARD_ID,
      timestamp: new Date().toISOString(),
    })
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  resetBoard().catch((error) => {
    console.error(
      JSON.stringify({
        event: "supabase.reset.error",
        message: error.message,
        stack: error.stack,
        boardId: PRIMARY_BOARD_ID,
        timestamp: new Date().toISOString(),
      })
    );
    process.exitCode = 1;
  });
}

export { resetBoard };
