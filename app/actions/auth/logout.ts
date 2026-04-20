"use server";

import "server-only";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { resignMatch } from "@/app/actions/match/resignMatch";
import { readLobbySession, SESSION_COOKIE_NAME } from "@/lib/matchmaking/profile";
import {
  expireLobbyPresence,
  findActiveMatchForPlayer,
} from "@/lib/matchmaking/service";
import { forgetPresence } from "@/lib/matchmaking/presenceCache";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { getServiceRoleClient } from "@/lib/supabase/server";

export interface LogoutInput {
  resignActiveMatch?: boolean;
}

export interface LogoutResult {
  status: "signed-out";
  resignedMatchId: string | null;
}

export async function logoutAction(
  input: LogoutInput = {},
): Promise<LogoutResult> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "signed-out", resignedMatchId: null };
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

  let resignedMatchId: string | null = null;
  if (input.resignActiveMatch) {
    const activeMatch = await findActiveMatchForPlayer(supabase, playerId);
    if (activeMatch) {
      try {
        await resignMatch(activeMatch.id);
        resignedMatchId = activeMatch.id;
      } catch (error) {
        console.warn(
          "[logoutAction] resignMatch failed, continuing with logout",
          error,
        );
      }
    }
  }

  await expireLobbyPresence(supabase, playerId);
  forgetPresence(playerId);

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  revalidatePath("/", "layout");
  return { status: "signed-out", resignedMatchId };
}
