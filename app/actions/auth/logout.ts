"use server";

import "server-only";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { readLobbySession, SESSION_COOKIE_NAME } from "@/lib/matchmaking/profile";
import { expireLobbyPresence } from "@/lib/matchmaking/service";
import { forgetPresence } from "@/lib/matchmaking/presenceCache";
import { getServiceRoleClient } from "@/lib/supabase/server";

export interface LogoutInput {
  resignActiveMatch?: boolean;
}

export interface LogoutResult {
  status: "signed-out";
  resignedMatchId: string | null;
}

export async function logoutAction(
  _input: LogoutInput = {},
): Promise<LogoutResult> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "signed-out", resignedMatchId: null };
  }

  const playerId = session.player.id;
  const supabase = getServiceRoleClient();

  await expireLobbyPresence(supabase, playerId);
  forgetPresence(playerId);

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  revalidatePath("/", "layout");
  return { status: "signed-out", resignedMatchId: null };
}
