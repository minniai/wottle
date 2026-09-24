import "server-only";

import { z } from "zod";

import { getServiceRoleClient } from "@/lib/supabase/server";
import type { Language } from "@/lib/types/game-config";
import type { PresenceWord } from "@/lib/types/profile";

/**
 * The only TypeScript caller of `best_words` and `presence_word` (spec 072).
 * Neither returns a time: a profile never shows when anyone was last seen.
 */
const bestRows = z.array(z.object({ word: z.string(), points: z.number() }));
const presenceReply = z.object({
  state: z.enum(["here", "in_match", "away", "other_lobby", "not_here"]),
  moves_played: z.number().int().nullable(),
});

export async function bestWords(playerId: string, language: Language, limit = 3): Promise<{ word: string; points: number }[]> {
  const { data, error } = await getServiceRoleClient().rpc("best_words", { p_player: playerId, p_language: language, p_limit: limit });
  if (error) throw new Error(`best_words: ${error.message}`);
  return bestRows.parse(data ?? []);
}

export async function presenceWord(playerId: string, language: Language): Promise<PresenceWord> {
  const { data, error } = await getServiceRoleClient().rpc("presence_word", { p_player: playerId, p_language: language });
  if (error) throw new Error(`presence_word: ${error.message}`);
  const reply = presenceReply.parse(data);
  return { state: reply.state, movesPlayed: reply.moves_played };
}
