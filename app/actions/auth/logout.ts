"use server";

import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, signedOutCookieOptions, SIGNED_OUT_COOKIE_NAME } from "@/lib/auth/cookies";
import type { ErrorCode } from "@/lib/i18n/copy/types";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { clearUnseenResult } from "@/lib/match/unseenResult";
import { forgetPresence } from "@/lib/matchmaking/presenceCache";
import { expireLobbyPresence } from "@/lib/matchmaking/service";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { getServiceRoleClient } from "@/lib/supabase/server";

export type LogoutResult =
  | { status: "signed-out" }
  /** A live match is never ended by signing out (spec 067 FR-013, FR-014). */
  | { status: "refused"; code: Extract<ErrorCode, "sign_out_in_match"> };

export async function logoutAction(): Promise<LogoutResult> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "signed-out" };
  }

  const playerId = session.player.id;
  assertWithinRateLimit({
    identifier: playerId,
    scope: "auth:logout",
    limit: 10,
    windowMs: 60_000,
    errorMessage: "Too many sign-out attempts. Please wait.",
  });

  const supabase = getServiceRoleClient();
  // One transaction: refuse during a live match, otherwise withdraw the
  // player's challenges and rematch requests and leave the queue (FR-015).
  const { data, error } = await supabase.rpc("sign_out_player", { p_player: playerId });
  if (error) throw new Error(`sign_out_player: ${error.message}`);
  if ((data as { status: string }).status === "in_match") {
    console.warn(JSON.stringify({ event: "auth.sign_out.refused", playerId }));
    return { status: "refused", code: "sign_out_in_match" };
  }

  await expireLobbyPresence(supabase, playerId);
  await clearUnseenResult(playerId, null);
  forgetPresence(playerId);

  const cookieStore = await cookies();
  cookieStore.delete({ name: SESSION_COOKIE_NAME, path: "/" });
  // The device key stays: the door greets this browser's player by name (US3).
  cookieStore.set(SIGNED_OUT_COOKIE_NAME, "1", signedOutCookieOptions());

  // No revalidatePath: every caller already runs router.refresh(), and a layout-wide
  // revalidation of `/` also purges the prerendered /rules pages, which then 404
  // (NoFallbackError) until the next deploy.
  return { status: "signed-out" };
}
