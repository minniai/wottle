import "server-only";

import { cookies } from "next/headers";

import { readEloRatings } from "@/lib/rating/playerRatings";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { Language } from "@/lib/types/game-config";
import type { ReturningPlayer } from "@/lib/types/lobby";

import { DEVICE_COOKIE_NAME, SIGNED_OUT_COOKIE_NAME } from "./cookies";
import { hashDeviceKey } from "./deviceKey";

/**
 * Who the door greets after a sign-out: the name this browser's key entered as
 * most recently (spec 067 US3). A read only; entering is enterAsReturningAction.
 */
export async function readReturningPlayer(language: Language): Promise<ReturningPlayer | null> {
  const store = await cookies();
  const deviceKey = store.get(DEVICE_COOKIE_NAME)?.value;
  if (!deviceKey || !store.has(SIGNED_OUT_COOKIE_NAME)) return null;

  const supabase = getServiceRoleClient();
  const { data } = await supabase
    .from("players")
    .select("id, display_name")
    .eq("claim_hash", hashDeviceKey(deviceKey))
    .order("last_entered_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const player = data as { id: string; display_name: string } | null;
  if (!player) return null;

  const ratings = await readEloRatings(supabase, [player.id], language).catch(() => new Map<string, number>());
  return { displayName: player.display_name, rating: ratings.get(player.id) ?? null };
}
