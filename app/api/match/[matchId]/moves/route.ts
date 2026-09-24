import { NextResponse } from "next/server";
import { z } from "zod";

import { createPerfTimer } from "@/lib/observability/perf";
import { loadCompletedMoves } from "@/lib/review/movesRepository";
import { getServiceRoleClient } from "@/lib/supabase/server";

const matchIdSchema = z.string().uuid();
const NO_STORE = { "cache-control": "no-store" };
/** A completed match never changes, so its moves are cached for good. */
const IMMUTABLE = { "cache-control": "public, max-age=31536000, immutable" };

/**
 * Spec 071 (FR-043): the moves of a completed match, in receipt order, for review. Public: no
 * session is read. A live, pending, void or unknown match answers the same 404, so this route
 * never reveals that a match is being played.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  if (!matchIdSchema.safeParse(matchId).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400, headers: NO_STORE });
  }
  const timer = createPerfTimer("review.moves.served", { matchId });
  timer.start();
  const moves = await loadCompletedMoves(getServiceRoleClient(), matchId);
  if (!moves) return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  timer.success({ moves: moves.moves.length });
  return NextResponse.json(moves, { status: 200, headers: IMMUTABLE });
}
